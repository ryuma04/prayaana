"""Builds the Trizpyy travel-domain corpus used to align a Nugen model.

Everything comes from the real catalog the app runs on (backend/internal/seed/data/catalog.json)
plus Trizpyy's own trip rules, so the aligned model answers the way Trizpyy works:
destination guides, every experience, stays and transport, and grounded question/answer pairs.

Usage: python build_corpus.py  (writes corpus/*.txt)
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "backend" / "internal" / "seed" / "data" / "catalog.json"
OUT = Path(__file__).resolve().parent / "corpus"
MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def rupees(n):
    s = str(int(n))
    if len(s) <= 3:
        return "Rs " + s
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    if head:
        parts.insert(0, head)
    return "Rs " + ",".join(parts) + "," + tail


def hours(mins):
    h, m = divmod(int(mins), 60)
    return f"{h} h {m} min" if h and m else (f"{h} h" if h else f"{m} min")


def months(ms):
    return ", ".join(MONTHS[m] for m in ms) if ms else "no particular month"


def effort(e):
    return {1: "very easy", 2: "easy", 3: "moderate", 4: "tiring", 5: "very tiring"}.get(e, "moderate")


def activity_text(a, cluster_name):
    where = "indoors" if not a.get("outdoor") else "outdoors"
    kids = "good for kids" if a.get("kidFriendly") else "not suitable for young kids"
    return (f"{a['title']} ({cluster_name}). {a.get('description', '').strip()} It takes about {hours(a['durationMin'])}, "
            f"costs {rupees(a['price'])} per person, is {where}, {effort(a.get('energy', 2))} effort, "
            f"{a.get('walking', 'low')} walking, best in the {a.get('slot', 'morning')}, and {kids}. "
            f"Themes: {', '.join(a.get('interests', []))}.")


def destination_doc(d, acts, stays, transport):
    clusters = {c["id"]: c["name"] for c in d.get("clusters", [])}
    lines = [f"TRIZPYY DESTINATION GUIDE: {d['name']}, {d['state']}", "",
             f"{d['name']}: {d.get('tagline', '')}. {d.get('description', '')}",
             f"Best months: {months(d.get('bestMonths'))}. Rainy months: {months(d.get('rainyMonths'))}.",
             f"Typical weather: about {d['climate']['tempC']} degrees C, usually {d['climate']['condition']}, {d['climate']['rainChance']}% chance of rain.",
             f"Good for: {', '.join(d.get('moods', []))}. Ideal trip length: {d.get('idealDays', '')}.",
             f"Getting there: nearest gateway {d.get('gateway', '')}. Travelers usually come from {d.get('fromCity', '')}.",
             f"Local cab for a full day costs about {rupees(d.get('localCabPerDay', 0))}; an airport transfer about {rupees(d.get('airportTransfer', 0))}.",
             f"Languages spoken: {', '.join(d.get('languages', []))}.",
             "Highlights: " + "; ".join(d.get("highlights", [])) + ".", "", "AREAS"]
    for c in d.get("clusters", []):
        meal = f"Lunch spot: {c['lunch']['name']} (about {rupees(c['lunch']['pricePerPerson'])} per person)."
        if c.get("dinner"):
            meal += f" Dinner: {c['dinner']['name']} (about {rupees(c['dinner']['pricePerPerson'])} per person)."
        lines.append(f"- {c['name']}: {meal}")
    lines += ["", "EXPERIENCES"]
    for a in acts:
        lines.append("- " + activity_text(a, clusters.get(a.get("cluster"), d["name"])))
    lines += ["", "STAYS"]
    for s in stays:
        lines.append(f"- {s['name']} in {s.get('area', '')}: {s['type']} stay, {rupees(s['nightlyPrice'])} per room per night. Amenities: {', '.join(s.get('amenities', []))}.")
    lines += ["", "GETTING THERE"]
    for t in transport:
        lines.append(f"- {t['label']} ({t['mode']}) from {t.get('from', '')}: {rupees(t['pricePerPerson'])} per person, about {hours(t['durationMin'])}, departs {t.get('departs', '')}.")
    lines += ["", "EMERGENCY NUMBERS"]
    for e in d.get("emergency", []):
        lines.append(f"- {e['label']}: {e['phone']}")
    return "\n".join(lines) + "\n"


def qa_doc(d, acts):
    clusters = {c["id"]: c["name"] for c in d.get("clusters", [])}
    name = d["name"]
    qa = []
    indoor = [a for a in acts if not a.get("outdoor")]
    kids = [a for a in acts if a.get("kidFriendly")]
    easy = [a for a in acts if a.get("energy", 3) <= 2]
    food = [a for a in acts if "food" in a.get("interests", [])]

    def names(lst, n=4):
        return "; ".join(f"{a['title']} ({hours(a['durationMin'])}, {rupees(a['price'])} per person)" for a in lst[:n]) or "nothing in our catalog right now"

    qa.append((f"When is the best time to visit {name}?", f"The best months for {name} are {months(d.get('bestMonths'))}. Avoid {months(d.get('rainyMonths'))} if you want dry days."))
    qa.append((f"It is raining in {name} today. What can we do?", f"Pick indoor plans: {names(indoor)}. Outdoor plans on a rainy day are moved to a dry day or swapped for something similar, and every partner confirms before anything changes."))
    qa.append((f"We are travelling with kids. What is good for them in {name}?", f"Kid-friendly picks in {name}: {names(kids)}."))
    qa.append((f"We are tired today in {name}. Something easy?", f"Easy options: {names(easy)}. Add a rest break in the afternoon."))
    qa.append((f"Where should we eat in {name}?", "Try " + "; ".join(f"{c['lunch']['name']} in {c['name']}" for c in d.get("clusters", [])[:4]) + (f". Food experiences: {names(food, 3)}." if food else ".")))
    qa.append((f"What are the emergency numbers in {name}?", "; ".join(f"{e['label']}: {e['phone']}" for e in d.get("emergency", []))))
    qa.append((f"How much does a local cab cost in {name}?", f"About {rupees(d.get('localCabPerDay', 0))} for a full day, and about {rupees(d.get('airportTransfer', 0))} for an airport transfer."))
    for a in acts:
        where = clusters.get(a.get("cluster"), name)
        qa.append((f"Tell me about {a['title']}.", activity_text(a, where)))
        if a.get("outdoor"):
            qa.append((f"Can we still do {a['title']} if it rains?", f"{a['title']} is outdoors, so heavy rain can stop it. We would move it to a dry day, or swap it for a similar indoor experience, and only after every partner confirms."))
    return "\n".join(f"Q: {q}\nA: {a}\n" for q, a in qa)


POLICIES = """TRIZPYY HOW WE WORK (policies the assistant must follow)

