"""Pending-order rules shared by the gateway (placement / modify validation)
and the b-book matching engine (trigger + fill).

Keeping both sides in ONE pure module is the point: the 2026-09-28 QA run
found that placement validated a limit price against the quote while modify
did not (a pending limit could be edited into an immediate market fill), and
that the engine's stop-limit trigger required a condition the validator made
impossible (stop-limit orders could never fill). Every rule below is
side-by-side with its counterpart, and `evaluate_trigger` is pure so it can
be unit-tested without Redis or Postgres.

Semantics (MT5-style):
  buy limit    rests below the ask;  fills when ask <= price, AT the limit price
  sell limit   rests above the bid;  fills when bid >= price, AT the limit price
  buy stop     rests above the ask;  fills when ask >= price, at market (ask)
  sell stop    rests below the bid;  fills when bid <= price, at market (bid)
  stop-limit   stop price as above; when it triggers the order becomes a
               resting LIMIT at stop_limit_price (buy: limit below the stop,
               sell: limit above the stop) and fills under the limit rules.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional


class PendingOrderError(ValueError):
    """Validation failure; `str(exc)` is the user-facing message."""


def _norm(v) -> str:
    return (v.value if hasattr(v, "value") else str(v or "")).lower()


def validate_pending_price(
    order_type,
    side,
    price: Optional[Decimal],
    stop_limit_price: Optional[Decimal],
    bid: Decimal,
    ask: Decimal,
) -> None:
    """Raise PendingOrderError unless (price, stop_limit_price) is a valid
    resting level for this order type/side against the current quote."""
    ot, sd = _norm(order_type), _norm(side)
    if ot == "market":
        return
    if price is None or Decimal(str(price)) <= 0:
        raise PendingOrderError("Price required for pending orders")
    px = Decimal(str(price))

    if ot == "limit":
        if sd == "buy" and px >= ask:
            raise PendingOrderError(
                f"Buy limit must be below the current ask ({ask}). To buy at market, use a market order."
            )
        if sd == "sell" and px <= bid:
            raise PendingOrderError(
                f"Sell limit must be above the current bid ({bid}). To sell at market, use a market order."
            )
    elif ot == "stop":
        if sd == "buy" and px <= ask:
            raise PendingOrderError(f"Buy stop must be above the current ask ({ask}).")
        if sd == "sell" and px >= bid:
            raise PendingOrderError(f"Sell stop must be below the current bid ({bid}).")
    elif ot == "stop_limit":
        if stop_limit_price is None or Decimal(str(stop_limit_price)) <= 0:
            raise PendingOrderError("stop_limit_price required for stop-limit orders")
        slp = Decimal(str(stop_limit_price))
        if sd == "buy":
            if px <= ask:
                raise PendingOrderError(f"Buy stop price must be above the current ask ({ask}).")
            if slp >= px:
                raise PendingOrderError("Buy stop-limit: limit price must be below the stop price.")
        else:
            if px >= bid:
                raise PendingOrderError(f"Sell stop price must be below the current bid ({bid}).")
            if slp <= px:
                raise PendingOrderError("Sell stop-limit: limit price must be above the stop price.")
    else:
        raise PendingOrderError(f"Unknown order type '{ot}'")


@dataclass(frozen=True)
class TriggerDecision:
    """What the engine should do with a pending order on this tick."""
    fill_price: Optional[Decimal] = None      # set → execute now at this price
    convert_to_limit: Optional[Decimal] = None  # set → stop-limit became a limit at this price

    @property
    def triggered(self) -> bool:
        return self.fill_price is not None


def evaluate_trigger(
    order_type,
    side,
    price: Decimal,
    stop_limit_price: Optional[Decimal],
    bid: Decimal,
    ask: Decimal,
) -> TriggerDecision:
    """Pure trigger/fill rule for one tick. Never raises on odd input; an
    unknown type simply does nothing."""
    ot, sd = _norm(order_type), _norm(side)
    price = Decimal(str(price))

    if ot == "limit":
        if sd == "buy" and ask <= price:
            return TriggerDecision(fill_price=price)
        if sd == "sell" and bid >= price:
            return TriggerDecision(fill_price=price)
    elif ot == "stop":
        if sd == "buy" and ask >= price:
            return TriggerDecision(fill_price=ask)
        if sd == "sell" and bid <= price:
            return TriggerDecision(fill_price=bid)
    elif ot == "stop_limit" and stop_limit_price is not None:
        slp = Decimal(str(stop_limit_price))
        if sd == "buy" and ask >= price:
            # Stop hit → becomes a buy limit at slp. If the same tick is
            # already at/below the limit, fill straight away at the limit.
            if ask <= slp:
                return TriggerDecision(fill_price=slp)
            return TriggerDecision(convert_to_limit=slp)
        if sd == "sell" and bid <= price:
            if bid >= slp:
                return TriggerDecision(fill_price=slp)
            return TriggerDecision(convert_to_limit=slp)
    return TriggerDecision()
