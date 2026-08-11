"""IB Commission Engine — thin re-export of the shared distributor.

The distribution logic now lives in ``packages.common.src.ib_commission`` so
that BOTH the gateway (market orders, copy trades) and the b-book engine
(pending-order fills) pay the IB chain through one identical code path.
Existing call-sites import from here, so this module just re-exports.
"""
from packages.common.src.ib_commission import (
    DEFAULT_MLM_DISTRIBUTION,
    get_mlm_distribution,
    distribute_ib_commission,
    _get_parent_ib,
)

__all__ = [
    "DEFAULT_MLM_DISTRIBUTION",
    "get_mlm_distribution",
    "distribute_ib_commission",
    "_get_parent_ib",
]
