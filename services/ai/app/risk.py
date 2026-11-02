"""Transfer delay-risk model (DEMO).

There is no real delay history in Trizpyy yet, so this logistic regression is trained on a
synthetic "demo history" drawn from the stated assumptions below with a fixed seed. It is
useful to rank transfers for the Early Warning demo; its numbers are NOT validated against
real delays and every response says so.

Assumptions used to generate the demo history (probability of a late transfer rises with):
  rain chance, road distance, peak-hour departures, peak season, flights/buses over cars,
  and falls with the buffer planned after the transfer.
"""
from __future__ import annotations

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import StandardScaler

from .schemas import DelayRisk, TransferIn

MODES = ["flight", "train", "bus", "car", "transfer"]
MODE_BASE = {"flight": 0.35, "train": 0.25, "bus": 0.45, "car": 0.1, "transfer": 0.15}
FEATURES = ["rain_chance", "distance_km", "peak_hour", "peak_season", "buffer_min"] + [f"mode_{m}" for m in MODES]
LABELS = {"rain_chance": "rain forecast", "distance_km": "long distance", "peak_hour": "peak-hour departure",
          "peak_season": "peak season", "buffer_min": "short buffer", "mode_flight": "flights run late often",
          "mode_bus": "buses run late often", "mode_train": "trains run late sometimes", "mode_car": "private car",
          "mode_transfer": "local transfer"}
MODEL_CARD = {"model": "logreg-delay-demo-v1", "training": "synthetic demo history (n=4000, seed 7) from stated assumptions",
              "validated_on_real_delays": False}


def peak_hour(minute: int) -> int:
    h = minute // 60
    return int(7 <= h <= 10 or 17 <= h <= 20)


def features(t: TransferIn) -> list[float]:
    return [t.rain_chance, t.distance_km, peak_hour(t.depart_min), int(t.peak_season), t.buffer_min] + [int(t.mode == m) for m in MODES]


def _demo_history(n: int = 4000, seed: int = 7) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    rows, ys = [], []
    for _ in range(n):
        mode = rng.choice(MODES)
        rain = int(rng.integers(0, 100))
        km = float(rng.gamma(2.0, 60 if mode in ("flight", "train", "bus") else 12))
        dep = int(rng.integers(0, 24 * 60))
        season = int(rng.random() < 0.35)
        buf = int(rng.integers(0, 120))
        logit = (-2.4 + 2.2 * MODE_BASE[mode] + 0.022 * rain + 0.0025 * km + 0.55 * peak_hour(dep) + 0.45 * season - 0.012 * buf)
        y = int(rng.random() < 1 / (1 + np.exp(-logit)))
        rows.append([rain, km, peak_hour(dep), season, buf] + [int(mode == m) for m in MODES])
        ys.append(y)
    return np.array(rows, dtype=float), np.array(ys)


class DelayModel:
    def __init__(self) -> None:
        x, y = _demo_history()
        split = int(len(x) * 0.8)
        self.scaler = StandardScaler().fit(x[:split])
        self.clf = LogisticRegression(max_iter=500).fit(self.scaler.transform(x[:split]), y[:split])
        auc = roc_auc_score(y[split:], self.clf.predict_proba(self.scaler.transform(x[split:]))[:, 1])
        self.card = {**MODEL_CARD, "holdout_auc_on_synthetic_data": round(float(auc), 3)}

    def predict(self, t: TransferIn) -> DelayRisk:
        z = self.scaler.transform([features(t)])
        p = float(self.clf.predict_proba(z)[0, 1])
        contrib = z[0] * self.clf.coef_[0]
        order = np.argsort(-contrib)
        factors = []
        for i in order:
            name = FEATURES[i]
            if contrib[i] <= 0.15 or (name.startswith("mode_") and features(t)[i] == 0):
                continue
            if name == "buffer_min" and t.buffer_min >= 45:
                continue
            factors.append(LABELS[name])
            if len(factors) == 3:
                break
        level = "low" if p < 0.25 else "medium" if p < 0.5 else "high"
        return DelayRisk(transfer_id=t.transfer_id, risk_score=round(p, 3), risk_level=level, factors=factors)
