"""Trading Catalog Service — Public instrument catalog with effective charges."""
import json
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from packages.common.src.models import Instrument, InstrumentConfig, InstrumentSegment
from packages.common.src.instrument_pricing import (
    resolve_spread_config,
    resolve_commission,
)
from packages.common.src.redis_client import redis_client, PriceChannel
from packages.common.src.price_cache import price_cache


async def _mid_price(symbol: str) -> Decimal:
    raw = await price_cache.get(symbol)
    if not raw:
        return Decimal("1")
    t = json.loads(raw)
    return (Decimal(str(t["bid"])) + Decimal(str(t["ask"]))) / Decimal("2")


# The public catalog is the same for every visitor: serve it from a short
# in-process cache (QA 2026-09-29: ~4.5 req/s, several queries per
# instrument). Admin config edits show within CATALOG_TTL seconds.
CATALOG_TTL = 30.0
_catalog_cache: dict = {}


async def list_trading_instruments(segment: str | None, db: AsyncSession) -> list[dict]:
    import time as _time
    key = (segment or "").lower()
    hit = _catalog_cache.get(key)
    if hit is not None and _time.monotonic() - hit[0] < CATALOG_TTL:
        return hit[1]
    out = await _build_catalog(segment, db)
    _catalog_cache[key] = (_time.monotonic(), out)
    return out


async def _build_catalog(segment: str | None, db: AsyncSession) -> list[dict]:
    q = (
        select(Instrument)
        .where(Instrument.is_active == True)
        .options(selectinload(Instrument.segment))
        .order_by(Instrument.symbol)
    )
    if segment:
        q = q.join(InstrumentSegment, Instrument.segment_id == InstrumentSegment.id).where(
            InstrumentSegment.name == segment.lower()
        )
    r = await db.execute(q)
    rows = r.scalars().unique().all()

    # One query for every instrument's config instead of one per instrument.
    ics = {}
    if rows:
        ics = {
            c.instrument_id: c for c in (await db.execute(
                select(InstrumentConfig).where(InstrumentConfig.instrument_id.in_([i.id for i in rows]))
            )).scalars().all()
        }

    out = []
    for inst in rows:
        ic = ics.get(inst.id)
        if ic and ic.is_enabled is False:
            continue

        sv, st, pimp = await resolve_spread_config(db, inst)
        mid = await _mid_price(inst.symbol)
        # Catalog preview shows the rack rate; tier and XP discount apply at order time.
        comm = await resolve_commission(db, inst, Decimal("1"), mid, apply_xp_discount=False)

        out.append(
            {
                "id": str(inst.id),
                "symbol": inst.symbol,
                "display_name": inst.display_name,
                "segment": inst.segment.name if inst.segment else None,
                "digits": inst.digits,
                "pip_size": float(inst.pip_size or 0),
                "min_lot": float(ic.min_lot_size) if ic and ic.min_lot_size is not None else float(inst.min_lot or 0),
                "max_lot": float(ic.max_lot_size) if ic and ic.max_lot_size is not None else float(inst.max_lot or 0),
                "contract_size": float(inst.contract_size or 0),
                "spread": {"type": st, "value": float(sv), "price_impact": float(pimp)},
                "commission_preview_per_lot": float(comm),
                "swap_free": bool(ic.swap_free) if ic else False,
            }
        )
    return out


async def get_trading_instrument(symbol: str, db: AsyncSession) -> dict:
    r = await db.execute(
        select(Instrument)
        .where(Instrument.symbol == symbol.upper(), Instrument.is_active == True)
        .options(selectinload(Instrument.segment))
    )
    inst = r.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")

    ic_r = await db.execute(select(InstrumentConfig).where(InstrumentConfig.instrument_id == inst.id))
    ic = ic_r.scalar_one_or_none()
    if ic and ic.is_enabled is False:
        raise HTTPException(status_code=404, detail="Instrument not available")

    sv, st, pimp = await resolve_spread_config(db, inst)
    mid = await _mid_price(inst.symbol)
    comm = await resolve_commission(db, inst, Decimal("1"), mid)
    return {
        "id": str(inst.id),
        "symbol": inst.symbol,
        "display_name": inst.display_name,
        "segment": inst.segment.name if inst.segment else None,
        "digits": inst.digits,
        "pip_size": float(inst.pip_size or 0),
        "min_lot": float(ic.min_lot_size) if ic and ic.min_lot_size is not None else float(inst.min_lot or 0),
        "max_lot": float(ic.max_lot_size) if ic and ic.max_lot_size is not None else float(inst.max_lot or 0),
        "contract_size": float(inst.contract_size or 0),
        "spread": {"type": st, "value": float(sv), "price_impact": float(pimp)},
        "commission_preview_per_lot": float(comm),
        "swap_long": float(ic.swap_long) if ic else None,
        "swap_short": float(ic.swap_short) if ic else None,
        "swap_free": bool(ic.swap_free) if ic else False,
    }
