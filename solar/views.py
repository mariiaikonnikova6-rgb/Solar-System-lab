from __future__ import annotations

import math
import random
from datetime import date, datetime

from django.db.models import Q
from django.http import Http404
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from .models import SmallBody
from .orbits import OrbitalElements, julian_day_from_date, position_au
from .serializers import SmallBodyExploreSerializer, SmallBodySerializer


def _parse_category(raw: str | None) -> str:
    raw = (raw or "any").lower().strip()
    allowed = {"neo", "mainbelt", "trojan", "comet", "any"}
    if raw not in allowed:
        return "any"
    return raw


def _filter_by_category(qs, category: str):
    if category == "any":
        return qs
    return qs.filter(category=category)


@api_view(["GET"])
def random_object(request: Request) -> Response:
    category = _parse_category(request.query_params.get("category"))
    qs = _filter_by_category(SmallBody.objects.all(), category)
    if not qs.exists():
        return Response({"detail": "No objects in this category. Import dataset first.", "missing": True})
    max_id = qs.order_by("-id").values_list("id", flat=True).first()
    obj = None
    for _ in range(32):
        rid = random.randint(1, max_id)
        obj = qs.filter(id__gte=rid).order_by("id").first()
        if obj:
            break
    if not obj:
        obj = qs.order_by("id").first()
    return Response(SmallBodySerializer(obj).data)


@api_view(["GET"])
def search(request: Request) -> Response:
    q = (request.query_params.get("q") or "").strip()
    if not q:
        return Response({"results": []})
    qs = SmallBody.objects.filter(Q(name__icontains=q) | Q(spkid__icontains=q)).order_by("name")[:50]
    return Response({"results": SmallBodyExploreSerializer(qs, many=True).data})


def _get_object_or_404(id: str) -> SmallBody:
    raw = (id or "").strip()
    if not raw:
        raise Http404

    qs = SmallBody.objects.all()
    q = Q(spkid=raw) | Q(name__iexact=raw)

    if raw.isdigit():
        q = q | Q(pk=int(raw))

    try:
        return qs.get(q)
    except (SmallBody.DoesNotExist, ValueError) as exc:
        raise Http404 from exc


@api_view(["GET"])
def object_detail(request: Request, id: str) -> Response:
    obj = _get_object_or_404(id)
    return Response(SmallBodySerializer(obj).data)


def _parse_step(raw: str) -> float:
    raw = (raw or "1d").strip().lower()
    if raw.endswith("d"):
        return float(raw[:-1])
    if raw.endswith("h"):
        return float(raw[:-1]) / 24.0
    return float(raw)


@api_view(["GET"])
def ephemeris(request: Request, id: str) -> Response:
    obj = _get_object_or_404(id)

    start_s = request.query_params.get("start")
    stop_s = request.query_params.get("stop")
    step_s = request.query_params.get("step", "1d")
    if not start_s or not stop_s:
        return Response({"detail": "start and stop are required (YYYY-MM-DD)."}, status=400)

    start = date.fromisoformat(start_s)
    stop = date.fromisoformat(stop_s)
    step_days = max(0.25, _parse_step(step_s))
    if stop < start:
        start, stop = stop, start

    start_jd = julian_day_from_date(start)
    stop_jd = julian_day_from_date(stop)

    elements = OrbitalElements(
        a=obj.a,
        e=obj.e,
        i_deg=obj.i,
        Omega_deg=obj.Omega_node,
        omega_deg=obj.omega,
        M0_rad=obj.M0,
        epoch_jd=julian_day_from_date(obj.epoch),
    )

    points = []
    t = start_jd
    max_points = 5000
    while t <= stop_jd and len(points) < max_points:
        x, y, z = position_au(elements, t, mu=1.0)
        points.append({"jd": t, "x": x, "y": y, "z": z})
        t += step_days

    return Response(
        {
            "object": SmallBodySerializer(obj).data,
            "start": start.isoformat(),
            "stop": stop.isoformat(),
            "step_days": step_days,
            "points": points,
        }
    )


@api_view(["GET"])
def explore_sample(request: Request) -> Response:
    limit = int(request.query_params.get("limit", "5000"))
    limit = max(100, min(20000, limit))
    layers = (request.query_params.get("layers") or "mainbelt,neo,trojan,comet").lower()
    wanted = {x.strip() for x in layers.split(",") if x.strip()}
    allowed = {"mainbelt", "neo", "trojan", "comet"}
    wanted = wanted & allowed
    qs = SmallBody.objects.all()
    if wanted:
        qs = qs.filter(category__in=sorted(wanted))
    count = qs.count()
    if count == 0:
        return Response({"objects": [], "detail": "No objects in DB. Run import_dataset."})
    if count <= limit:
        chosen = list(qs[:limit])
        return Response({"objects": SmallBodyExploreSerializer(chosen, many=True).data, "count": len(chosen)})

    # Fast-ish random sample using id range. Good enough for demo.
    max_id = qs.order_by("-id").values_list("id", flat=True).first()
    chosen = []
    tries = 0
    chosen_ids = set()
    while len(chosen) < limit and tries < limit * 25:
        tries += 1
        rid = random.randint(1, max_id)
        obj = qs.filter(id__gte=rid).order_by("id").first()
        if not obj:
            continue
        if obj.id in chosen_ids:
            continue
        chosen_ids.add(obj.id)
        chosen.append(obj)
    if len(chosen) < limit:
        needed = limit - len(chosen)
        filler = list(qs.exclude(id__in=chosen_ids).order_by("id")[:needed])
        chosen.extend(filler)
    return Response({"objects": SmallBodyExploreSerializer(chosen, many=True).data, "count": len(chosen)})


@api_view(["GET"])
def stats(request: Request) -> Response:
    by_cat = {
        c: SmallBody.objects.filter(category=c).count()
        for c in ["mainbelt", "neo", "trojan", "comet", "other"]
    }
    return Response({"counts": by_cat, "total": sum(by_cat.values())})
