"""Deep historical OHLC backfill for ALL active instruments.

Pulls maximum-depth candle history from the providers and upserts it into
the durable `ohlc_bars` table (main Postgres) that the chart's /bars
endpoint reads. Idempotent — re-running only fills gaps (PK symbol,tf,ts).

Sources:
  - Crypto (Binance-listed): Binance public REST klines — keyless, deep.
  - Everything else: Infoway batch_kline REST (paid plan), paged backwards
    with the `timestamp` cursor (intraday only; 1d = one 500-bar batch).

Run inside the gateway container (has DB env + packages.common):
    docker cp backend/ops-scripts/backfill_history.py powertradefx-gateway-1:/tmp/
    docker exec powertradefx-gateway-1 python /tmp/backfill_history.py
"""
import asyncio
import logging
import time

import httpx
from sqlalchemy import text

from packages.common.src import bars_store, infoway_history
from packages.common.src.config import get_settings
from packages.common.src.database import AsyncSessionLocal

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s %(message)s")
logger = logging.getLogger("backfill")

# Newer crypto listings + alt oil/gas codes that the baked-in maps may lack.
infoway_history._CRYPTO_CODES.setdefault("ADAUSD", "ADAUSDT")
infoway_history._CRYPTO_CODES.setdefault("BNBUSD", "BNBUSDT")
infoway_history._CRYPTO_CODES.setdefault("DOGEUSD", "DOGEUSDT")
infoway_history._CRYPTO_SET = set(infoway_history._CRYPTO_CODES.keys())

BINANCE_PAIRS = {
    "BTCUSD": "BTCUSDT", "ETHUSD": "ETHUSDT", "LTCUSD": "LTCUSDT",
    "XRPUSD": "XRPUSDT", "SOLUSD": "SOLUSDT", "ADAUSD": "ADAUSDT",
    "BNBUSD": "BNBUSDT", "DOGEUSD": "DOGEUSDT",
}
_BINANCE_TF = {"1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
               "1h": "1h", "4h": "4h", "1d": "1d"}

# Per-timeframe depth targets (bars). Providers run dry earlier for some
# symbols — the pager stops as soon as a page returns nothing new.
TARGETS = {"1m": 3000, "5m": 5000, "15m": 5000, "30m": 5000,
           "1h": 10000, "4h": 5000, "1d": 500}

# Symbols whose Infoway history code may differ from the live-stream code.
# Tried in order until a page returns data; the winner is cached.
ALT_CODES = {
    "UKOIL": ["UKOIL", "XBRUSD", "BRNUSD"],
    "NATGAS": ["NATGAS", "XNGUSD", "NGAS"],
    "USOIL": ["XTIUSD", "USOIL", "WTIUSD"],
}

INFOWAY_SLEEP = 0.15   # be polite to the paid API
BINANCE_SLEEP = 0.25


async def _binance_page(cl: httpx.AsyncClient, pair: str, tf: str, end_ms: int | None) -> list[dict]:
    params = {"symbol": pair, "interval": _BINANCE_TF[tf], "limit": 1000}
    if end_ms:
        params["endTime"] = end_ms
    r = await cl.get("https://api.binance.com/api/v3/klines", params=params)
    if r.status_code != 200:
        logger.warning("binance HTTP %s for %s %s", r.status_code, pair, tf)
        return []
    return [{"time": int(k[0]) // 1000, "open": float(k[1]), "high": float(k[2]),
             "low": float(k[3]), "close": float(k[4]), "volume": float(k[5])}
            for k in r.json()]


async def _collect_binance(cl: httpx.AsyncClient, sym: str, tf: str, target: int) -> list[dict]:
    pair = BINANCE_PAIRS[sym]
    collected: dict[int, dict] = {}
    end_ms: int | None = None
    while len(collected) < target:
        batch = await _binance_page(cl, pair, tf, end_ms)
        new = sum(1 for b in batch if b["time"] not in collected)
        for b in batch:
            collected.setdefault(b["time"], b)
        if not batch or new == 0:
            break
        end_ms = (min(b["time"] for b in batch) - 1) * 1000
        await asyncio.sleep(BINANCE_SLEEP)
    return [collected[t] for t in sorted(collected)]


async def _collect_infoway(cl: httpx.AsyncClient, api_key: str, sym: str, tf: str, target: int) -> list[dict]:
    # Resolve a working history code once per symbol (some products use
    # different codes on the history API than on the stream).
    candidates = ALT_CODES.get(sym, [sym])
    collected: dict[int, dict] = {}
    cursor: int | None = None
    code_locked = False
    for code in candidates:
        infoway_history._ALIAS_CODES[sym] = code
        batch = await infoway_history.fetch_infoway_klines(api_key, sym, tf, count=500, client=cl)
        await asyncio.sleep(INFOWAY_SLEEP)
        if batch:
            code_locked = True
            for b in batch:
                collected.setdefault(b["time"], b)
            cursor = min(b["time"] for b in batch) - 1
            break
    if not code_locked:
        return []
    supports_cursor = tf != "1d"
    while supports_cursor and len(collected) < target:
        batch = await infoway_history.fetch_infoway_klines(api_key, sym, tf, count=500, end_ts=cursor, client=cl)
        await asyncio.sleep(INFOWAY_SLEEP)
        new = sum(1 for b in batch if b["time"] not in collected)
        for b in batch:
            collected.setdefault(b["time"], b)
        if not batch or new == 0:
            break
        cursor = min(b["time"] for b in batch) - 1
    return [collected[t] for t in sorted(collected)]


async def main() -> None:
    settings = get_settings()
    api_key = (getattr(settings, "INFOWAY_API_KEY", "") or "").strip()
    if not api_key:
        logger.error("INFOWAY_API_KEY not set — aborting")
        return

    async with AsyncSessionLocal() as db:
        await bars_store.ensure_bars_table(db)
        await db.commit()
        rows = await db.execute(text("SELECT symbol FROM instruments WHERE is_active = true ORDER BY symbol"))
        symbols = [r[0].upper() for r in rows]

    logger.info("Backfilling %d symbols x %d timeframes", len(symbols), len(TARGETS))
    t0 = time.monotonic()
    grand_total = 0
    empty: list[str] = []

    async with httpx.AsyncClient(timeout=25.0) as cl:
        for i, sym in enumerate(symbols, 1):
            sym_total = 0
            for tf, target in TARGETS.items():
                try:
                    if sym in BINANCE_PAIRS:
                        bars = await _collect_binance(cl, sym, tf, target)
                    else:
                        bars = await _collect_infoway(cl, api_key, sym, tf, target)
                    if not bars:
                        continue
                    bars = bars_store.grid_snap(bars, bars_store.TF_SECONDS[tf])
                    async with AsyncSessionLocal() as db:
                        n = await bars_store.upsert_bars(db, sym, tf, bars)
                        await db.commit()
                    sym_total += n
                    logger.info("[%d/%d] %s %s: %d bars (span %.1f days)",
                                i, len(symbols), sym, tf, n,
                                (bars[-1]["time"] - bars[0]["time"]) / 86400 if len(bars) > 1 else 0)
                except Exception as e:
                    logger.warning("[%d/%d] %s %s FAILED: %s", i, len(symbols), sym, tf, e)
            if sym_total == 0:
                empty.append(sym)
            grand_total += sym_total

    logger.info("DONE: %d bars upserted across %d symbols in %.0fs. No data for: %s",
                grand_total, len(symbols), time.monotonic() - t0,
                ", ".join(empty) if empty else "none")


if __name__ == "__main__":
    asyncio.run(main())
