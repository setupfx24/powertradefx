"""One Redis subscription per gateway process, fanned out to every WebSocket.

Before (QA 2026-09-29): every /ws/prices, /ws/bars, /ws/trades and /ws/admin
connection opened its OWN Redis pubsub, and each pubsub holds a connection
from the process's 50-connection pool for its whole life. About 100 users
exhausted the pool: the SL/TP and copy engines could no longer read ticks and
REST calls failed with 500.

Now each process keeps ONE pubsub connection. A reader task receives every
message once and puts it on the in-memory queue of each interested socket.
Queues are bounded; a slow client drops its OWN oldest messages (prices and
bars are coalesced by the consumer anyway) and never slows anyone else down.
"""
import asyncio
import logging
from collections import defaultdict

from packages.common.src.redis_client import redis_client

logger = logging.getLogger("realtime-hub")

QUEUE_SIZE = 2000


class RealtimeHub:
    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue]] = defaultdict(set)
        self._task: asyncio.Task | None = None
        self._channels: tuple[str, ...] = ()
        self._patterns: tuple[str, ...] = ()

    def configure(self, channels, patterns=()) -> None:
        self._channels = tuple(channels)
        self._patterns = tuple(patterns)

    async def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()

    def subscribe(self, topic: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_SIZE)
        self._subs[topic].add(q)
        return q

    def unsubscribe(self, topic: str, q: asyncio.Queue) -> None:
        subs = self._subs.get(topic)
        if subs is not None:
            subs.discard(q)
            if not subs:
                self._subs.pop(topic, None)

    def connections(self) -> int:
        return sum(len(v) for v in self._subs.values())

    def _dispatch(self, topic: str, data) -> None:
        for q in tuple(self._subs.get(topic, ())):
            if q.full():
                try:
                    q.get_nowait()  # drop this slow client's oldest message
                except asyncio.QueueEmpty:
                    pass
            try:
                q.put_nowait(data)
            except asyncio.QueueFull:
                pass

    async def _run(self) -> None:
        backoff = 1.0
        while True:
            pubsub = None
            try:
                pubsub = redis_client.pubsub()
                if self._channels:
                    await pubsub.subscribe(*self._channels)
                if self._patterns:
                    await pubsub.psubscribe(*self._patterns)
                logger.info("Realtime hub subscribed: %s %s", self._channels, self._patterns)
                backoff = 1.0
                async for message in pubsub.listen():
                    mtype = message.get("type")
                    if mtype not in ("message", "pmessage"):
                        continue
                    ch = message.get("channel")
                    if isinstance(ch, bytes):
                        ch = ch.decode("utf-8", "ignore")
                    self._dispatch(ch, message.get("data"))
            except asyncio.CancelledError:
                break
            except Exception as e:  # reconnect with backoff; sockets keep their queues
                logger.error("Realtime hub reader failed, reconnecting: %s", e)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30.0)
            finally:
                if pubsub is not None:
                    try:
                        await pubsub.close()
                    except Exception:
                        pass


hub = RealtimeHub()


async def next_messages(q: asyncio.Queue, timeout: float) -> list:
    """Wait up to `timeout` for the first message, then drain the queue."""
    out = []
    try:
        out.append(await asyncio.wait_for(q.get(), timeout=timeout))
    except asyncio.TimeoutError:
        return out
    while True:
        try:
            out.append(q.get_nowait())
        except asyncio.QueueEmpty:
            return out
