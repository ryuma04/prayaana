"""Day route + time optimizer: vehicle routing with time windows on Google OR-Tools.

One vehicle (the group's cab) leaves the start (hotel), visits the stops inside their
opening windows, and returns. Required stops must be visited; optional ones may be dropped.
If no plan fits, the response says why instead of inventing one.
"""
from __future__ import annotations

import math
import time

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from .schemas import Dropped, OptimizeRequest, OptimizeResponse, Visit

DROP_PENALTY = 100_000


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    r = 6371.0
    la1, la2 = math.radians(a[0]), math.radians(b[0])
    dlat, dlng = la2 - la1, math.radians(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def road_minutes(km: float) -> int:
    """Same estimate the Go engine uses (TravelGap): 5 min when walking distance, else 10 + km at 28 km/h."""
    if km < 0.8:
        return 5
    return min(120, round(10 + km / 28 * 60))


def matrix(req: OptimizeRequest) -> list[list[int]]:
    if req.travel_minutes is not None:
        return req.travel_minutes
    pts = [(req.start.lat, req.start.lng)] + [(s.lat, s.lng) for s in req.stops]
    return [[0 if i == j else road_minutes(haversine_km(p, q)) for j, q in enumerate(pts)] for i, p in enumerate(pts)]


def diagnose(req: OptimizeRequest, tm: list[list[int]]) -> list[str]:
    """Plain reasons a required stop can't fit (used when the solver finds no plan)."""
    out = []
    for i, s in enumerate(req.stops, start=1):
        if not s.required:
            continue
        earliest = max(req.day_start_min + tm[0][i], s.open_min)
        if s.duration_min > s.close_min - s.open_min:
            out.append(f"{s.title or s.id}: needs {s.duration_min} min but is only open {s.close_min - s.open_min} min")
        elif earliest + s.duration_min > s.close_min:
            out.append(f"{s.title or s.id}: can't be reached and finished before it closes")
        elif earliest + s.duration_min + (tm[i][0] if req.return_to_start else 0) > req.day_end_min:
            out.append(f"{s.title or s.id}: would end after the day ends")
    if req.max_energy is not None:
        need = sum(s.energy for s in req.stops if s.required and s.weather_ok)
        if need > req.max_energy:
            out.append(f"required stops need effort {need}, above the day limit {req.max_energy}")
    if not out:
        out.append("the required stops can't all fit in one day with travel time between them")
    return out


def optimize(req: OptimizeRequest) -> OptimizeResponse:
    t0 = time.perf_counter()
    tm = matrix(req)
    stops = req.stops
    n = len(stops) + 1
    dropped: list[Dropped] = []
    conflicts: list[str] = []

    # Weather is a hard constraint decided by the app: a stop that isn't weather-safe is never scheduled.
    blocked = {i for i, s in enumerate(stops, start=1) if not s.weather_ok}
    for i in blocked:
        s = stops[i - 1]
        dropped.append(Dropped(id=s.id, reason="not weather-safe on this day"))
        if s.required:
            conflicts.append(f"{s.title or s.id} is required but not weather-safe on this day")

    manager = pywrapcp.RoutingIndexManager(n, 1, 0)
    routing = pywrapcp.RoutingModel(manager)
    service = [0] + [s.duration_min for s in stops]

    def transit(fi: int, ti: int) -> int:
        f, t = manager.IndexToNode(fi), manager.IndexToNode(ti)
        if t == 0 and not req.return_to_start:
            return service[f]
        return service[f] + tm[f][t]

    cb = routing.RegisterTransitCallback(transit)

    def travel(fi: int, ti: int) -> int:
        f, t = manager.IndexToNode(fi), manager.IndexToNode(ti)
        if t == 0 and not req.return_to_start:
            return 0
        return tm[f][t]

    routing.SetArcCostEvaluatorOfAllVehicles(routing.RegisterTransitCallback(travel))
    horizon = 24 * 60
    routing.AddDimension(cb, horizon, horizon, False, "Time")
    td = routing.GetDimensionOrDie("Time")
    td.CumulVar(routing.Start(0)).SetRange(req.day_start_min, req.day_start_min)
    td.CumulVar(routing.End(0)).SetRange(req.day_start_min, req.day_end_min)
    for i, s in enumerate(stops, start=1):
        idx = manager.NodeToIndex(i)
        latest = s.close_min - s.duration_min
        if i in blocked or latest < s.open_min:
            routing.AddDisjunction([idx], 0)
            routing.solver().Add(routing.ActiveVar(idx) == 0)
            if i not in blocked:
                dropped.append(Dropped(id=s.id, reason="opening window shorter than the visit"))
                if s.required:
                    conflicts.append(f"{s.title or s.id} is required but its window is shorter than the visit")
            continue
        td.CumulVar(idx).SetRange(max(s.open_min, req.day_start_min), latest)
        if not s.required:
            routing.AddDisjunction([idx], DROP_PENALTY)
    if req.max_energy is not None:
        energy = [0] + [s.energy for s in stops]
        ecb = routing.RegisterUnaryTransitCallback(lambda fi: energy[manager.IndexToNode(fi)])
        routing.AddDimensionWithVehicleCapacity(ecb, 0, [req.max_energy], True, "Energy")
    pos = {s.id: i for i, s in enumerate(stops, start=1)}
    for p in req.precedence:
        a, b = manager.NodeToIndex(pos[p.before]), manager.NodeToIndex(pos[p.after])
        routing.solver().Add(td.CumulVar(a) + stops[pos[p.before] - 1].duration_min <= td.CumulVar(b))

    if conflicts:
        return OptimizeResponse(feasible=False, order=[], dropped=dropped, conflicts=conflicts, total_travel_min=0,
                                day_end_min=None, metadata={"solver": "ortools", "status": "infeasible-precheck",
                                                            "wall_ms": round((time.perf_counter() - t0) * 1000)})

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromMilliseconds(req.time_limit_ms)
    sol = routing.SolveWithParameters(params)
    wall = round((time.perf_counter() - t0) * 1000)
    if sol is None:
        return OptimizeResponse(feasible=False, order=[], dropped=dropped, conflicts=diagnose(req, tm), total_travel_min=0,
                                day_end_min=None, metadata={"solver": "ortools", "status": "no-solution", "wall_ms": wall})

    order: list[Visit] = []
    visited = set()
    idx = routing.Start(0)
    prev, total = 0, 0
    while not routing.IsEnd(idx):
        node = manager.IndexToNode(idx)
        if node != 0:
            s = stops[node - 1]
            start = sol.Value(td.CumulVar(idx))
            order.append(Visit(id=s.id, title=s.title, start_min=start, end_min=start + s.duration_min, travel_min=tm[prev][node]))
            total += tm[prev][node]
            visited.add(node)
            prev = node
        idx = sol.Value(routing.NextVar(idx))
    if req.return_to_start and order:
        total += tm[prev][0]
    for i, s in enumerate(stops, start=1):
        if i not in visited and not any(d.id == s.id for d in dropped):
            dropped.append(Dropped(id=s.id, reason="doesn't fit the day with the other stops"))
    end = sol.Value(td.CumulVar(routing.End(0)))
    return OptimizeResponse(feasible=True, order=order, dropped=dropped, conflicts=[], total_travel_min=total, day_end_min=end,
                            metadata={"solver": "ortools", "status": "ok", "wall_ms": wall, "matrix": "given" if req.travel_minutes else "road-estimate"})
