"""Vendor reliability: how likely a vendor is to fail the next request, with uncertainty.

The Go backend already owns the vendor Trust Score (computed from real request history in
store/catalog.go). This adds what the score can't say: a Bayesian estimate of the chance the
next request is declined or left unanswered, and how sure we are given how few requests exist.

Model: failures ~ Binomial(n, p), prior p ~ Beta(2, 8) (about a 20% failure rate, worth 10
requests of evidence). The posterior is Beta(2 + failures, 8 + successes).
"""
from __future__ import annotations

from scipy.stats import beta

from .schemas import Reliability, VendorHistory

PRIOR_A, PRIOR_B = 2.0, 8.0


def estimate(v: VendorHistory) -> Reliability:
    failures = v.declined + v.expired
    successes = v.answered - v.declined
    n = failures + successes
    a, b = PRIOR_A + failures, PRIOR_B + successes
    mean = a / (a + b)
    lo, hi = beta.ppf(0.05, a, b), beta.ppf(0.95, a, b)
    needs_backup = hi >= 0.4 or mean >= 0.3
    if n == 0:
        why = "No requests yet, so this is the prior (about 1 in 5 requests fail)."
    else:
        why = f"{failures} of {n} requests failed; with {'little' if n < 10 else 'solid'} evidence the chance is {mean:.0%} (90% range {lo:.0%}–{hi:.0%})."
    if v.avg_reply_min > 60:
        why += f" Replies are slow (about {round(v.avg_reply_min)} min)."
    return Reliability(vendor_id=v.vendor_id, failure_probability=round(mean, 3), interval_90=(round(float(lo), 3), round(float(hi), 3)),
                       evidence=n, needs_backup=bool(needs_backup), explanation=why)
