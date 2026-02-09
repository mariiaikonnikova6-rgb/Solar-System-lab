from __future__ import annotations

import csv
import hashlib
import math
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from solar.models import SmallBody


DATASET_DEFAULT = Path(r"D:\MAN\dataset\dataset_3\dataset.csv")


def _float(v: str | None) -> float | None:
    if v is None:
        return None
    v = str(v).strip().strip('"')
    if v == "" or v.lower() == "nan":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _category_from_row(row: dict[str, str]) -> str:
    neo_flag = (row.get("neo") or "").strip().upper() == "Y"
    cls = (row.get("class") or "").strip().upper()
    if neo_flag or cls in {"APO", "AMO", "ATE", "IEO"}:
        return SmallBody.Category.NEO
    if cls in {"TJN"}:
        return SmallBody.Category.TROJAN
    if "MB" in cls or cls in {"MBA", "IMB", "OMB", "MCA"}:
        return SmallBody.Category.MAINBELT
    return SmallBody.Category.OTHER


def _deterministic_m0(spkid: str) -> float:
    h = hashlib.sha256(spkid.encode("utf-8")).digest()
    u = int.from_bytes(h[:8], "big") / 2**64
    return float(u * 2 * math.pi)


@dataclass(frozen=True)
class _Parsed:
    name: str
    spkid: str
    category: str
    H: float | None
    epoch: date
    e: float
    a: float
    q: float | None
    Q: float | None
    i: float
    Omega: float
    omega: float
    period_days: float | None
    M0: float


def _parse_row(row: dict[str, str]) -> _Parsed | None:
    spkid = (row.get("pdes") or "").strip()
    name = (row.get("full_name") or spkid).strip()
    if not spkid:
        return None

    epoch_s = (row.get("epoch_cal") or "").strip()
    if epoch_s.endswith(".0"):
        epoch_s = epoch_s[:-2]
    if not epoch_s:
        return None
    try:
        epoch = date.fromisoformat(epoch_s)
    except ValueError:
        return None

    e = _float(row.get("e"))
    a = _float(row.get("a"))
    i = _float(row.get("i"))
    Omega = _float(row.get("om"))
    omega = _float(row.get("w"))
    if e is None or a is None or i is None or Omega is None or omega is None:
        return None

    H = _float(row.get("H"))
    q = _float(row.get("q"))
    Q = _float(row.get("ad"))
    per_y = _float(row.get("per_y"))
    period_days = per_y * 365.25 if per_y is not None else None

    category = _category_from_row(row)
    return _Parsed(
        name=name,
        spkid=spkid,
        category=category,
        H=H,
        epoch=epoch,
        e=float(e),
        a=float(a),
        q=q,
        Q=Q,
        i=float(i),
        Omega=float(Omega),
        omega=float(omega),
        period_days=period_days,
        M0=_deterministic_m0(spkid),
    )


class Command(BaseCommand):
    help = "Import NASA/JPL small-body dataset CSV into SQLite."

    def add_arguments(self, parser):
        parser.add_argument("--path", type=str, default=str(DATASET_DEFAULT))
        parser.add_argument("--limit", type=int, default=20000, help="Max rows to import; use 0 for no limit.")
        parser.add_argument("--offset", type=int, default=0)
        parser.add_argument("--chunk", type=int, default=2000)

    def handle(self, *args, **opts):
        path = Path(opts["path"])
        limit = int(opts["limit"])
        offset = int(opts["offset"])
        chunk = int(opts["chunk"])
        if not path.exists():
            self.stderr.write(f"Dataset not found: {path}")
            return

        if limit < 0:
            self.stderr.write("--limit must be >= 0")
            return

        limit_label = "all" if limit == 0 else str(limit)
        self.stdout.write(f"Importing from {path} (offset={offset}, limit={limit_label})")
        created = 0
        updated = 0
        batch: list[SmallBody] = []
        seen = 0
        with path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if seen < offset:
                    seen += 1
                    continue
                if limit != 0 and (created + updated) >= limit:
                    break
                parsed = _parse_row(row)
                seen += 1
                if not parsed:
                    continue

                obj = SmallBody(
                    name=parsed.name,
                    spkid=parsed.spkid,
                    category=parsed.category,
                    a=parsed.a,
                    e=parsed.e,
                    i=parsed.i,
                    Omega_node=parsed.Omega,
                    omega=parsed.omega,
                    M0=parsed.M0,
                    epoch=parsed.epoch,
                    H=parsed.H,
                    q_peri=parsed.q,
                    Q_aph=parsed.Q,
                    period=parsed.period_days,
                )
                batch.append(obj)

                if len(batch) >= chunk:
                    c, u = self._flush(batch)
                    created += c
                    updated += u
                    batch.clear()
                    if limit == 0:
                        self.stdout.write(f"... imported {created+updated}/all")
                    else:
                        self.stdout.write(f"... imported {created+updated}/{limit}")

        if batch:
            c, u = self._flush(batch)
            created += c
            updated += u
        self.stdout.write(self.style.SUCCESS(f"Done. created={created} updated={updated}"))

    @transaction.atomic
    def _flush(self, batch: list[SmallBody]) -> tuple[int, int]:
        spkids = [b.spkid for b in batch]
        existing = {o.spkid: o for o in SmallBody.objects.filter(spkid__in=spkids)}
        to_create: list[SmallBody] = []
        to_update: list[SmallBody] = []
        for b in batch:
            ex = existing.get(b.spkid)
            if not ex:
                to_create.append(b)
                continue
            ex.name = b.name
            ex.category = b.category
            ex.a = b.a
            ex.e = b.e
            ex.i = b.i
            ex.Omega_node = b.Omega_node
            ex.omega = b.omega
            ex.M0 = b.M0
            ex.epoch = b.epoch
            ex.H = b.H
            ex.q_peri = b.q_peri
            ex.Q_aph = b.Q_aph
            ex.period = b.period
            to_update.append(ex)

        if to_create:
            SmallBody.objects.bulk_create(to_create, ignore_conflicts=True)
        if to_update:
            SmallBody.objects.bulk_update(
                to_update,
                ["name", "category", "a", "e", "i", "Omega_node", "omega", "M0", "epoch", "H", "q_peri", "Q_aph", "period"],
            )
        return (len(to_create), len(to_update))
