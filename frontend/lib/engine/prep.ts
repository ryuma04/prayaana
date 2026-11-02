import type { Trip } from "@/types";
import { activityMap } from "@/data/activities";
import { tripForecast, isWet } from "./weather";

export interface PrepItem {
  id: string;
  group: "Documents" | "Packing" | "Health" | "Money" | "Apps & offline";
  label: string;
  why: string;
}

export function prepChecklist(trip: Trip): PrepItem[] {
  const refs = trip.items.filter((i) => i.refId && i.status !== "cancelled").map((i) => activityMap[i.refId as string]).filter(Boolean);
  const forecast = tripForecast(trip);
  const wet = forecast.some(isWet);
  const cold = forecast.some((f) => f.tempC <= 15);
  const hot = forecast.some((f) => f.tempC >= 30);
  const has = (re: RegExp) => refs.some((a) => re.test(a.title));
  const list: PrepItem[] = [
    { id: "id", group: "Documents", label: "Government photo ID for every traveler", why: "Needed at hotels, airports and activity check-ins" },
    { id: "tickets", group: "Documents", label: "Tickets saved in your Trip Pass", why: "Works offline in the mountains" },
    { id: "insurance", group: "Documents", label: "Travel insurance policy PDF", why: "Adventure activities often ask for it" },
    { id: "cash", group: "Money", label: "₹3,000 in small notes", why: "Dhabas, parking and tips are often cash-only" },
    { id: "upi", group: "Money", label: "UPI app working on your phone", why: "Most shops accept UPI" },
    { id: "app", group: "Apps & offline", label: "Install Prayaana on your phone", why: "Open the trip once online so it works offline (Offline Trip Pass)" },
    { id: "offline", group: "Apps & offline", label: "Download offline map of the area", why: "Network drops outside town" },
    { id: "meds", group: "Health", label: "Personal medicines + basic first-aid", why: "Pharmacies close early in small towns" },
  ];
  if (wet) list.push({ id: "rain", group: "Packing", label: "Rain jacket & waterproof phone pouch", why: `Rain is likely on ${forecast.filter(isWet).length} day(s)` });
  if (cold) list.push({ id: "warm", group: "Packing", label: "Fleece + light down jacket", why: "Evenings drop below 15°C" });
  if (hot) list.push({ id: "sun", group: "Packing", label: "Sunscreen SPF 50, cap & sunglasses", why: "Days go above 30°C" });
  if (has(/raft|kayak|snorkel|scuba|swim|sea walk|lagoon/i)) list.push({ id: "quickdry", group: "Packing", label: "Quick-dry clothes & a spare set", why: "You will get wet on the water activities" });
  if (has(/paraglid|trek|hike|jeep|fort|pass/i)) list.push({ id: "shoes", group: "Packing", label: "Closed shoes with good grip", why: "Required for paragliding and trails" });
  if (trip.destinationId === "bandipur" || trip.destinationId === "kabini") list.push({ id: "safari-permit", group: "Documents", label: "Government Safari Permit & ID Proof", why: "Mandatory check by Karnataka Forest Dept at safari gates" });
  if (trip.destinationId === "coorg" || trip.destinationId === "chikmagalur") list.push({ id: "leech-socks", group: "Packing", label: "Leech socks & rain poncho", why: "Recommended for coffee plantation walks & Western Ghats rainforest trails" });
  if (trip.prefs.kids > 0) list.push({ id: "kids", group: "Packing", label: "Snacks, wipes & a small backpack for the kids", why: "Long drives between places" });
  return list;
}
