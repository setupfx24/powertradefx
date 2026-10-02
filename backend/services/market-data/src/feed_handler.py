"""Feed Handler — Infoway (see `infoway_feed`) when `INFOWAY_API_KEY` is set.

Fallback (no API key): Binance for crypto + GBM simulator for other symbols.
"""

import asyncio
import json
import logging
import random
from datetime import datetime, timezone
from typing import Dict, List, Optional

import websockets

from packages.common.src.redis_client import redis_client

logger = logging.getLogger("market-data.feed")

BINANCE_WS = "wss://stream.binance.com:9443/ws"
BINANCE_MAP = {
    "btcusdt": "BTCUSD",
    "ethusdt": "ETHUSD",
    "ltcusdt": "LTCUSD",
    "xrpusdt": "XRPUSD",
    "solusdt": "SOLUSD",
}
LIVE_CRYPTO_SYMBOLS = set(BINANCE_MAP.values())

INSTRUMENTS: Dict[str, dict] = {
    "EURUSD":  {"base_price": 1.0845,   "category": "forex_major", "pip": 0.0001,  "decimals": 5},
    "GBPUSD":  {"base_price": 1.2650,   "category": "forex_major", "pip": 0.0001,  "decimals": 5},
    "USDJPY":  {"base_price": 149.50,   "category": "forex_major", "pip": 0.01,    "decimals": 3},
    "AUDUSD":  {"base_price": 0.6580,   "category": "forex_major", "pip": 0.0001,  "decimals": 5},
    "USDCAD":  {"base_price": 1.3650,   "category": "forex_major", "pip": 0.0001,  "decimals": 5},
    "USDCHF":  {"base_price": 0.8820,   "category": "forex_major", "pip": 0.0001,  "decimals": 5},
    "NZDUSD":  {"base_price": 0.6120,   "category": "forex_minor", "pip": 0.0001,  "decimals": 5},
    "EURGBP":  {"base_price": 0.8575,   "category": "forex_minor", "pip": 0.0001,  "decimals": 5},
    "EURJPY":  {"base_price": 162.10,   "category": "forex_minor", "pip": 0.01,    "decimals": 3},
    "GBPJPY":  {"base_price": 189.20,   "category": "forex_minor", "pip": 0.01,    "decimals": 3},
    "XAUUSD":  {"base_price": 2650.50,  "category": "commodity",   "pip": 0.01,    "decimals": 2},
    "XAGUSD":  {"base_price": 31.25,    "category": "commodity",   "pip": 0.001,   "decimals": 3},
    "USOIL":   {"base_price": 78.50,    "category": "commodity",   "pip": 0.01,    "decimals": 2},
    "US30":    {"base_price": 39250.0,  "category": "index",       "pip": 0.1,     "decimals": 1},
    "US500":   {"base_price": 5180.0,   "category": "index",       "pip": 0.01,    "decimals": 2},
    "NAS100":  {"base_price": 18250.0,  "category": "index",       "pip": 0.1,     "decimals": 1},
    "UK100":   {"base_price": 8150.0,   "category": "index",       "pip": 0.1,     "decimals": 1},
    "GER40":   {"base_price": 17850.0,  "category": "index",       "pip": 0.1,     "decimals": 1},
    "BTCUSD":  {"base_price": 67500.0,  "category": "crypto",      "pip": 0.01,    "decimals": 2},
    "ETHUSD":  {"base_price": 3450.0,   "category": "crypto",      "pip": 0.01,    "decimals": 2},
    "LTCUSD":  {"base_price": 95.0,     "category": "crypto",      "pip": 0.01,    "decimals": 2},
    "XRPUSD":  {"base_price": 0.52,     "category": "crypto",      "pip": 0.0001,  "decimals": 4},
    "SOLUSD":  {"base_price": 145.0,    "category": "crypto",      "pip": 0.01,    "decimals": 2},
    "EURCHF":  {"base_price": 0.9340,   "category": "forex_minor", "pip": 0.0001,  "decimals": 5},
    "GBPCHF":  {"base_price": 1.1180,   "category": "forex_minor", "pip": 0.0001,  "decimals": 5},
    "AUDJPY":  {"base_price": 98.50,    "category": "forex_minor", "pip": 0.01,    "decimals": 3},
    "CADJPY":  {"base_price": 110.20,   "category": "forex_minor", "pip": 0.01,    "decimals": 3},
    "NZDJPY":  {"base_price": 91.40,    "category": "forex_minor", "pip": 0.01,    "decimals": 3},
    "USDHKD":  {"base_price": 7.7850,   "category": "forex_minor", "pip": 0.0001,  "decimals": 5},
}