Booking and payment
- Travelers pay the full trip price online through Razorpay (UPI, cards, netbanking or wallets).
- After payment, every partner (hotel, cab, activity) is asked to confirm. The ticket and receipt are emailed as PDFs.

When something changes during a trip
- Weather, flight delays, a closed place, a partner who cannot serve, or a traveler who feels unwell can all change the plan.
- We show what is affected and offer choices: the cheapest fix, the fastest fix, or keeping every Must-Do.
- Adaptive swaps: move an experience to another day, change the order of days, or swap it for a similar experience.
- Nothing is changed until every affected partner says yes. If one says no, the trip stays exactly as it was.
- Travelers get a Change Receipt and updated documents by email after every change.

Money
- Refunds are 100% when the change is not the traveler's fault (weather, a partner cancelling, a closure), otherwise 80%.
- Re-dating a booked experience adds about 10% as the partner's change fee.
- Small fixes are applied automatically only when the extra cost is under the traveler's auto-approve limit; anything more needs the traveler's approval.

Must-Dos
- Travelers can mark up to 5 experiences as Must-Do. Fix plans try hardest to keep these.

Travel DNA
- A short quiz sets the traveler's Travel DNA (adventure, nature, culture, food, comfort, social).
- It keeps learning a little from what they heart, remove, swap and rate, and from end-of-trip feedback.

How the assistant answers
- Short, friendly, plain words. No technical terms.
- Only facts from Trizpyy's catalog and these rules. If unsure, say so and offer to connect the traveler with the operator.
- For any emergency, give the local emergency numbers first.
"""


def main():
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    OUT.mkdir(exist_ok=True)
    for f in OUT.glob("*.txt"):
        f.unlink()
    (OUT / "trizpyy_policies.txt").write_text(POLICIES, encoding="utf-8")
    qa_all = []
    for d in cat["destinations"]:
        acts = [a for a in cat["activities"] if a["destinationId"] == d["id"]]
        stays = [s for s in cat["stays"] if s["destinationId"] == d["id"]]
        transport = [t for t in cat["transport"] if t["destinationId"] == d["id"]]
        (OUT / f"guide_{d['id']}.txt").write_text(destination_doc(d, acts, stays, transport), encoding="utf-8")
        qa_all.append(f"TRIZPYY TRAVELER QUESTIONS: {d['name']}\n\n" + qa_doc(d, acts))
    (OUT / "traveler_questions.txt").write_text("\n\n".join(qa_all), encoding="utf-8")
    files = sorted(OUT.glob("*.txt"))
    print(f"{len(files)} files, {sum(f.stat().st_size for f in files) // 1024} KB")


if __name__ == "__main__":
    main()
