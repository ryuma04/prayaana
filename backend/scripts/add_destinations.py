"""Adds destinations to backend/internal/seed/data/catalog.json (the single source of the catalog).

Run: python backend/scripts/add_destinations.py
Each destination has up to 5 experiences, real stays, real transport routes and national emergency
numbers. Ratings are not stored here: the server looks up real Google Maps ratings at runtime.
Re-running is safe (existing ids are replaced).
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "..", "internal", "seed", "data", "catalog.json")

TONE = {"adventure": "coral", "nature": "mint", "culture": "lavender", "food": "sun", "luxury": "pink", "social": "pink", "relax": "sky", "photo": "cream"}
NATIONAL = [
    {"label": "Emergency (police, fire, ambulance)", "phone": "112"},
    {"label": "Ambulance", "phone": "108"},
    {"label": "India tourist helpline", "phone": "1363"},
]


def dest(id, name, state, tagline, description, art, tone, lat, lng, moods, interests, best, rainy, ideal, gateway, from_city,
         climate, highlights, clusters, cab, transfer, languages):
    return {"id": id, "name": name, "state": state, "tagline": tagline, "description": description, "art": art, "tone": tone,
            "lat": lat, "lng": lng, "moods": moods, "interests": interests, "bestMonths": best, "rainyMonths": rainy, "idealDays": ideal,
            "gateway": gateway, "fromCity": from_city, "climate": {"tempC": climate[0], "condition": climate[1], "rainChance": climate[2]},
            "highlights": highlights, "clusters": clusters, "localCabPerDay": cab, "airportTransfer": transfer, "languages": languages,
            "emergency": NATIONAL}


def cluster(id, name, lunch, lunch_pp, dinner=None, dinner_pp=0):
    c = {"id": id, "name": name, "lunch": {"name": lunch, "pricePerPerson": lunch_pp}}
    if dinner:
        c["dinner"] = {"name": dinner, "pricePerPerson": dinner_pp}
    return c


def act(id, d, cluster, title, desc, interests, mins, price, energy, outdoor, slot, vendor, lat, lng, kids, walking, icon, backup=None):
    a = {"id": id, "destinationId": d, "cluster": cluster, "title": title, "description": desc, "interests": interests, "durationMin": mins,
         "price": price, "energy": energy, "outdoor": outdoor, "slot": slot, "vendorId": vendor, "lat": lat, "lng": lng, "kidFriendly": kids,
         "walking": walking, "icon": icon, "tone": TONE[interests[0]]}
    if backup:
        a["backupId"] = backup
    return a


def stay(id, d, name, type, price, area, amenities, tone, lat, lng):
    return {"id": id, "destinationId": d, "name": name, "type": type, "nightlyPrice": price, "vendorId": "v-" + id, "area": area,
            "amenities": amenities, "tone": tone, "lat": lat, "lng": lng}


def route(id, d, mode, label, frm, price, mins, departs, vendor):
    return {"id": id, "destinationId": d, "mode": mode, "label": label, "from": frm, "pricePerPerson": price, "durationMin": mins,
            "departs": departs, "vendorId": vendor}


def vendor(id, name, kind, d, language):
    contact = {"stay": "Reservations", "activity": "Bookings desk", "local": "Dispatch desk", "transport": "Reservations"}[kind]
    return {"id": id, "name": name, "kind": kind, "destinationId": d, "contactName": contact, "language": language}


D, A, S, T, V = [], [], [], [], []
COORD = {}

# ---------------------------------------------------------------- Darjeeling
D.append(dest("darjeeling", "Darjeeling", "West Bengal", "Tea gardens, toy trains & Kanchenjunga sunrises",
              "A colonial hill town on a ridge facing Kanchenjunga. Catch the sunrise at Tiger Hill, ride the UNESCO toy train "
              "round the Batasia Loop, walk a working tea estate and warm up at Glenary's on the Mall.",
              "mountain", "sky", 27.0410, 88.2663, ["Mountains", "Tea", "Heritage", "Cool weather"], ["nature", "culture", "food", "photo"],
              [3, 4, 5, 10, 11, 12], [6, 7, 8, 9], "3–4 days", "Bagdogra Airport (IXB), 70 km", "Kolkata", (14, "cloudy", 40),
              ["Tiger Hill sunrise", "Toy train joy ride", "Happy Valley tea estate", "Passenger ropeway"],
              [cluster("mall", "The Mall & Chowrasta", "Glenary's", 650, "Kunga Restaurant", 450),
               cluster("tiger-hill", "Tiger Hill & Ghoom", "Keventer's, Nehru Road", 450),
               cluster("north-point", "North Point & Lebong", "Sonam's Kitchen", 400)],
              3000, 3500, ["Nepali", "Bengali", "Hindi", "English"]))
A += [
    act("dar-tigerhill", "darjeeling", "tiger-hill", "Tiger Hill sunrise over Kanchenjunga",
        "A pre-dawn drive to 2,590 m to watch first light hit Kanchenjunga, stopping at Batasia Loop on the way back.",
        ["nature", "photo"], 180, 600, 2, True, "morning", "v-dar-jeeps", 26.9966, 88.2782, True, "low", "sunset", "dar-hmi"),
    act("dar-toytrain", "darjeeling", "mall", "Darjeeling Himalayan Railway joy ride",
        "The UNESCO-listed toy train from Darjeeling to Ghoom and round the Batasia Loop.",
        ["culture", "photo"], 120, 1600, 1, False, "afternoon", "v-dar-dhr", 27.0375, 88.2632, True, "low", "train"),
    act("dar-happyvalley", "darjeeling", "north-point", "Happy Valley tea estate walk & tasting",
        "Walk the terraces of one of Darjeeling's oldest estates and taste first-flush teas in the factory.",
        ["food", "nature"], 120, 300, 2, True, "morning", "v-dar-guides", 27.0569, 88.2601, True, "medium", "leaf", "dar-hmi"),
    act("dar-hmi", "darjeeling", "north-point", "Himalayan Mountaineering Institute museum",
        "Tenzing Norgay's institute: Everest expedition gear, maps and the story of Himalayan climbing.",
        ["culture", "adventure"], 120, 200, 2, False, "afternoon", "v-dar-guides", 27.0587, 88.2524, True, "medium", "museum"),
    act("dar-ropeway", "darjeeling", "north-point", "Passenger ropeway over the Rangeet valley",
        "A cable car from Singamari down over tea gardens towards the Rangeet river.",
        ["nature", "adventure"], 90, 250, 1, True, "afternoon", "v-dar-ropeway", 27.0582, 88.2555, True, "low", "cablecar", "dar-hmi"),
]
S += [
    stay("st-dar-dekeling", "darjeeling", "Dekeling Hotel", "budget", 3200, "Gandhi Road", ["Mountain view", "Tibetan breakfast"], "sun", 27.0415, 88.2662),
    stay("st-dar-windamere", "darjeeling", "Windamere Hotel", "boutique", 9500, "Observatory Hill", ["Heritage", "High tea", "Fireplace"], "sky", 27.0435, 88.2672),
    stay("st-dar-elgin", "darjeeling", "The Elgin, Darjeeling", "luxury", 14000, "Robertson Road", ["Heritage", "Spa", "All meals"], "pink", 27.0443, 88.2637),
]
T += [
    route("tr-dar-flight", "darjeeling", "flight", "IndiGo · CCU → IXB", "Kolkata", 4300, 65, "10:40", "v-tr-indigo"),
    route("tr-dar-train", "darjeeling", "train", "Darjeeling Mail 12343 · Sealdah → New Jalpaiguri", "Kolkata", 1500, 610, "22:05", "v-tr-irctc"),
]
V += [vendor("v-dar-cabs", "Darjeeling Hill Cabs", "local", "darjeeling", "Nepali"),
      vendor("v-dar-jeeps", "Tiger Hill Jeep Stand", "activity", "darjeeling", "Nepali"),
      vendor("v-dar-dhr", "Darjeeling Himalayan Railway", "activity", "darjeeling", "Hindi"),
      vendor("v-dar-guides", "Darjeeling Heritage Walks", "activity", "darjeeling", "English"),
      vendor("v-dar-ropeway", "Darjeeling Passenger Ropeway", "activity", "darjeeling", "Bengali")]
COORD["darjeeling"] = "tm-tenzin"

# ---------------------------------------------------------------- Munnar
D.append(dest("munnar", "Munnar", "Kerala", "Rolling tea hills, mist & Nilgiri tahr",
              "Kerala's high-range tea country. Spot Nilgiri tahr in Eravikulam, drive to Top Station, learn how tea is made "
              "and end the day with a Kathakali performance.",
              "mountain", "mint", 10.0889, 77.0595, ["Tea hills", "Nature", "Cool weather", "Honeymoon"], ["nature", "relax", "photo", "culture"],
              [9, 10, 11, 12, 1, 2, 3, 4, 5], [6, 7, 8], "3–4 days", "Cochin International Airport (COK), 110 km", "Bengaluru",
              (19, "cloudy", 45), ["Eravikulam National Park", "Top Station", "Tea Museum", "Mattupetty Dam"],
              [cluster("town", "Munnar town", "Saravana Bhavan, Munnar", 300, "Rapsy Restaurant", 350),
               cluster("rajamalai", "Eravikulam & Rajamalai", "KTDC Tea County restaurant", 600),
               cluster("mattupetty", "Mattupetty & Top Station", "SN Restaurant, Munnar", 350)],
              2800, 4200, ["Malayalam", "Tamil", "English"]))
A += [
    act("mun-eravikulam", "munnar", "rajamalai", "Eravikulam National Park & Nilgiri tahr",
        "A forest-department bus up Rajamalai to grasslands where the endangered Nilgiri tahr graze.",
        ["nature", "photo"], 180, 200, 3, True, "morning", "v-mun-guides", 10.1760, 77.0660, True, "medium", "mountain", "mun-teamuseum"),
    act("mun-teamuseum", "munnar", "town", "Tea Museum at Nallathanni",
        "See the old rollers and a working mini-factory, then taste fresh high-range tea.",
        ["culture", "food"], 90, 125, 1, False, "afternoon", "v-mun-guides", 10.0967, 77.0620, True, "low", "leaf"),
    act("mun-mattupetty", "munnar", "mattupetty", "Mattupetty Dam boat ride & Echo Point",
        "A speedboat on the reservoir ringed by tea slopes, then Echo Point on the way to Top Station.",
        ["nature", "relax"], 150, 600, 2, True, "afternoon", "v-mun-boats", 10.1060, 77.1240, True, "low", "boat", "mun-teamuseum"),
    act("mun-topstation", "munnar", "mattupetty", "Top Station viewpoint drive",
        "The highest point on the Munnar–Kodaikanal road, with views down into Tamil Nadu.",
        ["nature", "photo"], 240, 800, 2, True, "morning", "v-mun-cabs", 10.1255, 77.2440, True, "low", "car", "mun-teamuseum"),
    act("mun-kathakali", "munnar", "town", "Kathakali & Kalaripayattu evening show",
        "Kerala's classical dance-drama and martial art, with a make-up demonstration before the show.",
        ["culture"], 120, 400, 1, False, "evening", "v-mun-punarjani", 10.0710, 77.0690, True, "low", "dance"),
]
S += [
    stay("st-mun-teacounty", "munnar", "KTDC Tea County", "boutique", 5500, "Munnar town", ["Valley view", "Restaurant", "Garden"], "mint", 10.0925, 77.0610),
    stay("st-mun-blanket", "munnar", "Blanket Hotel & Spa", "luxury", 12500, "Attukad", ["Waterfall view", "Spa", "Pool"], "sky", 10.0550, 77.0450),
    stay("st-mun-windermere", "munnar", "Windermere Estate", "luxury", 17500, "Pothamedu", ["Cardamom estate", "All meals", "Walks"], "pink", 10.0721, 77.0650),
]
T += [
    route("tr-mun-flight", "munnar", "flight", "IndiGo · BLR → COK", "Bengaluru", 3600, 75, "08:10", "v-tr-indigo"),
    route("tr-mun-bus", "munnar", "bus", "KSRTC sleeper · Bengaluru → Munnar", "Bengaluru", 1400, 660, "20:30", "v-tr-kerala-rtc"),
]
V += [vendor("v-mun-cabs", "High Range Cabs", "local", "munnar", "Malayalam"),
      vendor("v-mun-guides", "Munnar Nature Guides", "activity", "munnar", "Malayalam"),
      vendor("v-mun-boats", "Mattupetty Boating (KSHB)", "activity", "munnar", "Malayalam"),
      vendor("v-mun-punarjani", "Punarjani Traditional Village", "activity", "munnar", "Malayalam"),
      vendor("v-tr-kerala-rtc", "Kerala RTC", "transport", "munnar", "Malayalam")]
COORD["munnar"] = "tm-fatima"

# ---------------------------------------------------------------- Varanasi
D.append(dest("varanasi", "Varanasi", "Uttar Pradesh", "Ghats, the evening aarti & old-city lanes",
              "One of the world's oldest living cities. Row past the ghats at sunrise, walk the lanes for kachori and lassi, "
              "visit Sarnath where the Buddha first taught, and watch the Ganga aarti at dusk.",
              "river", "sun", 25.3176, 82.9739, ["Spiritual", "Heritage", "Food", "Rivers"], ["culture", "food", "photo", "relax"],
              [10, 11, 12, 1, 2, 3], [7, 8], "2–3 days", "Lal Bahadur Shastri Airport (VNS), 25 km", "Delhi", (30, "sunny", 15),
              ["Ganga aarti", "Sunrise boat ride", "Sarnath", "Old-city food"],
              [cluster("ghats", "Dashashwamedh & the ghats", "Blue Lassi Shop", 250, "Brown Bread Bakery", 500),
               cluster("sarnath", "Sarnath", "Tibetan canteen, Sarnath", 300),
               cluster("assi", "Assi Ghat & BHU", "Vaatika Café, Assi Ghat", 400)],
              2200, 1100, ["Hindi", "Bhojpuri", "English"]))
A += [
    act("var-boat", "varanasi", "ghats", "Sunrise boat ride along the ghats",
        "A rowing boat from Dashashwamedh past Manikarnika as the city wakes up.",
        ["culture", "photo", "relax"], 90, 700, 1, True, "morning", "v-var-boats", 25.3068, 83.0102, True, "low", "boat", "var-bhu"),
    act("var-walk", "varanasi", "ghats", "Old-city lanes & food walk",
        "Kachori-sabzi, malaiyo in winter and lassi through the lanes behind the ghats.",
        ["food", "culture"], 150, 900, 2, True, "afternoon", "v-var-guides", 25.3100, 83.0090, True, "medium", "food", "var-bhu"),
    act("var-sarnath", "varanasi", "sarnath", "Sarnath: Dhamek Stupa & museum",
        "Where the Buddha gave his first sermon, with the Ashokan lion capital in the museum.",
        ["culture"], 180, 300, 2, True, "morning", "v-var-cabs", 25.3811, 83.0243, True, "medium", "temple", "var-bhu"),
    act("var-bhu", "varanasi", "assi", "Bharat Kala Bhavan museum, BHU",
        "Miniature paintings, Banarasi textiles and sculpture on the Banaras Hindu University campus.",
        ["culture"], 90, 100, 1, False, "afternoon", "v-var-guides", 25.2677, 82.9913, True, "low", "museum"),
    act("var-aarti", "varanasi", "ghats", "Ganga aarti at Dashashwamedh Ghat",
        "Priests with brass lamps, bells and conch shells at dusk; watch from the steps or a boat.",
        ["culture", "photo"], 75, 0, 1, True, "evening", "v-var-guides", 25.3065, 83.0104, True, "low", "temple", "var-bhu"),
]
S += [
    stay("st-var-alka", "varanasi", "Hotel Alka", "budget", 2600, "Meer Ghat", ["River terrace", "Restaurant"], "sun", 25.3095, 83.0126),
    stay("st-var-suryauday", "varanasi", "Suryauday Haveli", "boutique", 8500, "Shivala Ghat", ["Heritage haveli", "River view", "Yoga"], "lavender", 25.2955, 83.0215),
    stay("st-var-brijrama", "varanasi", "BrijRama Palace", "luxury", 25000, "Darbhanga Ghat", ["Palace on the ghats", "Boat transfers", "Spa"], "pink", 25.3070, 83.0110),
]
T += [
    route("tr-var-flight", "varanasi", "flight", "IndiGo · DEL → VNS", "Delhi", 4500, 90, "06:40", "v-tr-indigo"),
    route("tr-var-train", "varanasi", "train", "Vande Bharat 22436 · New Delhi → Varanasi", "Delhi", 1800, 480, "06:00", "v-tr-irctc"),
]
V += [vendor("v-var-cabs", "Kashi Cabs", "local", "varanasi", "Hindi"),
      vendor("v-var-boats", "Dashashwamedh Boatmen", "activity", "varanasi", "Hindi"),
      vendor("v-var-guides", "Banaras Heritage Walks", "activity", "varanasi", "Hindi")]
COORD["varanasi"] = "tm-deepak"

# ---------------------------------------------------------------- Coorg
D.append(dest("coorg", "Coorg", "Karnataka", "Coffee estates, waterfalls & misty hills",
              "Kodagu's coffee and pepper country. Walk a plantation, meet the elephants at Dubare, see the golden Namdroling "
              "monastery and watch the sunset from Raja's Seat.",
              "mountain", "mint", 12.4244, 75.7382, ["Coffee", "Nature", "Waterfalls", "Slow travel"], ["nature", "relax", "food", "adventure"],
              [10, 11, 12, 1, 2, 3, 4, 5], [6, 7, 8, 9], "3 days", "Mangaluru Airport (IXE), 140 km", "Bengaluru", (22, "cloudy", 35),
              ["Coffee estate walk", "Dubare elephants", "Abbey Falls", "Namdroling monastery"],
              [cluster("madikeri", "Madikeri town", "Coorg Cuisine, Madikeri", 400, "Raintree Restaurant, Madikeri", 600),
               cluster("kushalnagar", "Kushalnagar & Dubare", "Tibetan canteen, Bylakuppe", 300)],
              2600, 4500, ["Kannada", "Kodava", "English"]))
A += [
    act("coo-abbey", "coorg", "madikeri", "Abbey Falls walk",
        "A short walk down through coffee and pepper to a waterfall that roars after the rains.",
        ["nature"], 90, 30, 2, True, "morning", "v-coo-guides", 12.4552, 75.7195, True, "medium", "tree", "coo-namdroling"),
    act("coo-coffee", "coorg", "madikeri", "Coffee plantation walk & tasting",
        "Follow the bean from shade-grown bush to cup on a working Kodava estate.",
        ["food", "nature"], 150, 800, 2, True, "afternoon", "v-coo-estate", 12.4000, 75.7500, True, "medium", "leaf", "coo-namdroling"),
    act("coo-dubare", "coorg", "kushalnagar", "Dubare Elephant Camp",
        "Cross the Kaveri by boat to watch the camp's elephants bathe and feed in the morning.",
        ["nature", "adventure"], 180, 600, 2, True, "morning", "v-coo-guides", 12.3663, 75.9063, True, "low", "tree", "coo-namdroling"),
    act("coo-namdroling", "coorg", "kushalnagar", "Namdroling Golden Temple, Bylakuppe",
        "The golden prayer hall of India's largest Tibetan settlement.",
        ["culture"], 120, 0, 1, False, "afternoon", "v-coo-cabs", 12.4302, 75.9667, True, "low", "temple"),
    act("coo-rajaseat", "coorg", "madikeri", "Sunset at Raja's Seat",
        "The garden where Kodava kings watched the sun set over the Western Ghats.",
        ["relax", "photo"], 60, 20, 1, True, "evening", "v-coo-guides", 12.4174, 75.7375, True, "low", "sunset", "coo-namdroling"),
]
S += [
    stay("st-coo-intl", "coorg", "Hotel Coorg International", "budget", 3500, "Madikeri", ["Restaurant", "Garden"], "sun", 12.4230, 75.7380),
    stay("st-coo-mahindra", "coorg", "Club Mahindra Madikeri", "boutique", 9000, "Madikeri", ["Valley view", "Pool", "Kids club"], "sky", 12.4160, 75.7450),
    stay("st-coo-tamara", "coorg", "The Tamara Coorg", "luxury", 26000, "Kabbinakad estate", ["Coffee estate", "Spa", "All meals"], "pink", 12.3035, 75.6969),
]
T += [
    route("tr-coo-bus", "coorg", "bus", "KSRTC Airavat · Bengaluru → Madikeri", "Bengaluru", 800, 330, "07:00", "v-tr-ksrtc"),
    route("tr-coo-car", "coorg", "car", "Private Innova · Bengaluru → Madikeri", "Bengaluru", 2200, 330, "06:30", "v-coo-cabs"),
]
V += [vendor("v-coo-cabs", "Kodagu Cabs", "local", "coorg", "Kannada"),
      vendor("v-coo-guides", "Coorg Trails", "activity", "coorg", "Kannada"),
      vendor("v-coo-estate", "Kodava Coffee Estate Tours", "activity", "coorg", "Kodava"),
      vendor("v-tr-ksrtc", "Karnataka SRTC", "transport", "coorg", "Kannada")]
COORD["coorg"] = "tm-fatima"

# ---------------------------------------------------------------- Hampi
D.append(dest("hampi", "Hampi", "Karnataka", "Boulder hills & the ruins of Vijayanagara",
              "The ruined capital of the Vijayanagara empire among giant boulders on the Tungabhadra. See the stone chariot at "
              "Vittala, climb Matanga Hill for sunrise and float in a coracle.",
              "fort", "sun", 15.3350, 76.4600, ["Heritage", "Ruins", "Boulders", "Sunsets"], ["culture", "photo", "adventure", "nature"],
              [10, 11, 12, 1, 2], [7, 8], "2–3 days", "Jindal Vijaynagar Airport (VDY), 40 km · Hosapete station, 13 km", "Bengaluru",
              (30, "sunny", 15), ["Vittala Temple", "Matanga Hill sunrise", "Virupaksha Temple", "Coracle ride"],
              [cluster("sacred", "Hampi Bazaar & Virupaksha", "Mango Tree Restaurant", 450, "Gopi Rooftop Restaurant", 400),
               cluster("royal", "Royal Centre & Vittala", "KSTDC Mayura Bhuvaneshwari, Kamalapur", 350)],
              2200, 1500, ["Kannada", "Hindi", "English"]))
A += [
    act("ham-vittala", "hampi", "royal", "Vittala Temple & the stone chariot",
        "The musical pillars and the stone chariot of Hampi's finest temple complex.",
        ["culture", "photo"], 150, 40, 3, True, "morning", "v-ham-guides", 15.3421, 76.4749, True, "medium", "temple", "ham-museum"),
    act("ham-virupaksha", "hampi", "sacred", "Virupaksha Temple & Hampi Bazaar",
        "A living temple since the 7th century, with the long colonnaded bazaar in front.",
        ["culture"], 90, 0, 2, False, "afternoon", "v-ham-guides", 15.3350, 76.4600, True, "medium", "temple"),
    act("ham-matanga", "hampi", "sacred", "Matanga Hill sunrise climb",
        "A short, steep scramble to the highest point for sunrise over the ruins.",
        ["adventure", "photo", "nature"], 150, 500, 4, True, "morning", "v-ham-guides", 15.3340, 76.4660, False, "high", "hike", "ham-museum"),
    act("ham-coracle", "hampi", "royal", "Coracle ride on the Tungabhadra",
        "A round basket boat spun gently between the boulders downstream of Vittala.",
        ["nature", "adventure"], 45, 300, 1, True, "afternoon", "v-ham-coracle", 15.3450, 76.4770, True, "low", "boat", "ham-museum"),
    act("ham-museum", "hampi", "royal", "ASI Archaeological Museum, Kamalapur",
        "Sculpture, coins and a scale model of the whole city, a good first stop.",
        ["culture"], 75, 10, 1, False, "afternoon", "v-ham-guides", 15.3180, 76.4730, True, "low", "museum"),
]
S += [
    stay("st-ham-mayura", "hampi", "KSTDC Mayura Bhuvaneshwari", "budget", 2500, "Kamalapur", ["Restaurant", "Garden"], "sun", 15.3190, 76.4740),
    stay("st-ham-boulders", "hampi", "Hampi Boulders Resort", "boutique", 9000, "Narayanpet", ["Riverside", "Natural pool", "Meals"], "mint", 15.3570, 76.4600),
    stay("st-ham-evolve", "hampi", "Evolve Back Hampi", "luxury", 32000, "Kamalapur", ["Palace-style", "Pool", "All meals"], "pink", 15.3085, 76.4815),
]
T += [
    route("tr-ham-train", "hampi", "train", "Hampi Express 16591 · Bengaluru → Hosapete", "Bengaluru", 900, 540, "22:00", "v-tr-irctc"),
    route("tr-ham-bus", "hampi", "bus", "KSRTC sleeper · Bengaluru → Hosapete", "Bengaluru", 950, 480, "22:30", "v-tr-ksrtc"),
]
V += [vendor("v-ham-cabs", "Hampi Autos & Cabs", "local", "hampi", "Kannada"),
      vendor("v-ham-guides", "Hampi Heritage Guides", "activity", "hampi", "Kannada"),
      vendor("v-ham-coracle", "Tungabhadra Coracle Men", "activity", "hampi", "Kannada")]
COORD["hampi"] = "tm-fatima"

# ---------------------------------------------------------------- Puducherry
D.append(dest("pondicherry", "Puducherry", "Puducherry", "French Quarter lanes, cafés & quiet beaches",
              "Yellow French-era villas, a seaside promenade and the calm of Auroville. Walk White Town, take the boat to "
              "Paradise Beach and try a surf lesson at Serenity.",
              "beach", "sky", 11.9416, 79.8083, ["French Quarter", "Beaches", "Cafés", "Slow travel"], ["relax", "food", "culture", "social"],
              [12, 1, 2, 3], [10, 11], "3 days", "Chennai International Airport (MAA), 150 km", "Chennai", (30, "sunny", 20),
              ["White Town walk", "Auroville", "Paradise Beach", "Promenade evenings"],
              [cluster("white-town", "White Town", "Café des Arts", 500, "Villa Shanti restaurant", 1200),
               cluster("auroville", "Auroville", "Tanto Pizzeria, Auroville", 700),
               cluster("paradise", "Chunnambar & Paradise Beach", "Chunnambar boat house café", 350)],
              2200, 3800, ["Tamil", "French", "English"]))
A += [
    act("pon-heritage", "pondicherry", "white-town", "French Quarter heritage walk",
        "Mustard-yellow villas, bougainvillea and churches of White Town on foot.",
        ["culture", "photo"], 120, 500, 2, True, "morning", "v-pon-guides", 11.9340, 79.8350, True, "medium", "walk", "pon-ashram"),
    act("pon-auroville", "pondicherry", "auroville", "Auroville & the Matrimandir viewpoint",
        "The experimental township and its golden Matrimandir, seen from the viewing garden.",
        ["culture", "relax"], 180, 0, 2, True, "afternoon", "v-pon-cabs", 12.0070, 79.8108, True, "medium", "lotus", "pon-ashram"),
    act("pon-paradise", "pondicherry", "paradise", "Paradise Beach by boat",
        "A backwater boat from Chunnambar to a sandbar beach with calm water.",
        ["relax", "nature"], 180, 450, 2, True, "morning", "v-pon-boats", 11.8883, 79.8161, True, "low", "beach", "pon-ashram"),
    act("pon-surf", "pondicherry", "auroville", "Surf lesson at Serenity Beach",
        "A beginner lesson with a local surf school on the gentle breaks north of town.",
        ["adventure", "social"], 120, 2500, 4, True, "morning", "v-pon-surf", 11.9760, 79.8395, False, "low", "swim", "pon-ashram"),
    act("pon-ashram", "pondicherry", "white-town", "Sri Aurobindo Ashram & the promenade",
        "Quiet meditation at the ashram, then the evening stroll on the seafront Goubert Avenue.",
        ["relax", "culture"], 90, 0, 1, False, "evening", "v-pon-guides", 11.9368, 79.8352, True, "low", "lotus"),
]
S += [
    stay("st-pon-promenade", "pondicherry", "The Promenade", "boutique", 6800, "White Town", ["Sea view", "Rooftop", "Pool"], "sky", 11.9325, 79.8365),
    stay("st-pon-villashanti", "pondicherry", "Villa Shanti", "boutique", 8200, "White Town", ["Heritage villa", "Courtyard", "Restaurant"], "sun", 11.9357, 79.8343),
    stay("st-pon-mahe", "pondicherry", "Palais de Mahe", "luxury", 11500, "White Town", ["Colonial mansion", "Pool", "Bicycles"], "pink", 11.9330, 79.8340),
]
T += [
    route("tr-pon-bus", "pondicherry", "bus", "PRTC AC bus · Chennai → Puducherry (ECR)", "Chennai", 450, 210, "07:00", "v-tr-prtc"),
    route("tr-pon-car", "pondicherry", "car", "Private sedan · Chennai → Puducherry", "Chennai", 1800, 180, "07:00", "v-pon-cabs"),
]
V += [vendor("v-pon-cabs", "Pondy Coast Cabs", "local", "pondicherry", "Tamil"),
      vendor("v-pon-guides", "White Town Walks", "activity", "pondicherry", "English"),
      vendor("v-pon-boats", "Chunnambar Boat House (PTDC)", "activity", "pondicherry", "Tamil"),
      vendor("v-pon-surf", "Serenity Surf School", "activity", "pondicherry", "English"),
      vendor("v-tr-prtc", "Puducherry Road Transport Corporation", "transport", "pondicherry", "Tamil")]
COORD["pondicherry"] = "tm-fatima"

# ---------------------------------------------------------------- Jaisalmer
D.append(dest("jaisalmer", "Jaisalmer", "Rajasthan", "The golden fort, havelis & Thar dunes",
              "A living sandstone fort rising out of the Thar. Explore Sonar Qila and Patwon ki Haveli, ride camels at Sam at "
              "sunset and drive out to the abandoned village of Kuldhara.",
              "desert", "sun", 26.9157, 70.9083, ["Desert", "Forts", "Camps", "Stars"], ["culture", "adventure", "photo", "luxury"],
              [10, 11, 12, 1, 2, 3], [7, 8], "3 days", "Jaisalmer Airport (JSA), 12 km (winter flights)", "Delhi", (32, "sunny", 5),
              ["Sonar Qila", "Sam dunes at sunset", "Patwon ki Haveli", "Gadisar Lake"],
              [cluster("fort", "Sonar Qila & old city", "Saffron, Nachana Haveli", 700, "The Trio", 700),
               cluster("sam", "Sam sand dunes", "Desert camp thali, Sam", 500),
               cluster("gadisar", "Gadisar Lake", "Natraj Restaurant", 400)],
              2400, 800, ["Hindi", "Marwari", "English"]))
A += [
    act("jsm-fort", "jaisalmer", "fort", "Sonar Qila & the Jain temples",
        "Walk the lanes of a fort people still live in, with finely carved 12th-century Jain temples inside.",
        ["culture", "photo"], 150, 250, 3, True, "morning", "v-jsm-guides", 26.9124, 70.9129, True, "medium", "castle", "jsm-patwon"),
    act("jsm-patwon", "jaisalmer", "fort", "Patwon ki Haveli",
        "Five merchant mansions with honeycombed stone balconies, one restored as a museum.",
        ["culture"], 75, 100, 1, False, "afternoon", "v-jsm-guides", 26.9178, 70.9152, True, "low", "palace"),
    act("jsm-gadisar", "jaisalmer", "gadisar", "Gadisar Lake at sunrise",
        "A rowing boat past the chhatris and the carved Tilon ki Pol gateway.",
        ["relax", "photo"], 60, 200, 1, True, "morning", "v-jsm-guides", 26.9055, 70.9240, True, "low", "boat", "jsm-patwon"),
    act("jsm-kuldhara", "jaisalmer", "sam", "Kuldhara abandoned village",
        "The deserted Paliwal village on the way to the dunes, left empty for two centuries.",
        ["culture", "adventure"], 150, 900, 2, True, "afternoon", "v-jsm-cabs", 26.8120, 70.8040, True, "low", "jeep", "jsm-patwon"),
    act("jsm-dunes", "jaisalmer", "sam", "Camel safari at Sam dunes",
        "Ride into the dunes for sunset, then folk music under the desert stars.",
        ["adventure", "photo"], 180, 1500, 2, True, "evening", "v-jsm-camels", 26.8350, 70.5080, True, "low", "camel", "jsm-patwon"),
]
S += [
    stay("st-jsm-pleasant", "jaisalmer", "Hotel Pleasant Haveli", "budget", 3200, "Old city", ["Rooftop fort view", "Restaurant"], "sun", 26.9190, 70.9095),
    stay("st-jsm-nachana", "jaisalmer", "Hotel Nachana Haveli", "boutique", 6200, "Gandhi Chowk", ["300-year-old haveli", "Rooftop", "Restaurant"], "lavender", 26.9175, 70.9120),
    stay("st-jsm-suryagarh", "jaisalmer", "Suryagarh", "luxury", 22000, "Sam Road", ["Fort-palace hotel", "Pool", "Desert dinners"], "pink", 26.8930, 70.8500),
]
T += [
    route("tr-jsm-flight", "jaisalmer", "flight", "IndiGo · DEL → JSA (winter)", "Delhi", 5800, 110, "11:30", "v-tr-indigo"),
    route("tr-jsm-train", "jaisalmer", "train", "Delhi–Jaisalmer Express 14659", "Delhi", 1600, 1065, "17:45", "v-tr-irctc"),
]
V += [vendor("v-jsm-cabs", "Thar Cabs", "local", "jaisalmer", "Hindi"),
      vendor("v-jsm-guides", "Golden City Guides", "activity", "jaisalmer", "Hindi"),
      vendor("v-jsm-camels", "Sam Dunes Camel Safaris", "activity", "jaisalmer", "Marwari")]
COORD["jaisalmer"] = "tm-arjun"

# ---------------------------------------------------------------- Amritsar
D.append(dest("amritsar", "Amritsar", "Punjab", "The Golden Temple, langar & Wagah",
              "The spiritual heart of Sikhism and Punjab's food capital. Eat at the langar in the Golden Temple, see the "
              "Partition Museum, watch the border ceremony at Attari–Wagah and hunt for the best Amritsari kulcha.",
              "fort", "sun", 31.6340, 74.8723, ["Spiritual", "Food", "Heritage", "History"], ["culture", "food", "social", "photo"],
              [10, 11, 12, 1, 2, 3], [7, 8], "2 days", "Sri Guru Ram Dass Jee International Airport (ATQ), 11 km", "Delhi", (25, "sunny", 15),
              ["Golden Temple", "Attari–Wagah ceremony", "Partition Museum", "Amritsari kulcha"],
              [cluster("golden", "Golden Temple & old city", "Kesar Da Dhaba", 350, "Bharawan Da Dhaba", 350),
               cluster("wagah", "Attari–Wagah border", "Makhan Fish & Chicken Corner", 450)],
              2200, 700, ["Punjabi", "Hindi", "English"]))
A += [
    act("amr-golden", "amritsar", "golden", "Golden Temple & the langar",
        "Walk the marble parikrama round the sacred pool and share the free community meal.",
        ["culture", "food"], 150, 0, 2, True, "morning", "v-amr-guides", 31.6200, 74.8765, True, "medium", "temple", "amr-partition"),
    act("amr-foodwalk", "amritsar", "golden", "Amritsari food walk",
        "Kulcha with chole, a tall glass of lassi and hot jalebi in the old-city lanes.",
        ["food", "social"], 150, 1200, 2, True, "morning", "v-amr-guides", 31.6230, 74.8790, True, "medium", "food", "amr-partition"),
    act("amr-partition", "amritsar", "golden", "Partition Museum, Town Hall",
        "Stories, letters and objects from 1947, told through the people who lived it.",
        ["culture"], 120, 10, 1, False, "afternoon", "v-amr-guides", 31.6257, 74.8767, True, "low", "museum"),
    act("amr-jallianwala", "amritsar", "golden", "Jallianwala Bagh memorial",
        "The garden of the 1919 massacre, with the bullet-marked walls and the martyrs' well.",
        ["culture"], 60, 0, 1, True, "afternoon", "v-amr-guides", 31.6207, 74.8802, True, "low", "walk", "amr-partition"),
    act("amr-wagah", "amritsar", "wagah", "Beating Retreat at Attari–Wagah",
        "The high-energy flag-lowering ceremony at the India–Pakistan border every evening.",
        ["culture", "social"], 240, 700, 2, True, "afternoon", "v-amr-cabs", 31.6047, 74.5728, True, "low", "star", "amr-partition"),
]
S += [
    stay("st-amr-jugaadus", "amritsar", "Jugaadus Eco Hostel", "hostel", 800, "Near the Golden Temple", ["Rooftop", "Common kitchen"], "lavender", 31.6250, 74.8750),
    stay("st-amr-svaasa", "amritsar", "Ranjit's Svaasa", "boutique", 7200, "Mall Road", ["Heritage haveli", "Spa", "Garden"], "mint", 31.6440, 74.8710),
    stay("st-amr-tajswarna", "amritsar", "Taj Swarna", "luxury", 11500, "Outer Circular Road", ["Pool", "Spa", "Punjabi restaurant"], "pink", 31.6450, 74.8540),
]
T += [
    route("tr-amr-flight", "amritsar", "flight", "IndiGo · DEL → ATQ", "Delhi", 3800, 75, "08:30", "v-tr-indigo"),
    route("tr-amr-train", "amritsar", "train", "Shatabdi Express 12013 · New Delhi → Amritsar", "Delhi", 1300, 380, "16:30", "v-tr-irctc"),
]
V += [vendor("v-amr-cabs", "Ambarsar Cabs", "local", "amritsar", "Punjabi"),
      vendor("v-amr-guides", "Amritsar Heritage Walks", "activity", "amritsar", "Punjabi")]
COORD["amritsar"] = "tm-priya"

# ---------------------------------------------------------------- Mumbai
D.append(dest("mumbai", "Mumbai", "Maharashtra", "The City of Dreams, Marine Drive sunsets & vibrant street food",
              "India’s buzzing coastal metropolis. Sunset strolls along Marine Drive's Queen’s Necklace, ferry trips from the Gateway of India to Elephanta Caves, heritage Art Deco walks, Bandra cafés and legendary street eats.",
              "beach", "sun", 18.9220, 72.8347, ["Beaches", "Nightlife", "Food", "Heritage", "Cafés"], ["food", "culture", "social", "luxury"],
              [10, 11, 12, 1, 2, 3], [6, 7, 8, 9], "3–4 days", "Chhatrapati Shivaji Maharaj Airport (BOM), 15 km", "Delhi",
              (30, "sunny", 15), ["Gateway of India & Elephanta ferry", "Marine Drive sunset", "Colaba Causeway & Kala Ghoda art district", "Bandra Bandstand walk"],
              [cluster("colaba", "South Mumbai & Colaba", "Britannia & Co.", 650, "Café Mondegar", 850),
               cluster("marine", "Marine Drive & Nariman Point", "Pizza By The Bay", 800, "Bayview", 1200),
               cluster("bandra", "Bandra & Khar", "Subko Coffee Bandra", 550, "Bastian Bandra", 1600)],
              2500, 950, ["Marathi", "Hindi", "English"]))
A += [
    act("mum-gateway", "mumbai", "colaba", "Gateway of India & Elephanta ferry",
        "Board a harbour ferry from the Gateway to the 6th-century rock-cut Elephanta Caves.",
        ["culture", "photo"], 180, 260, 2, True, "morning", "v-mum-boats", 18.9220, 72.8347, True, "medium", "boat", "mum-mondegar"),
    act("mum-marinedrive", "mumbai", "marine", "Marine Drive & Queen's Necklace sunset stroll",
        "Walk along the iconic curving seaside promenade as the city lights up at twilight.",
        ["relax", "photo"], 90, 0, 1, True, "evening", "v-mum-guides", 18.9302, 72.8219, True, "medium", "sunset"),
    act("mum-mondegar", "mumbai", "colaba", "Kala Ghoda art walk & Café Mondegar",
        "Explore colonial heritage facades, gallery lanes, and jukebox beer at Mondegar.",
        ["food", "culture"], 120, 850, 1, False, "afternoon", "v-mum-guides", 18.9240, 72.8315, True, "low", "food"),
    act("mum-bandra", "mumbai", "bandra", "Bandra heritage village & Bandstand walk",
        "Portuguese bungalows in Ranwar village, street art, and sea breezes at Bandstand.",
        ["culture", "social"], 120, 500, 2, True, "evening", "v-mum-guides", 19.0540, 72.8250, True, "medium", "walk"),
]
S += [
    stay("st-mum-hostel", "mumbai", "Zostel Mumbai", "hostel", 1100, "Andheri East", ["Café", "Coworking", "Wi-Fi"], "lavender", 19.1136, 72.8697),
    stay("st-mum-marine", "mumbai", "Sea Green Hotel", "budget", 4200, "Marine Drive", ["Sea view", "Breakfast", "Heritage"], "sun", 18.9325, 72.8235),
    stay("st-mum-taj", "mumbai", "The Taj Mahal Palace", "luxury", 38000, "Apollo Bunder, Colaba", ["Harbour view", "Historic palace", "Butler"], "pink", 18.9217, 72.8333),
]
T += [
    route("tr-mum-flight", "mumbai", "flight", "IndiGo · DEL → BOM", "Delhi", 4400, 130, "06:30", "v-tr-indigo"),
    route("tr-mum-train", "mumbai", "train", "Mumbai Rajdhani 12952 · NDLS → MMCT", "Delhi", 2400, 930, "16:55", "v-tr-irctc"),
]
V += [vendor("v-mum-cabs", "Mumbai Premier Cabs", "local", "mumbai", "Marathi"),
      vendor("v-mum-guides", "Bombay Heritage Walks", "activity", "mumbai", "English"),
      vendor("v-mum-boats", "Elephanta Ferry Services", "activity", "mumbai", "Marathi")]
COORD["mumbai"] = "tm-fatima"

# ---------------------------------------------------------------- Agra
D.append(dest("agra", "Agra", "Uttar Pradesh", "The wonder of the Taj Mahal & grand Mughal palaces",
              "Home to the eternal monument of love. Watch the sunrise illuminate the white marble of the Taj Mahal, explore the imposing red sandstone ramparts of Agra Fort, and wander the ghost city of Fatehpur Sikri.",
              "fort", "pink", 27.1767, 78.0081, ["Heritage", "Romance", "Food"], ["culture", "photo", "luxury"],
              [10, 11, 12, 1, 2, 3], [7, 8], "2–3 days", "Indira Gandhi Airport, Delhi (DEL), 200 km", "Delhi",
              (28, "sunny", 10), ["Taj Mahal sunrise view", "Agra Fort Mughal pavilions", "Mehtab Bagh sunset reflection", "Fatehpur Sikri royal complex"],
              [cluster("taj", "Taj Ganj & East Gate", "Pinch of Spice", 750, "Esphahan", 2200),
               cluster("fort", "Agra Fort & Kinari Bazaar", "Deviram Sweets", 250, "Peshawri", 1800),
               cluster("fatehpur", "Fatehpur Sikri", "Heritage Dhaba", 350)],
              2000, 1500, ["Hindi", "Urdu", "English"]))
A += [
    act("agr-taj", "agra", "taj", "Taj Mahal sunrise guided tour",
        "Witness the ivory-white marble minarets glowing in soft morning golden hour light.",
        ["culture", "photo"], 150, 1100, 2, True, "morning", "v-agr-guides", 27.1751, 78.0421, True, "medium", "palace", "agr-itmad"),
    act("agr-fort", "agra", "fort", "Agra Fort Mughal imperial pavilions",
        "Red sandstone walled fortress palace overlooking the Yamuna and the Taj Mahal.",
        ["culture", "photo"], 120, 650, 2, True, "afternoon", "v-agr-guides", 27.1795, 78.0211, True, "medium", "castle"),
    act("agr-itmad", "agra", "taj", "Itmad-ud-Daula (Baby Taj) & Mehtab Bagh",
        "Delicate marble inlay work, followed by sunset reflections of the Taj across the river.",
        ["culture", "relax"], 120, 300, 1, True, "evening", "v-agr-guides", 27.1929, 78.0310, True, "low", "temple"),
    act("agr-fatehpur", "agra", "fatehpur", "Fatehpur Sikri ghost city day trip",
        "Akbar’s abandoned red sandstone imperial capital and the soaring Buland Darwaza.",
        ["culture", "photo"], 240, 750, 3, True, "morning", "v-agr-guides", 27.0940, 77.6670, True, "high", "castle"),
]
S += [
    stay("st-agr-hostel", "agra", "Bedweiser Backpackers Hostel", "hostel", 750, "Taj Ganj", ["Rooftop café", "Wi-Fi"], "lavender", 27.1650, 78.0410),
    stay("st-agr-budget", "agra", "Taj Resort Agra", "budget", 2600, "East Gate Taj", ["Rooftop pool", "Taj view"], "mint", 27.1710, 78.0460),
    stay("st-agr-luxury", "agra", "The Oberoi Amarvilas", "luxury", 46000, "Taj East Gate", ["Uninterrupted Taj view", "Luxury spa", "Pool"], "pink", 27.1690, 78.0520),
]
T += [
    route("tr-agr-train", "agra", "train", "Gatimaan Express 12050 · NZM → AGC", "Delhi", 850, 100, "08:10", "v-tr-irctc"),
    route("tr-agr-car", "agra", "car", "Yamuna Expressway Private Sedan · Delhi → Agra", "Delhi", 2800, 160, "06:30", "v-agr-cabs"),
]
V += [vendor("v-agr-cabs", "Taj Express Cabs", "local", "agra", "Hindi"),
      vendor("v-agr-guides", "Mughal Heritage Guides", "activity", "agra", "English")]
COORD["agra"] = "tm-arjun"

# ---------------------------------------------------------------- Ooty
D.append(dest("ooty", "Ooty", "Tamil Nadu", "Queen of Nilgiri hill stations, toy trains & tea gardens",
              "Nestled in the Nilgiri blue mountains. Ride the UNESCO heritage mountain railway, walk through emerald tea plantations, row on Ooty lake and soak in cool misty pine hill breezes.",
              "mountain", "mint", 11.4102, 76.6950, ["Mountains", "Cool weather", "Slow travel", "Romance"], ["nature", "relax", "photo", "adventure"],
              [10, 11, 12, 1, 2, 3, 4, 5, 6], [7, 8], "3–4 days", "Coimbatore International Airport (CJB), 88 km", "Bengaluru",
              (17, "cloudy", 25), ["Nilgiri Mountain Railway toy train", "Government Botanical & Rose Gardens", "Doddabetta Peak panoramic view", "Pykara Lake waterfalls"],
              [cluster("town", "Ooty Town & Lake", "Nahar Sidewalk Café", 450, "Earl's Secret", 1100),
               cluster("doddabetta", "Doddabetta & Tea Estates", "Tea Factory Bistro", 400, "Savoy Dining Room", 1200)],
              2400, 2800, ["Tamil", "English", "Kannada"]))
A += [
    act("oty-toytrain", "ooty", "town", "Nilgiri Mountain Railway toy train ride",
        "UNESCO heritage steam locomotive route winding past tunnels, pine forests and tea ridges.",
        ["nature", "photo"], 150, 450, 1, True, "morning", "v-oty-guides", 11.4060, 76.6950, True, "low", "train", "oty-botanical"),
    act("oty-lake", "ooty", "town", "Ooty Lake boating & cycling",
        "Paddle across the scenic lake fringed by eucalyptus trees, followed by cycle rides.",
        ["relax", "adventure"], 90, 350, 2, True, "afternoon", "v-oty-boats", 11.4063, 76.6879, True, "medium", "boat"),
    act("oty-tea-estate", "ooty", "doddabetta", "Doddabetta Peak & Tea Factory tour",
        "Nilgiri highest viewpoint at 2,637 m and hands-on orthodox tea manufacturing tasting.",
        ["nature", "food"], 150, 300, 2, True, "morning", "v-oty-guides", 11.4010, 76.7350, True, "medium", "leaf"),
    act("oty-botanical", "ooty", "town", "Government Rose Garden & Botanical Walk",
        "Over 20,000 varieties of vibrant roses and exotic Nilgiri ferns on terraced slopes.",
        ["nature", "relax"], 90, 100, 1, True, "afternoon", "v-oty-guides", 11.4063, 76.7090, True, "low", "leaf"),
]
S += [
    stay("st-oty-hostel", "ooty", "Zostel Ooty", "hostel", 950, "Fernhill", ["Mountain views", "Bonfire", "Café"], "lavender", 11.3980, 76.6850),
    stay("st-oty-budget", "ooty", "Hotel Lakeview Ooty", "budget", 2500, "West Mere", ["Cottages", "Lake view"], "mint", 11.4020, 76.6820),
    stay("st-oty-luxury", "ooty", "Savoy - IHCL SeleQtions", "luxury", 18500, "Sylks Road", ["Heritage colonial", "High tea", "Fireplace"], "pink", 11.4120, 76.7010),
]
T += [
    route("tr-oty-flight", "ooty", "flight", "IndiGo · BLR → CJB + Nilgiri cab", "Bengaluru", 4200, 210, "07:30", "v-tr-indigo"),
    route("tr-oty-train", "ooty", "train", "Nilgiri Mountain Railway Toy Train · MTP → UAM", "Coimbatore", 650, 290, "07:10", "v-tr-irctc"),
]
V += [vendor("v-oty-cabs", "Nilgiri Mountain Cabs", "local", "ooty", "Tamil"),
      vendor("v-oty-guides", "Blue Mountain Trails", "activity", "ooty", "English"),
      vendor("v-oty-boats", "Ooty Lake Boating Guild", "activity", "ooty", "Tamil")]
COORD["ooty"] = "tm-fatima"

# ---------------------------------------------------------------- Shillong
D.append(dest("shillong", "Shillong", "Meghalaya", "Scotland of the East, living root bridges & roaring waterfalls",
              "The misty jewel of Meghalaya. Gaze down into roaring gorges at Elephant Falls, trek across centuries-old living root bridges in Cherrapunji, and soak up the lively indie rock café vibe in Police Bazar.",
              "mountain", "mint", 25.5788, 91.8933, ["Mountains", "Adventure", "Cool weather", "Slow travel"], ["adventure", "nature", "photo", "relax"],
              [9, 10, 11, 12, 1, 2, 3, 4, 5], [6, 7, 8], "4–5 days", "Guwahati Airport (GAU), 115 km", "Kolkata",
              (18, "cloudy", 30), ["Elephant Falls & Shillong Peak", "Cherrapunji living root bridge", "Dawki Umngot river boating", "Don Bosco Museum"],
              [cluster("town", "Police Bazar & Ward's Lake", "Café Shillong", 550, "The Wok", 750),
               cluster("cherrapunji", "Sohra (Cherrapunji) waterfalls", "Orange Roots", 400, "Polo Orchid Resort", 1200)],
              3200, 2600, ["Khasi", "English", "Hindi"]))
A += [
    act("shl-elephantfalls", "shillong", "town", "Elephant Falls & Shillong Peak",
        "Three-tier roaring waterfall in deep green ferns and peak view of Shillong city.",
        ["nature", "photo"], 150, 350, 2, True, "morning", "v-shl-guides", 25.5375, 91.8226, True, "medium", "mountain", "shl-rootbridge"),
    act("shl-rootbridge", "shillong", "cherrapunji", "Cherrapunji living root bridge trek",
        "Descend deep into rainforest valleys across centuries-old bioengineered tree bridges.",
        ["adventure", "nature"], 360, 1600, 5, True, "morning", "v-shl-guides", 25.2450, 91.6720, False, "high", "leaf"),
    act("shl-cafe", "shillong", "town", "Police Bazar indie rock café & Khasi delicacies",
        "Live acoustic music at Café Shillong and local pork momos and jadoh rice.",
        ["food", "social"], 120, 700, 1, False, "evening", "v-shl-guides", 25.5780, 91.8840, True, "low", "food"),
]
S += [
    stay("st-shl-hostel", "shillong", "Silver Brook Hostel", "hostel", 950, "Upper Shillong", ["Pine forest views", "Bonfire"], "lavender", 25.5420, 91.8350),
    stay("st-shl-budget", "shillong", "The Habitat Pine Borough", "budget", 2900, "Police Bazar", ["Central location", "Warm heating"], "mint", 25.5790, 91.8850),
    stay("st-shl-luxury", "shillong", "Polo Orchid Resort", "luxury", 16500, "Sohra Gorges", ["Infinity pool over valley", "Seven sisters falls view"], "pink", 25.2650, 91.7320),
]
T += [
    route("tr-shl-flight", "shillong", "flight", "IndiGo · CCU → GAU + hill cab", "Kolkata", 4800, 220, "07:45", "v-tr-indigo"),
    route("tr-shl-car", "shillong", "car", "Guwahati Airport to Shillong Private Hill SUV", "Guwahati", 2600, 180, "09:00", "v-shl-cabs"),
]
V += [vendor("v-shl-cabs", "Khasi Hills Taxi Union", "local", "shillong", "Khasi"),
      vendor("v-shl-guides", "Sohra & Living Root Trekkers", "activity", "shillong", "English")]
COORD["shillong"] = "tm-priya"


for s in S:
    V.append(vendor(s["vendorId"], s["name"], "stay", s["destinationId"], "English"))

data = json.load(open(PATH, encoding="utf-8"))
ids = {d["id"] for d in D}
data["destinations"] = [d for d in data["destinations"] if d["id"] not in ids] + D
for key, rows in (("activities", A), ("stays", S), ("transport", T), ("vendors", V)):
    new = {r["id"] for r in rows}
    data[key] = [r for r in data[key] if r["id"] not in new] + rows
data["coordinatorFor"].update(COORD)
for m in data["team"]:
    m["phone"] = ""
    m["rating"] = 0
    m["status"] = "available"

# Sanity checks: every reference resolves.
vendors = {v["id"] for v in data["vendors"]}
acts = {a["id"] for a in data["activities"]}
for a in data["activities"]:
    assert a["vendorId"] in vendors, a["id"]
    assert not a.get("backupId") or a["backupId"] in acts, a["id"]
    d = next(x for x in data["destinations"] if x["id"] == a["destinationId"])
    assert any(c["id"] == a["cluster"] for c in d["clusters"]), a["id"]
for x in data["stays"] + data["transport"]:
    assert x["vendorId"] in vendors, x["id"]
for d in data["destinations"]:
    assert any(v["kind"] == "local" and v["destinationId"] == d["id"] for v in data["vendors"]), d["id"]
    assert any(t["destinationId"] == d["id"] for t in data["transport"]), d["id"]
    assert any(s["destinationId"] == d["id"] for s in data["stays"]), d["id"]

json.dump(data, open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{len(data['destinations'])} destinations, {len(data['activities'])} experiences, {len(data['stays'])} stays, "
      f"{len(data['transport'])} routes, {len(data['vendors'])} partners")