SPREAD_RANGE: Dict[str, tuple] = {
    "EURUSD":  (0.00005, 0.00015),
    "GBPUSD":  (0.00005, 0.00015),
    "USDJPY":  (0.005,   0.015),
    "AUDUSD":  (0.00005, 0.00015),
    "USDCAD":  (0.00005, 0.00015),
    "USDCHF":  (0.00005, 0.00015),
    "NZDUSD":  (0.00010, 0.00030),
    "EURGBP":  (0.00010, 0.00030),
    "EURJPY":  (0.010,   0.030),
    "GBPJPY":  (0.010,   0.030),
    "XAUUSD":  (0.15,    0.30),
    "XAGUSD":  (0.02,    0.05),
    "USOIL":   (0.03,    0.05),
    "US30":    (1.0,     3.0),
    "US500":   (0.5,     1.5),
    "NAS100":  (1.0,     3.0),
    "UK100":   (0.5,     2.0),
    "GER40":   (0.5,     2.0),
    "BTCUSD":  (10.0,    50.0),
    "ETHUSD":  (1.0,     5.0),
    "LTCUSD":  (0.05,    0.15),
    "XRPUSD":  (0.0002,  0.0008),
    "SOLUSD":  (0.05,    0.20),
    "EURCHF":  (0.00010, 0.00030),
    "GBPCHF":  (0.00015, 0.00040),
    "AUDJPY":  (0.010,   0.030),
    "CADJPY":  (0.010,   0.030),
    "NZDJPY":  (0.012,   0.035),
    "USDHKD":  (0.0002,  0.0006),
}


class FeedSimulator:
    """Fallback feed used when no Infoway / Corecen feed is configured.

    Streams LIVE crypto prices from Binance only; every other symbol stays
    unquoted. It never generates prices (the old random-walk simulation was
    removed). Publishes to Redis and exposes a tick queue for downstream
    consumers."""

    def __init__(self, tick_rate_multiplier: float = 1.0):
        self.tick_rate_multiplier = tick_rate_multiplier

        self._tick_queue: asyncio.Queue = asyncio.Queue(maxsize=50_000)
        self._running = False
        self._tasks: List[asyncio.Task] = []

        self._prices: Dict[str, float] = {
            sym: info["base_price"] for sym, info in INSTRUMENTS.items()
        }

    @property
    def current_prices(self) -> Dict[str, float]:
        return dict(self._prices)

    async def start(self):
        """Start the LIVE crypto feed (Binance) ONLY. Non-crypto symbols are never
        simulated — without a real upstream feed they stay unquoted ('-'). No
        mock/fake prices are ever generated, under any flag."""
        self._running = True
        n_unquoted = sum(1 for s in INSTRUMENTS if s not in LIVE_CRYPTO_SYMBOLS)
        logger.info(
            "Feed starting — crypto=LIVE via Binance; %d non-crypto symbols UNQUOTED "
            "(no simulation — show '-' until a real feed provides them).",
            n_unquoted,
        )
        self._tasks.append(asyncio.create_task(self._binance_feed()))
        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def stop(self):
        """Gracefully stop all tick generators."""
        self._running = False
        for task in self._tasks:
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("Feed simulator stopped")

    async def get_tick(self) -> Optional[dict]:
        """Non-blocking dequeue of the next tick for downstream consumers."""
        try:
            return self._tick_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    # ------------------------------------------------------------------
    # Live Binance crypto feed
    # ------------------------------------------------------------------

    async def _binance_feed(self):
        streams = [f"{pair}@trade" for pair in BINANCE_MAP]
        url = f"{BINANCE_WS}/{'/'.join(streams)}"

        while self._running:
            try:
                logger.info("Connecting to Binance WebSocket: %s", url)
                async with websockets.connect(url, ping_interval=20, ping_timeout=10) as ws:
                    logger.info("Binance WebSocket connected — live crypto prices active")
                    async for raw in ws:
                        if not self._running:
                            break
                        try:
                            data = json.loads(raw)
                            pair = data.get("s", "").lower()
                            symbol = BINANCE_MAP.get(pair)
                            if not symbol:
                                continue

                            price = float(data["p"])
                            info = INSTRUMENTS[symbol]
                            decimals = info["decimals"]
                            spread_lo, spread_hi = SPREAD_RANGE[symbol]
                            spread = random.uniform(spread_lo, spread_hi)
                            half = spread / 2.0
                            bid = round(price - half, decimals)
                            ask = round(price + half, decimals)

                            ts = datetime.now(timezone.utc)
                            timestamp = ts.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts.microsecond // 1000:03d}Z"

                            self._prices[symbol] = price

                            tick = {
                                "symbol": symbol,
                                "bid": bid,
                                "ask": ask,
                                "timestamp": timestamp,
                                "volume": int(float(data.get("q", 1))),
                            }
                            self._enqueue(tick)
                            await self._publish_redis(tick, spread)
                        except (KeyError, ValueError):
                            continue
            except Exception as e:
                logger.warning("Binance WS error: %s — reconnecting in 5s", e)
                await asyncio.sleep(5)

    # ------------------------------------------------------------------
    # Queue & Redis helpers
    # ------------------------------------------------------------------

    def _enqueue(self, tick: dict):
        try:
            self._tick_queue.put_nowait(tick)
        except asyncio.QueueFull:
            try:
                self._tick_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            self._tick_queue.put_nowait(tick)

    async def _publish_redis(self, tick: dict, spread: float):
        try:
            tick_json = json.dumps(tick)
            price_json = json.dumps({
                "bid": tick["bid"],
                "ask": tick["ask"],
                "timestamp": tick["timestamp"],
                "spread": round(spread, 8),
            })

            await redis_client.publish("ticks:all", tick_json)
            await redis_client.hset("prices", tick["symbol"], price_json)
        except Exception as exc:
            logger.warning("Redis publish failed for %s: %s", tick["symbol"], exc)
