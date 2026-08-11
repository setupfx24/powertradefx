"""Load admin spread settings and widen mid prices for Redis/WebSocket quotes."""

from __future__ import annotations

import asyncio
import logging
import time
from decimal import Decimal
from typing import Dict, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.instrument_pricing import resolve_spread_config, symmetric_quote_from_mid
from packages.common.src.models import Instrument, SpreadConfig

logger = logging.getLogger("market-data.spread-cache")

# How often to reload spread params from Postgres (admin edits).
RELOAD_INTERVAL_SEC = 30.0

# No hardcoded fallback spread. The rule is deliberate:
#   • admin configured a spread (per-instrument / segment / default) → apply it
#   • admin configured nothing                                       → 0 spread
#     (Buy == Sell). Every currency ships with a 0 default until an admin sets
#     one. The platform never invents a spread the admin didn't set.


class StreamSpreadCache:
    """symbol -> (spread_value, spread_type, pip_size, digits).

    Streamed bid/ask use spread_configs only; instrument_configs.price_impact is not
    mixed into quotes (fills and display both use these Redis ticks).
    """

    def __init__(self) -> None:
        self._params: Dict[str, Tuple[Decimal, str, Decimal, int]] = {}
        self._default_spread: Tuple[Decimal, str] = (Decimal("0"), "pips")
        self._lock = asyncio.Lock()
        self._last_reload = 0.0

    async def reload_if_stale(self, force: bool = False) -> None:
        now = time.monotonic()
        if not force and (now - self._last_reload) < RELOAD_INTERVAL_SEC and self._params:
            return
        async with self._lock:
            now = time.monotonic()
            if not force and (now - self._last_reload) < RELOAD_INTERVAL_SEC and self._params:
                return
            try:
                async with AsyncSessionLocal() as db:
                    r = await db.execute(
                        select(Instrument)
                        .where(Instrument.is_active == True)
                        .options(selectinload(Instrument.segment))
                    )
                    rows = r.scalars().unique().all()
                    new: Dict[str, Tuple[Decimal, str, Decimal, int]] = {}
                    for inst in rows:
                        sv, st, _pimp = await resolve_spread_config(db, inst)
                        pip = Decimal(str(inst.pip_size or 0.0001))
                        digits = int(inst.digits or 5)
                        sym = (inst.symbol or "").strip().upper()
                        if sym:
                            new[sym] = (sv, st, pip, digits)
                    dr = await db.execute(
                        select(SpreadConfig.value, SpreadConfig.spread_type)
                        .where(
                            func.lower(SpreadConfig.scope) == "default",
                            SpreadConfig.is_enabled == True,
                            SpreadConfig.instrument_id.is_(None),
                            SpreadConfig.segment_id.is_(None),
                            SpreadConfig.user_id.is_(None),
                        )
                        .order_by(SpreadConfig.created_at.desc())
                        .limit(1)
                    )
                    drow = dr.first()
                    if drow:
                        self._default_spread = (
                            Decimal(str(drow[0] or 0)),
                            (drow[1] or "pips").lower(),
                        )
                    else:
                        self._default_spread = (Decimal("0"), "pips")
                    self._params = new
                    self._last_reload = time.monotonic()
                    logger.info(
                        "Reloaded stream spread params for %d instruments (default=%s %s)",
                        len(new),
                        self._default_spread[0],
                        self._default_spread[1],
                    )
            except Exception as exc:
                logger.warning("Spread cache reload failed: %s", exc)

    def widen(self, symbol: str, bid: float, ask: float) -> Tuple[float, float]:
        """Apply the admin spread when configured; otherwise return a 0 spread.

        Priority:
          1. Per-instrument / per-segment admin spread (``self._params[sym]`` > 0)
          2. Global admin "Default (All Instruments)" spread (``self._default_spread`` > 0)
          3. Neither set → 0 spread (bid == ask == mid).

        When an admin spread applies, the quote is rebuilt symmetrically around
        the feed mid so the provider's own spread is replaced (not stacked on
        top). When none applies, every instrument ships with a 0 default spread
        (Buy == Sell) until an admin configures one — there is no invented width.
        """
        from .feed_handler import INSTRUMENTS

        key = (symbol or "").strip().upper()
        mid = (bid + ask) / 2.0

        p: Optional[Tuple[Decimal, str, Decimal, int]] = self._params.get(key)
        if p:
            sv, st, pip, digits = p
        elif key in INSTRUMENTS:
            # Symbol streamed by the feed but missing/inactive in Postgres — it
            # has no per-instrument row, but a global admin default may still apply.
            info = INSTRUMENTS[key]
            sv, st = Decimal("0"), "pips"
            pip = Decimal(str(info["pip"]))
            digits = int(info["decimals"])
        else:
            # Unknown to both Postgres and the feed map — no digits to quantise
            # a clean mid, so pass the native feed through.
            return bid, ask

        # Resolve the effective admin spread: per-instrument first, then the
        # global default. A value of 0 at every scope means "admin set nothing".
        eff_sv, eff_st = sv, st
        if eff_sv <= 0 and self._default_spread[0] > 0:
            eff_sv, eff_st = self._default_spread

        if eff_sv > 0:
            b, a = symmetric_quote_from_mid(
                Decimal(str(mid)), eff_sv, eff_st, pip, digits, Decimal("0"),
            )
            return float(b), float(a)

        # No admin spread anywhere → 0 spread by default: collapse to the mid so
        # Buy == Sell until an admin sets a spread for this instrument (or the
        # global default). This is the platform's out-of-the-box state.
        m = round(mid, digits)
        return m, m
