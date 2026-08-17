# Ops scripts (one-off / incident tooling)

These scripts used to live inside `backend/services/gateway/src/`, which
meant they shipped in the production gateway image — including
`wipe_copy_trade.py`, a **destructive** full reset of the copy-trade
subsystem that anyone with `docker exec` on the container could run.
They were moved here so they are never baked into an image.

They import only `packages.common` (no gateway internals), so they run
anywhere the shared library is importable and `DATABASE_URL`/`REDIS_URL`
point at the target stack:

```bash
cd /opt/powertradefx/backend
set -a; . ../.env; set +a
PYTHONPATH=. python ops-scripts/diagnose_copy.py
```

`wipe_copy_trade.py` is dry-run by default; pass `--execute` only after
reading its docstring and taking a fresh backup (`scripts/backup.sh`).

Note: the module invocations mentioned in older docstrings
(`python -m services.gateway.src.<name>`) no longer work — the files are
not part of the gateway package anymore.
