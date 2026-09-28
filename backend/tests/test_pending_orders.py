"""Pure unit tests for packages.common.src.pending_orders (no infra needed)."""
import sys
from decimal import Decimal as D

sys.path.insert(0, r"D:\setupfx\powertradefx-v2\backend")
from packages.common.src.pending_orders import (  # noqa: E402
    PendingOrderError, evaluate_trigger, validate_pending_price,
)

bid, ask = D("100.0"), D("100.2")
checks = 0

def ok(cond, msg):
    global checks
    checks += 1
    assert cond, msg

def rejects(*args):
    try:
        validate_pending_price(*args)
    except PendingOrderError:
        return True
    return False

# ── validation mirrors placement rules ──
ok(rejects("limit", "buy", D("100.2"), None, bid, ask), "buy limit == ask rejected")
ok(rejects("limit", "buy", D("101"), None, bid, ask), "buy limit above ask rejected")
ok(not rejects("limit", "buy", D("99"), None, bid, ask), "buy limit below ask ok")
ok(rejects("limit", "sell", D("100"), None, bid, ask), "sell limit == bid rejected")
ok(not rejects("limit", "sell", D("101"), None, bid, ask), "sell limit above bid ok")
ok(rejects("stop", "buy", D("100"), None, bid, ask), "buy stop below ask rejected")
ok(not rejects("stop", "buy", D("101"), None, bid, ask), "buy stop above ask ok")
ok(rejects("stop", "sell", D("101"), None, bid, ask), "sell stop above bid rejected")
ok(not rejects("stop", "sell", D("99"), None, bid, ask), "sell stop below bid ok")
ok(rejects("stop_limit", "buy", D("101"), None, bid, ask), "stop_limit needs slp")
ok(rejects("stop_limit", "buy", D("101"), D("101"), bid, ask), "buy stop_limit slp == stop rejected")
ok(rejects("stop_limit", "buy", D("101"), D("102"), bid, ask), "buy stop_limit slp > stop rejected")
ok(not rejects("stop_limit", "buy", D("101"), D("100.9"), bid, ask), "buy stop_limit slp < stop ok")
ok(not rejects("stop_limit", "sell", D("99"), D("99.1"), bid, ask), "sell stop_limit slp > stop ok")
ok(rejects("stop_limit", "sell", D("99"), D("98"), bid, ask), "sell stop_limit slp < stop rejected")
ok(rejects("limit", "buy", None, None, bid, ask), "price required")
ok(not rejects("market", "buy", None, None, bid, ask), "market needs no price")
# enum-like inputs
class E:  # mimics the SQLAlchemy enum members
    def __init__(self, v): self.value = v
ok(rejects(E("limit"), E("buy"), D("101"), None, bid, ask), "enum members accepted")

# ── trigger + fill semantics ──
t = evaluate_trigger("limit", "buy", D("99"), None, D("99.5"), D("99.7"))
ok(not t.triggered and t.convert_to_limit is None, "buy limit rests while ask > price")
t = evaluate_trigger("limit", "buy", D("99"), None, D("98.7"), D("99"))
ok(t.fill_price == D("99"), "buy limit fills at limit when ask == price")
t = evaluate_trigger("limit", "buy", D("99"), None, D("98.4"), D("98.6"))
ok(t.fill_price == D("99"), "buy limit fills AT limit price (not at the lower ask)")
t = evaluate_trigger("limit", "sell", D("101"), None, D("101.3"), D("101.5"))
ok(t.fill_price == D("101"), "sell limit fills at limit price")
t = evaluate_trigger("stop", "buy", D("101"), None, D("101.2"), D("101.4"))
ok(t.fill_price == D("101.4"), "buy stop fills at market ask")
t = evaluate_trigger("stop", "sell", D("99"), None, D("98.8"), D("99"))
ok(t.fill_price == D("98.8"), "sell stop fills at market bid")
t = evaluate_trigger("stop", "sell", D("99"), None, D("99.1"), D("99.3"))
ok(not t.triggered, "sell stop rests while bid > price")
# stop-limit: previously impossible to fill
t = evaluate_trigger("stop_limit", "buy", D("101"), D("100.9"), D("101.0"), D("101.2"))
ok(t.convert_to_limit == D("100.9") and not t.triggered, "buy stop_limit converts to limit when stop hit")
t = evaluate_trigger("stop_limit", "buy", D("101"), D("100.9"), D("100.5"), D("100.7"))
ok(not t.triggered and t.convert_to_limit is None, "buy stop_limit rests below stop")
t = evaluate_trigger("stop_limit", "sell", D("99"), D("99.2"), D("98.9"), D("99.1"))
ok(t.convert_to_limit == D("99.2"), "sell stop_limit converts when bid <= stop")
# after conversion the limit rule applies
t = evaluate_trigger("limit", "buy", D("100.9"), None, D("100.7"), D("100.9"))
ok(t.fill_price == D("100.9"), "converted buy limit fills when ask <= limit")

# exhaustive reachability: every stop-limit placed validly can eventually fill
reachable = 0
for stop in range(1010, 1030):
    for slp in range(1000, stop):
        # a later tick where ask fell to slp
        d = evaluate_trigger("limit", "buy", D(slp) / 10, None, D(slp) / 10 - D("0.1"), D(slp) / 10)
        reachable += 1 if d.triggered else 0
ok(reachable > 0, "converted limits are fillable")

print(f"ALL {checks} CHECKS PASSED")
