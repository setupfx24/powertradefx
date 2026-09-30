"""SL/TP trigger and fill rules (sltp_engine.SLTPEngine._trigger).

TRIGGER on the MID, never the spread-adjusted bid/ask: a wide spread (e.g. an
admin widening it while the market never moved) must not close a trade — the
"admin set a big spread and the trade auto-closed" report.

FILL at the level when the level is inside the current quote; through a GAP at
the side's real market price (QA 2026-09-29: filling a gapped stop at the SL
level made the broker absorb the gap).
"""
import unittest
from decimal import Decimal as D

from services.gateway.src.engines.sltp_engine import SLTPEngine

T = SLTPEngine._trigger


class SltpTriggerTests(unittest.TestCase):
    def test_wide_spread_below_sl_does_not_trigger_when_mid_above(self):
        # BUY SL 4284; bid 4283 below it but mid 4285 above: no real move.
        self.assertEqual(T("buy", D("4284"), None, D("4283"), D("4287")), (None, None))

    def test_mid_crossing_sl_triggers_and_closes_at_sl(self):
        # Mid 4283.95 <= SL, level inside the quote -> closes at the level.
        self.assertEqual(T("buy", D("4284"), None, D("4283.90"), D("4284.00")), ("sl", D("4284")))

    def test_wide_spread_above_tp_does_not_trigger_when_mid_below(self):
        self.assertEqual(T("buy", None, D("4290"), D("4291"), D("4285")), (None, None))

    def test_gap_through_buy_sl_fills_at_bid(self):
        # Market gapped from above 4284 to 4270/4271: fill at the real bid.
        self.assertEqual(T("buy", D("4284"), None, D("4270"), D("4271")), ("sl", D("4270")))

    def test_gap_through_sell_sl_fills_at_ask(self):
        self.assertEqual(T("sell", D("1.1000"), None, D("1.1050"), D("1.1052")), ("sl", D("1.1052")))

    def test_gap_through_buy_tp_fills_at_better_bid(self):
        self.assertEqual(T("buy", None, D("100"), D("105"), D("105.2")), ("tp", D("105")))

    def test_sell_tp_inside_quote_fills_at_level(self):
        self.assertEqual(T("sell", None, D("50.00"), D("49.99"), D("50.01")), ("tp", D("50.00")))

    def test_sl_takes_precedence_and_directions_are_not_inverted(self):
        # A sell whose price ROSE through its SL is a loss, never a TP.
        reason, px = T("sell", D("10"), D("5"), D("10.5"), D("10.6"))
        self.assertEqual(reason, "sl")
        self.assertEqual(px, D("10.6"))


if __name__ == "__main__":
    unittest.main()
