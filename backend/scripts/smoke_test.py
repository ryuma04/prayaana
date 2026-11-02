"""End-to-end smoke test for the Trizpyy API (stdlib only).

Usage:  python scripts/smoke_test.py [base_url]
Runs against a freshly seeded server (demo accounts, password demo1234).
"""
import json
import sys
import time
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/")
PASSED = []


def call(method, path, body=None, token=None, expect=200):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            status, raw = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, raw = e.code, e.read()
    payload = json.loads(raw) if raw else None
    if expect is not None and status != expect:
        raise AssertionError(f"{method} {path}: expected {expect}, got {status}: {raw[:400]!r}")
    return payload


def raw(method, path, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read(), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.code, e.read(), e.headers.get("Content-Type", "")


def check(name, cond, detail=""):
    if not cond:
        raise AssertionError(f"FAILED: {name} {detail}")
    PASSED.append(name)
    print(f"  ok  {name}")


def wait_run(run_id, token, timeout=90):
    end = time.time() + timeout
    while time.time() < end:
        run = call("GET", f"/agent/runs/{run_id}", token=token)
        if run["status"] not in ("running", "waiting"):
            return run
        time.sleep(1)
    raise AssertionError(f"agent run {run_id} did not finish")


def main():
    print(f"Smoke testing {BASE}")
    h = call("GET", "/healthz")
    check("health ok", h["status"] == "ok")

    trav = call("POST", "/auth/login", {"email": "rahul@trizpyy.demo", "password": "demo1234"})["token"]
    ops = call("POST", "/auth/login", {"email": "ops@saffrontrails.demo", "password": "demo1234"})["token"]
    check("demo logins", trav and ops)
    # Rebuild the demo world so the suite can be re-run against a persistent database.
    call("POST", "/ops/demo/reset", token=ops)
    check("demo world reset", True)
    call("POST", "/auth/login", {"email": "rahul@trizpyy.demo", "password": "wrong-pass"}, expect=401)
    check("wrong password rejected", True)
    me = call("GET", "/auth/me", token=trav)
    check("me is traveler", me["role"] == "traveler")
    call("GET", "/auth/me", expect=401)
    check("me needs auth", True)

    dests = call("GET", "/destinations")
    check("8 destinations", len(dests) == 8)
    check("estimates computed", all(d["estimatePerPerson"] > 0 for d in dests))
    feel = call("GET", "/destinations?q=quiet%20mountains")
    check("search by feeling", len(feel) > 0 and feel[0]["searchScore"] > 0)
    man = call("GET", "/destinations/manali")
    check("destination detail", len(man["activities"]) > 5 and len(man["stays"]) == 4)
    call("GET", "/destinations/atlantis", expect=404)
    quiz = call("GET", "/quiz")
    check("quiz loaded", len(quiz) == 10)
    meta = call("GET", "/meta")
    check("meta moods", len(meta["moods"]) == 6)

    q = call("POST", "/profile/quiz", {"answers": {"morning": "trek", "view": "peaks", "thrill": 80, "pace": "balanced"}}, token=trav)
    check("travel DNA", q["dna"]["name"] != "" and len(q["interests"]) == 3)
    prof = call("PATCH", "/profile", {"autoApproveLimit": 2000, "savedPlaces": ["goa", "nowhere"]}, token=trav)
    check("profile update", prof["autoApproveLimit"] == 2000 and prof["savedPlaces"] == ["goa"])

    prefs = {"destinationId": "manali", "startDate": meta["today"], "nights": 4, "adults": 2, "budgetPerPerson": 30000,
             "stayType": "boutique", "transport": "bus", "interests": ["nature", "adventure", "food"], "pace": "balanced",
             "ownWords": "Manali, nature and adventure, great food, quiet cafés in the evening"}
    call("POST", "/trips", {"prefs": {**prefs, "nights": 40}}, token=trav, expect=400)
    check("bad prefs rejected", True)
    created = call("POST", "/trips", {"prefs": prefs}, token=trav, expect=201)
    trip = created["trip"]
    tid = trip["id"]
    check("trip created", trip["status"] == "draft" and len(trip["items"]) > 10 and created["price"]["total"] > 0)
    check("planning info", created["planning"]["matched"] > 0)

    acts = [i for i in trip["items"] if i["kind"] == "activity"]
    v = call("PATCH", f"/trips/{tid}/items/{acts[0]['id']}", {"op": "heart"}, token=trav)
    check("heart item", any(i.get("hearted") for i in v["trip"]["items"]))
    alts = call("GET", f"/trips/{tid}/alternatives?item={acts[1]['id']}", token=trav)
    check("alternatives", len(alts["list"]) >= 2 and alts["list"][0]["isCurrent"])
    alt = alts["list"][1]["activity"]["id"]
    v = call("PATCH", f"/trips/{tid}/items/{acts[1]['id']}", {"op": "swap", "activityId": alt}, token=trav)
    check("swap item", any(i.get("refId") == alt for i in v["trip"]["items"]))
    v = call("PATCH", f"/trips/{tid}/items/{acts[1]['id']}", {"op": "qty", "qty": 1}, token=trav)
    check("change qty", next(i for i in v["trip"]["items"] if i["id"] == acts[1]["id"])["qty"] == 1)
    v = call("PATCH", f"/trips/{tid}/items/{acts[1]['id']}", {"op": "move", "day": 3}, token=trav)
    check("move item", next(i for i in v["trip"]["items"] if i["id"] == acts[1]["id"])["day"] == 3)
    call("PATCH", f"/trips/{tid}/items/{acts[1]['id']}", {"op": "move", "day": 99}, token=trav, expect=400)
    check("bad day rejected", True)
    transport = [i for i in v["trip"]["items"] if i["kind"] == "bus"][0]
    call("PATCH", f"/trips/{tid}/items/{transport['id']}", {"op": "remove"}, token=trav, expect=400)
    check("transport legs locked", True)
    unused = [a for a in man["activities"] if a["id"] not in {i.get("refId") for i in v["trip"]["items"]}][0]
    v = call("POST", f"/trips/{tid}/items", {"activityId": unused["id"], "day": 2}, token=trav)
    check("add activity", any(i.get("refId") == unused["id"] for i in v["trip"]["items"]))
    stays = call("GET", f"/trips/{tid}/stays", token=trav)
    other = next(s for s in stays if not s["isCurrent"])["stay"]["id"]
    v = call("PATCH", f"/trips/{tid}", {"stayId": other, "adults": 3}, token=trav)
    check("change stay + travelers", v["trip"]["stayId"] == other and v["trip"]["prefs"]["adults"] == 3)
    o = call("POST", f"/trips/{tid}/optimize", token=trav)
    check("optimize", "savedMin" in o)
    call("POST", f"/trips/{tid}/promo", {"code": "NOPE"}, token=trav, expect=400)
    p = call("POST", f"/trips/{tid}/promo", {"code": "trizpyy10"}, token=trav)
    check("promo applied", p["price"]["promo"] > 0 and p["trip"]["promoCode"] == "TRIZPYY10")
    ins = call("GET", f"/trips/{tid}/insights", token=trav)
    check("insights", len(ins["forecast"]) == 5 and len(ins["prep"]) >= 8)

    order = call("POST", f"/trips/{tid}/book", token=trav)
    check("order created", order["amount"] == p["price"]["total"])
    call("POST", f"/trips/{tid}/pay/verify", {"orderId": order["orderId"], "method": "upi", "fail": True}, token=trav, expect=402)
    check("declined payment", True)
    order = call("POST", f"/trips/{tid}/book", token=trav)
    conf = call("POST", f"/trips/{tid}/pay/verify", {"orderId": order["orderId"], "method": "upi"}, token=trav)
    check("booked", conf["trip"]["status"] == "booked" and len(conf["bookings"]) > 5)
    again = call("POST", f"/trips/{tid}/pay/verify", {"orderId": order["orderId"], "method": "upi"}, token=trav)
    check("payment idempotent", again["trip"]["id"] == tid)
    call("PATCH", f"/trips/{tid}/items/{acts[0]['id']}", {"op": "remove"}, token=trav, expect=409)
    check("booked trip locked for edits", True)
    for _ in range(30):
        bks = call("GET", f"/trips/{tid}/bookings", token=trav)
        if all(b["status"] == "confirmed" for b in bks):
            break
        time.sleep(1)
    check("vendors confirmed bookings", all(b["status"] == "confirmed" for b in bks), str([b["status"] for b in bks]))

    # Documents (real PDFs) and the traveler's WhatsApp thread
    docs = call("GET", f"/trips/{tid}/documents", token=trav)
    latest = {d["kind"]: d for d in docs if d["latest"]}
    check("4 trip documents issued", set(latest) == {"confirmation", "invoice", "itinerary", "voucher"}, str(list(latest)))
    check("documents re-issued after all partners confirmed", latest["voucher"]["version"] >= 2 and latest["confirmation"]["version"] >= 2)
    status, pdf, ctype = raw("GET", f"/trips/{tid}/documents/{latest['invoice']['id']}", token=trav)
    check("invoice downloads as PDF", status == 200 and ctype == "application/pdf" and pdf.startswith(b"%PDF-") and len(pdf) == latest["invoice"]["sizeBytes"])
    check("documents need a login", raw("GET", f"/trips/{tid}/documents/{latest['invoice']['id']}")[0] == 401)
    check("travelers can't read other trips' documents", raw("GET", "/trips/trp-2041/documents", token=trav)[0] == 404)
    wa = call("GET", f"/trips/{tid}/whatsapp", token=trav)["messages"]
    check("WhatsApp booking confirmation sent", any("Booking confirmed" in m["body"] for m in wa) and any(m.get("attachment", {}).get("docId") for m in wa))
    sent = call("POST", f"/trips/{tid}/whatsapp", {"text": "We are stuck in traffic, running 30 minutes late"}, token=trav)
    check("WhatsApp assistant replies", sent["understood"]["kind"] in ("late", "other") and sent["reply"]["body"] != "")
    check("WhatsApp thread grows", len(call("GET", f"/trips/{tid}/whatsapp", token=trav)["messages"]) == len(wa) + 2)
    threads = call("GET", "/ops/inbox", token=ops)
    check("operator sees traveler thread", any(t["id"] == f"th-trip-{tid}" and t["party"] == "traveler" for t in threads))
    reply = call("POST", f"/ops/inbox/th-trip-{tid}/messages", {"body": "We moved your pickup, no stress!"}, token=ops)
    check("operator reply reaches traveler", call("GET", f"/trips/{tid}/whatsapp", token=trav)["messages"][-1]["id"] == reply["id"])
    again_docs = call("POST", f"/trips/{tid}/documents", token=trav)
    check("documents re-issue on request", max(d["version"] for d in again_docs if d["kind"] == "invoice") == latest["invoice"]["version"] + 1)

    # Outside data through the API (live providers or their fallbacks)
    wx = call("GET", "/weather?days=5")
    check("weather for every destination", len(wx["destinations"]) == 8 and all(len(v) == 5 for v in wx["destinations"].values()) and wx["source"] in ("open-meteo", "climate"))
    route = call("GET", f"/trips/{tid}/route?day=2", token=trav)
    check("road route for a day", route["source"] in ("osrm", "estimate") and len(route["geometry"]) >= 2 and route["distanceKm"] > 0)
    fl = call("GET", f"/trips/{tid}/flights", token=trav)
    check("flight status endpoint", isinstance(fl["flights"], list) and fl["provider"] in ("aviationstack", "timetable"))
    pl = call("GET", "/places?destination=goa&category=food", token=trav)
    check("nearby places", pl["source"] in ("google-places", "catalog") and len(pl["places"]) > 0)
    call("GET", "/places?destination=atlantis&category=food", token=trav, expect=400)
    check("places validates destination", True)

    live = call("POST", f"/trips/{tid}/start", {"day": 1}, token=trav)
    check("trip live", live["trip"]["status"] == "live")
    prop = call("POST", f"/trips/{tid}/mood", {"mood": "tired", "day": 2, "nowMin": 600}, token=trav)
    check("mood proposal", prop["headline"] != "")
    acc = call("POST", f"/trips/{tid}/mood/accept", {"mood": "hungry", "day": 1, "nowMin": 720}, token=trav)
    check("mood accepted", acc["trip"]["receipts"][0]["title"].startswith("Mood"))
    msg = call("POST", f"/trips/{tid}/message", {"text": "We are stuck in traffic, we will be late"}, token=trav)
    check("message classified", msg["kind"] == "late")

    inc = call("POST", f"/trips/{tid}/incidents", {"kind": "weather", "day": 2}, token=trav, expect=201)
    detail = call("GET", f"/incidents/{inc['id']}", token=trav)
    check("impact + plans", len(detail["plans"]) == 3 and detail["impact"]["moneyAtRisk"] >= 0)
    run = call("POST", f"/incidents/{inc['id']}/agent", {}, token=trav, expect=202)
    dup = call("POST", f"/incidents/{inc['id']}/agent", {}, token=trav, expect=202)
    check("agent single run per incident", dup["id"] == run["id"])
    done = wait_run(run["id"], trav)
    tools = [s["tool"] for s in done["steps"]]
    check("agent finished", done["status"] in ("succeeded", "needs_human"), done["status"])
    check("agent timeline", "analyze_impact" in tools and "run_safety_checks" in tools)
    if done["status"] == "succeeded":
        t2 = call("GET", f"/trips/{tid}", token=trav)["trip"]
        check("change receipt written", any(r.get("planStrategy") for r in t2["receipts"]))
        check("incident resolved", call("GET", f"/incidents/{inc['id']}", token=trav)["incident"]["status"] == "resolved")

    call("GET", f"/trips/{tid}", token=ops)
    check("operator sees traveler trip", True)
    call("GET", "/trips/trp-2041", token=trav, expect=404)
    check("traveler cannot see others' trips", True)
    call("GET", "/ops/overview", token=trav, expect=403)
    check("traveler blocked from ops", True)

    ov = call("GET", "/ops/overview", token=ops)
    check("ops overview", ov["stats"]["bookings"] > 0 and len(ov["revenue"]) == 14)
    tours = call("GET", "/ops/tours", token=ops)
    check("ops tours", len(tours) >= 13)
    td = call("GET", "/ops/tours/trp-2041", token=ops)
    check("tour detail", td["row"]["status"] in ("live", "at_risk") and len(td["bookings"]) > 0)
    call("PATCH", "/ops/tours/trp-2041/coordinator", {"memberId": "tm-arjun"}, token=ops)
    check("assign coordinator", True)
    check("ops bookings", len(call("GET", "/ops/bookings?status=confirmed", token=ops)) > 0)
    pending = call("GET", "/ops/bookings?status=requested", token=ops)
    if pending:
        call("POST", f"/ops/bookings/{pending[0]['id']}/resend", token=ops)
        call("POST", f"/ops/bookings/{pending[0]['id']}/resend", token=trav, expect=403)
    check("operator can nudge a waiting partner", True)
    check("meta names the operator", call("GET", "/meta")["operator"] != "")
    check("ops customers", len(call("GET", "/ops/customers", token=ops)) >= 14)
    check("ops team", len(call("GET", "/ops/team", token=ops)) == 7)
    check("ops ledger", len(call("GET", "/ops/ledger", token=ops)) > 10)
    vendors = call("GET", "/ops/vendors", token=ops)
    check("ops vendors", len(vendors) > 50)
    paused = call("PATCH", "/ops/vendors/v-man-cabs/availability", {"available": False}, token=ops)
    check("pausing vendor raises incidents", paused["vendor"]["available"] is False and len(paused["incidents"]) > 0)
    call("PATCH", "/ops/vendors/v-man-cabs/availability", {"available": True}, token=ops)
    inbox = call("GET", "/ops/inbox", token=ops)
    check("inbox", len(inbox) >= 7)
    call("POST", f"/ops/inbox/{inbox[0]['id']}/messages", {"body": "Thanks, noted!"}, token=ops)
    call("POST", f"/ops/inbox/{inbox[0]['id']}/read", token=ops)
    check("inbox reply + read", True)
    alerts = call("GET", "/ops/alerts", token=ops)
    check("alerts", len(alerts["crowdReports"]) >= 3 and len(alerts["warnings"]) >= 2)
    call("POST", "/ops/alerts/reports/cr-1/verify", token=ops)
    handed = call("POST", "/ops/alerts/warnings/ew-1/handoff", token=ops)
    check("warning handed to agent", handed["runId"] != "")
    sim = call("POST", "/ops/simulate", {"scenarioId": "rain-manali"}, token=ops)
    check("what-if simulator", sim["totals"]["tours"] >= 1)
    fixed = call("POST", "/ops/simulate/fix", {"scenarioId": "ropeway-closed"}, token=ops)
    check("fix all launched", isinstance(fixed, list))
    check("agent runs list", len(call("GET", "/ops/agent/runs", token=ops)) >= 1)
    check("notifications", len(call("GET", "/notifications", token=ops)) > 0)
    call("POST", "/notifications/read-all", token=trav)

    page = call("GET", "/v/demo-himalayan-cabs")
    check("vendor link page", page["open"] and page["vendor"]["id"] == "v-man-cabs")
    call("POST", "/v/demo-himalayan-cabs/reply", {"answer": "yes"})
    call("POST", "/v/demo-himalayan-cabs/reply", {"answer": "no"}, expect=409)
    check("vendor reply once", True)
    voice = call("POST", "/v/demo-leela-booking/voice", {"transcript": "Haan ji, booking confirm hai, cake bhi ready rahega"})
    check("vendor voice reply", voice["applied"] and voice["voice"]["decision"] == "confirmed")
    call("GET", "/v/not-a-token", expect=404)

    manual_inc = call("POST", "/trips/trp-2046/incidents", {"kind": "health"}, token=ops, expect=201)
    run = call("POST", f"/incidents/{manual_inc['id']}/agent", {"mode": "manual", "strategy": "fastest"}, token=ops, expect=202)
    reqs = []
    for _ in range(40):
        reqs = [r for r in call("GET", f"/agent/runs/{run['id']}/requests", token=ops) if r["status"] == "pending"]
        if reqs or call("GET", f"/agent/runs/{run['id']}", token=ops)["status"] not in ("running", "waiting"):
            break
        time.sleep(0.5)
    for r in reqs:
        call("POST", f"/v/{r['token']}/reply", {"answer": "yes"})
    final = wait_run(run["id"], ops)
    check("manual agent run via vendor links", len(reqs) > 0 and final["status"] == "succeeded", final["status"])

    take_inc = call("POST", "/trips/trp-2049/incidents", {"kind": "weather"}, token=ops, expect=201)
    run = call("POST", f"/incidents/{take_inc['id']}/agent", {"mode": "manual"}, token=ops, expect=202)
    time.sleep(1)
    call("POST", f"/ops/agent/runs/{run['id']}/takeover", token=ops)
    final = wait_run(run["id"], ops)
    check("operator takeover", final["status"] == "needs_human")

    email = f"smoke{int(time.time())}@example.com"
    bad = call("POST", "/auth/signup", {"name": "X", "email": "nope", "password": "short"}, expect=422)
    check("signup field errors", {"name", "email", "password"} <= set(bad["error"]["fields"]))
    weak = call("POST", "/auth/signup", {"name": "Smoke Tester", "email": email, "password": "password123"}, expect=422)
    check("common password rejected", "password" in weak["error"]["fields"])
    su = call("POST", "/auth/signup", {"name": "Smoke Tester", "email": email, "password": "Himalaya2026", "phone": "98765 43210"}, expect=201)
    check("signup asks for verification", su["verificationRequired"] and len(su.get("devCode", "")) == 6 and "session" not in su)
    call("POST", "/auth/signup", {"name": "Smoke Tester", "email": email, "password": "Himalaya2026"}, expect=409)
    check("duplicate email rejected", True)
    nv = call("POST", "/auth/login", {"email": email, "password": "Himalaya2026"}, expect=403)
    check("unverified login blocked", nv["error"]["code"] == "email_not_verified")
    wrong = "000000" if su["devCode"] != "000000" else "111111"
    call("POST", "/auth/verify-email", {"email": email, "code": wrong}, expect=400)
    check("wrong code rejected", True)
    call("POST", "/auth/resend-verification", {"email": email}, expect=429)
    check("resend cooldown", True)
    call("POST", "/auth/resend-verification", {"email": "nobody@example.com"})
    check("resend does not leak accounts", True)
    sess = call("POST", "/auth/verify-email", {"email": email, "code": su["devCode"]})
    check("code verifies + signs in", sess["user"]["emailVerified"] and sess["token"])
    call("POST", "/auth/verify-email", {"email": email, "code": su["devCode"]}, expect=400)
    check("code single use", True)
    s = call("POST", "/auth/login", {"email": email.upper(), "password": "Himalaya2026"})
    check("verified login (case-insensitive email)", s["user"]["phone"] == "+919876543210")
    newt = call("POST", "/trips", {"prefs": {"destinationId": "goa", "transport": "flight"}}, token=s["token"], expect=201)
    check("signup + first trip", newt["trip"]["destinationId"] == "goa")
    check("new traveler has 1 trip", len(call("GET", "/trips", token=s["token"])) == 1)
    call("DELETE", f"/trips/{newt['trip']['id']}", token=s["token"])
    check("delete draft", len(call("GET", "/trips", token=s["token"])) == 0)

    for _ in range(5):
        call("POST", "/auth/login", {"email": email, "password": "Wrong-pass-1"}, expect=401)
    locked = call("POST", "/auth/login", {"email": email, "password": "Himalaya2026"}, expect=429)
    check("account locks after 5 wrong passwords", locked["error"]["code"] == "locked")

    rv = call("POST", f"/trips/{tid}/review", {"stars": 5, "aspects": {"Stay": 5}, "text": "Loved it"}, token=trav)
    check("review completes trip", rv["trip"]["status"] == "completed")

    print(f"\nAll {len(PASSED)} checks passed.")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"\n{e}\n({len(PASSED)} checks passed before the failure)")
        sys.exit(1)
