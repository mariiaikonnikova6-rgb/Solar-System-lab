from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, datetime, timezone


def _to_julian_day(dt: datetime) -> float:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    year = dt.year
    month = dt.month
    day = dt.day + (dt.hour + (dt.minute + dt.second / 60) / 60) / 24
    if month <= 2:
        year -= 1
        month += 12
    a = year // 100
    b = 2 - a + (a // 4)
    jd = int(365.25 * (year + 4716)) + int(30.6001 * (month + 1)) + day + b - 1524.5
    return float(jd)


def julian_day_from_date(d: date) -> float:
    return _to_julian_day(datetime(d.year, d.month, d.day, tzinfo=timezone.utc))


@dataclass(frozen=True)
class OrbitalElements:
    a: float
    e: float
    i_deg: float
    Omega_deg: float
    omega_deg: float
    M0_rad: float
    epoch_jd: float


def solve_kepler(M: float, e: float, iters: int = 8) -> float:
    M = (M + math.pi) % (2 * math.pi) - math.pi
    if e < 0.8:
        E = M
    else:
        E = math.pi
    for _ in range(iters):
        f = E - e * math.sin(E) - M
        fp = 1 - e * math.cos(E)
        if fp == 0:
            break
        dE = -f / fp
        E += dE
        if abs(dE) < 1e-12:
            break
    return E


def position_au(elements: OrbitalElements, t_jd: float, mu: float = 1.0) -> tuple[float, float, float]:
    a = elements.a
    e = elements.e
    i = math.radians(elements.i_deg)
    Omega = math.radians(elements.Omega_deg)
    omega = math.radians(elements.omega_deg)

    dt_years = (t_jd - elements.epoch_jd) / 365.25
    n = math.sqrt(mu / (a**3))  # rad / year (in our normalized units)
    M = elements.M0_rad + n * dt_years
    E = solve_kepler(M, e)

    cosE = math.cos(E)
    sinE = math.sin(E)
    x_p = a * (cosE - e)
    y_p = a * math.sqrt(max(0.0, 1.0 - e * e)) * sinE

    cO, sO = math.cos(Omega), math.sin(Omega)
    co, so = math.cos(omega), math.sin(omega)
    ci, si = math.cos(i), math.sin(i)

    x1 = x_p * co - y_p * so
    y1 = x_p * so + y_p * co

    x2 = x1
    y2 = y1 * ci
    z2 = y1 * si

    x = x2 * cO - y2 * sO
    y = x2 * sO + y2 * cO
    z = z2
    return (x, y, z)

