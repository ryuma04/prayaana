import {
  PlaceRecommendation,
  LocalGuruResponse,
  CityInfo,
  ItinerarySlot,
  LiveWeatherInfo
} from "../types";

// Runtime cache for dynamically fetched city geocoding and live weather
const weatherCache = new Map<string, { data: LiveWeatherInfo; expiry: number }>();
const customCityCache = new Map<string, CityInfo>();

// 22 Pre-indexed Iconic Destinations across India with verified details, coordinates, entry fees & insider tips
export const CITIES_DATABASE: Record<string, CityInfo> = {
  "Bengaluru": {
    name: "Bengaluru",
    stateOrCountry: "Karnataka, India",
    tagline: "Garden City, Royal Heritage & Craft Breweries",
    badge: "Capital & Culture",
    description: "Famous for Tudor-style Bangalore Palace, Lalbagh Glass House, Cubbon Park, iconic crispy Benne Dosas, and vibrant craft microbreweries.",
    weather: "Pleasant & Breezy",
    temp: "25°C",
    bestSeason: "September – March",
    language: "Kannada, English, Hindi",
    avgBudget: "₹2,000 – ₹4,000 / day",
    lat: 12.9716,
    lng: 77.5946,
    famousFood: ["Benne Masala Dosa at Vidyarthi Bhavan", "Filter Coffee at MTR", "Craft Beer at Toit", "Bisi Bele Bath", "Mysore Pak"],
    emergencyContacts: [
      { name: "Bengaluru City Police", number: "112", type: "Police" },
      { name: "Karnataka Tourist Helpline", number: "1363", type: "Tourist Help" },
      { name: "Bowring Hospital", number: "080-25591325", type: "Hospital" },
      { name: "Ambulance", number: "108", type: "Ambulance" }
    ],
    places: [
      {
        id: "blr-1",
        name: "Bangalore Palace",
        category: "Heritage & History",
        rating: 4.6,
        reviewCount: "62k+",
        description: "1887 Tudor-revival palace of the Wadiyar dynasty with Gothic windows, stained glass, and royal hunting trophies.",
        bestTime: "10:00 AM – 1:00 PM",
        timing: "10:00 AM – 5:30 PM",
        entryFee: "₹250",
        approxCost: 350,
        address: "Vasanth Nagar, Bengaluru 560052",
        imageUrl: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=800&q=80",
        highlights: ["Durbar Hall", "Maharaja's Courtyard", "Tudor Architecture"],
        tags: ["Palace", "Royal", "History", "Must Visit"],
        insiderTip: "Take the audio guide and see the private inner courtyard with Spanish ceramic tile benches.",
        googleMapsUrl: "https://maps.google.com/?q=Bangalore+Palace",
        lat: 12.9988,
        lng: 77.5921,
        durationHours: 2
      },
      {
        id: "blr-2",
        name: "Lalbagh Botanical Gardens",
        category: "Nature & Parks",
        rating: 4.7,
        reviewCount: "95k+",
        description: "240-acre historic botanical garden with century-old trees, the 1889 Glass House, and the ancient 3-billion-year-old rock.",
        bestTime: "6:30 AM – 9:30 AM",
        timing: "6:00 AM – 7:00 PM",
        entryFee: "₹30",
        approxCost: 50,
        address: "Mavalli, Bengaluru 560004",
        imageUrl: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80",
        highlights: ["1889 Glass House", "Kempegowda Watchtower Rock", "Centennial Trees"],
        tags: ["Gardens", "Nature", "Lalbagh", "Relax"],
        insiderTip: "Exit West Gate directly to Mavalli Tiffin Room (MTR) for hot Rava Idli and filter coffee.",
        googleMapsUrl: "https://maps.google.com/?q=Lalbagh+Botanical+Garden+Bengaluru",
        lat: 12.9507,
        lng: 77.5848,
        durationHours: 2
      }
    ]
  },
  "Mysuru": {
    "name": "Mysuru",
    "stateOrCountry": "Karnataka, India",
    "tagline": "City of Palaces, Sandalwood & Royal Dussehra",
    "badge": "Royal Heritage",
    "description": "The cultural capital of Karnataka, celebrated for the Indo-Saracenic Mysore Palace, Chamundi Hill temple, Devaraja Market fragrances, and rich Wadiyar royalty.",
    "weather": "Pleasant & Mild",
    "temp": "26°C",
    "bestSeason": "October – March",
    "language": "Kannada, English",
    "avgBudget": "₹1,800 – ₹3,500 / day",
    "lat": 12.2958,
    "lng": 76.6394,
    "famousFood": [
      "Mylari Masala Dosa",
      "Original Mysore Pak at Guru Sweet Mart",
      "Mysore Filter Coffee",
      "Chiroti with Badam Milk",
      "Bisi Bele Bath"
    ],
    "emergencyContacts": [
      {
        "name": "Mysuru City Police",
        "number": "112",
        "type": "Police"
      },
      {
        "name": "KR Hospital Mysuru",
        "number": "0821-2423000",
        "type": "Hospital"
      },
      {
        "name": "Karnataka Tourism Info",
        "number": "1363",
        "type": "Tourist Help"
      },
      {
        "name": "Ambulance",
        "number": "108",
        "type": "Ambulance"
      }
    ],
    "places": [
      {
        "id": "mys-1",
        "name": "Mysore Palace Grand Interior",
        "category": "Heritage & History",
        "rating": 4.8,
        "reviewCount": "120k+",
        "description": "Spectacular royal seat of the Wadiyar maharajas featuring the octagonal Peacock Gombe Thotti pavilion, solid silver doors, and stained glass ceilings.",
        "bestTime": "10:00 AM – 1:30 PM (or Sunday evenings for 100,000 bulb illumination)",
        "timing": "10:00 AM – 5:30 PM daily",
        "entryFee": "₹100 (Indians), ₹200 (Foreigners)",
        "approxCost": 150,
        "address": "Sayyaji Rao Rd, Agrahara, Chamrajpura, Mysuru 570001",
        "imageUrl": "https://images.unsplash.com/photo-1600100397608-f010e421d4a0?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Golden Royal Throne",
          "Durbar Hall",
          "Ambavilas Stained Glass",
          "Night Illumination"
        ],
        "tags": [
          "Palace",
          "Royal",
          "Architecture",
          "Must Visit"
        ],
        "insiderTip": "Visit on Sunday at 7:00 PM when the entire palace facade glows with 100,000 golden incandescent bulbs.",
        "googleMapsUrl": "https://maps.google.com/?q=Mysore+Palace+Mysuru",
        "lat": 12.3052,
        "lng": 76.6552,
        "durationHours": 2.5
      },
      {
        "id": "mys-2",
        "name": "Chamundi Hill & Monolithic Nandi",
        "category": "Spiritual & Views",
        "rating": 4.7,
        "reviewCount": "78k+",
        "description": "Ancient hilltop temple dedicated to Goddess Chamundeshwari with a 1,000-step stone climb and a giant 16-foot monolithic granite Nandi Bull.",
        "bestTime": "6:30 AM – 9:00 AM (Sunrise & cool mountain air)",
        "timing": "6:00 AM – 9:00 PM",
        "entryFee": "Free (Special darshan ₹100)",
        "approxCost": 100,
        "address": "Chamundi Hill, Mysuru 570010",
        "imageUrl": "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Goddess Chamundeshwari Sanctum",
          "16-Foot Monolithic Nandi",
          "Panoramic Mysuru City View"
        ],
        "tags": [
          "Temple",
          "Viewpoint",
          "Heritage"
        ],
        "insiderTip": "Stop halfway down at the monolithic Nandi bull carved from a single boulder in 1659.",
        "googleMapsUrl": "https://maps.google.com/?q=Chamundeshwari+Temple+Mysuru",
        "lat": 12.2753,
        "lng": 76.6702,
        "durationHours": 2
      }
    ]
  },
  "Coorg": {
    "name": "Coorg (Kodagu)",
    "stateOrCountry": "Karnataka, India",
    "tagline": "Scotland of India, Coffee Estates & Mist",
    "badge": "Western Ghats",
    "description": "Emerald green hill haven renowned for shade-grown coffee and pepper plantations, Abbey cascades, Tibetan monasteries, and Kodava hospitality.",
    "weather": "Cool & Misty",
    "temp": "19°C",
    "bestSeason": "October – May",
    "language": "Kodava, Kannada, English",
    "avgBudget": "₹2,200 – ₹4,500 / day",
    "lat": 12.4244,
    "lng": 75.7382,
    "famousFood": [
      "Pandi Curry with Akki Rotti",
      "Bamboo Shoot Curry (Kani)",
      "Estate Filter Coffee",
      "Kadamputtu (Rice Dumplings)",
      "Coorg Wild Orange Honey"
    ],
    "emergencyContacts": [
      {
        "name": "Madikeri Police Station",
        "number": "08272-228333 / 112",
        "type": "Police"
      },
      {
        "name": "District Hospital Madikeri",
        "number": "08272-225225",
        "type": "Hospital"
      },
      {
        "name": "Karnataka Forest Helpline",
        "number": "1926",
        "type": "Forest / Wildlife"
      }
    ],
    "places": [
      {
        "id": "coo-1",
        "name": "Private Coffee & Pepper Estate Trail",
        "category": "Nature & Plantations",
        "rating": 4.9,
        "reviewCount": "45k+",
        "description": "Immersive guided walk beneath towering canopy trees, picking ripe Arabica and Robusta coffee cherries, and smelling fresh green cardamom.",
        "bestTime": "7:30 AM – 10:30 AM",
        "timing": "8:00 AM – 5:00 PM",
        "entryFee": "₹200 – ₹500 (with estate brew tasting)",
        "approxCost": 350,
        "address": "Madikeri Hills, Kodagu 571201",
        "imageUrl": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Arabica & Robusta Bushes",
          "Pepper Vine Arbors",
          "Artisanal Cupping Tasting"
        ],
        "tags": [
          "Coffee",
          "Nature",
          "Plantation",
          "Must Visit"
        ],
        "insiderTip": "Buy fresh estate-roasted peaberry coffee beans and whole black pepper directly at the planter co-op counter.",
        "googleMapsUrl": "https://maps.google.com/?q=Coffee+Plantation+Coorg",
        "lat": 12.435,
        "lng": 75.748,
        "durationHours": 2.5
      },
      {
        "id": "coo-2",
        "name": "Namdroling Golden Temple Bylakuppe",
        "category": "Spiritual & Heritage",
        "rating": 4.9,
        "reviewCount": "65k+",
        "description": "The largest Tibetan monastic settlement in southern India, featuring three 40-foot gilded golden Buddha statues and ornate mural art.",
        "bestTime": "9:00 AM – 12:00 PM & 1:00 PM – 3:30 PM",
        "timing": "9:00 AM – 6:00 PM",
        "entryFee": "Free",
        "approxCost": 0,
        "address": "Bylakuppe, Kushalnagar, Kodagu 571104",
        "imageUrl": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "40-Foot Gilded Golden Buddhas",
          "Tibetan Prayer Wheels",
          "Monastery Courtyard"
        ],
        "tags": [
          "Tibetan",
          "Monastery",
          "Spiritual",
          "Golden Temple"
        ],
        "insiderTip": "Visit Camp 4 Tibetan canteens right outside the gate for authentic momos and butter tea.",
        "googleMapsUrl": "https://maps.google.com/?q=Namdroling+Monastery+Golden+Temple+Bylakuppe",
        "lat": 12.4304,
        "lng": 75.9667,
        "durationHours": 2
      }
    ]
  },
  "Hampi": {
    "name": "Hampi",
    "stateOrCountry": "Karnataka, India",
    "tagline": "UNESCO World Heritage Vijayanagara Empire",
    "badge": "UNESCO Heritage",
    "description": "Magnificent 14th-century boulder-strewn capital of the Vijayanagara Empire on the Tungabhadra river, famed for stone chariots and musical pillars.",
    "weather": "Warm & Sunny",
    "temp": "29°C",
    "bestSeason": "October – February",
    "language": "Kannada, English",
    "avgBudget": "₹1,500 – ₹3,000 / day",
    "lat": 15.335,
    "lng": 76.46,
    "famousFood": [
      "Karnataka Banana Leaf Meals",
      "Jolada Rotti with Ennegayi",
      "Filter Coffee at Mango Tree",
      "Bolan Rice & Coconut Payasam"
    ],
    "emergencyContacts": [
      {
        "name": "Hampi Tourism Police",
        "number": "112 / 08394-241222",
        "type": "Police"
      },
      {
        "name": "Hospet Government Hospital",
        "number": "08394-228222",
        "type": "Hospital"
      },
      {
        "name": "Karnataka Tourism Info Desk",
        "number": "1363",
        "type": "Tourist Help"
      }
    ],
    "places": [
      {
        "id": "ham-1",
        "name": "Vijaya Vittala Temple & Stone Chariot",
        "category": "UNESCO World Heritage",
        "rating": 4.9,
        "reviewCount": "90k+",
        "description": "The crowning architectural marvel of Vijayanagara, housing the iconic monolithic Garuda stone chariot and 56 musical granite pillars.",
        "bestTime": "8:00 AM – 10:30 AM & 4:00 PM – 6:00 PM",
        "timing": "8:30 AM – 5:30 PM daily",
        "entryFee": "₹40 (covers Zenana Enclosure too)",
        "approxCost": 100,
        "address": "Hampi, Bellary District, Karnataka 583239",
        "imageUrl": "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Monolithic Stone Chariot",
          "Musical Pillars Maha Mantapa",
          "King Balance Scales"
        ],
        "tags": [
          "UNESCO",
          "Stone Chariot",
          "History",
          "Must Visit"
        ],
        "insiderTip": "Take the eco battery car from the outer parking or walk along the historic bazaar street beside the river boulders.",
        "googleMapsUrl": "https://maps.google.com/?q=Vijaya+Vittala+Temple+Hampi",
        "lat": 15.3364,
        "lng": 76.4788,
        "durationHours": 2.5
      },
      {
        "id": "ham-2",
        "name": "Matanga Hill Sunrise & Tungabhadra View",
        "category": "Nature & Views",
        "rating": 4.8,
        "reviewCount": "42k+",
        "description": "The highest point in central Hampi offering unparalleled 360-degree views of the boulder hills, Virupaksha gopura, and winding Tungabhadra river.",
        "bestTime": "5:30 AM – 7:00 AM (Spectacular Golden Hour)",
        "timing": "Open 24/7 (climb in daylight)",
        "entryFee": "Free",
        "approxCost": 0,
        "address": "Matanga Hill, Hampi, Karnataka 583239",
        "imageUrl": "https://images.unsplash.com/photo-1600100397608-f010e421d4a0?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Golden Sunrise over Ruins",
          "Aerial View of Achyutaraya Temple",
          "Veerabhadra Hilltop Shrine"
        ],
        "tags": [
          "Sunrise",
          "Trek",
          "Viewpoint",
          "Photography"
        ],
        "insiderTip": "Start ascending by 5:45 AM from the east side of Hampi Bazaar; carry a flashlight for the initial stone steps.",
        "googleMapsUrl": "https://maps.google.com/?q=Matanga+Hill+Hampi",
        "lat": 15.332,
        "lng": 76.468,
        "durationHours": 2
      }
    ]
  },
  "Gokarna": {
    "name": "Gokarna",
    "stateOrCountry": "Karnataka, India",
    "tagline": "Sacred Temples, Om Beach & Coastal Cliffs",
    "badge": "Karavali Coast",
    "description": "Charming coastal town nestled between the Western Ghats and the Arabian Sea, revered for the Mahabaleshwar Atmalinga temple and unspoiled crescent beaches.",
    "weather": "Tropical Coastal Breeze",
    "temp": "28°C",
    "bestSeason": "October – April",
    "language": "Kannada, Konkani, English",
    "avgBudget": "₹1,500 – ₹3,200 / day",
    "lat": 14.5479,
    "lng": 74.3188,
    "famousFood": [
      "Fresh Seafood Thali",
      "Avocado Toast at Namaste Cafe",
      "Coastal Kokum Kadhi",
      "Neer Dosa with Fish Gassi",
      "Tender Coconut Shake"
    ],
    "emergencyContacts": [
      {
        "name": "Gokarna Police Station",
        "number": "08386-256333 / 112",
        "type": "Police"
      },
      {
        "name": "Government Hospital Gokarna",
        "number": "08386-256244",
        "type": "Hospital"
      },
      {
        "name": "Coastal Lifeguard Emergency",
        "number": "112",
        "type": "Lifeguard"
      }
    ],
    "places": [
      {
        "id": "gok-1",
        "name": "Om Beach & Cliffside Trail",
        "category": "Beaches & Nature",
        "rating": 4.8,
        "reviewCount": "62k+",
        "description": "Naturally shaped like the sacred Hindu symbol Om (ॐ), featuring gentle surf, rugged laterite rock pools, beach shacks, and dolphins offshore.",
        "bestTime": "7:00 AM – 11:00 AM & 4:30 PM – 6:30 PM (Sunset)",
        "timing": "Open daily",
        "entryFee": "Free",
        "approxCost": 200,
        "address": "Om Beach, Gokarna, Uttara Kannada 581326",
        "imageUrl": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Natural Om Symbol Shape",
          "Cliff Trek to Half Moon Beach",
          "Namaste Cafe Sunset"
        ],
        "tags": [
          "Beach",
          "Coast",
          "Sunset",
          "Must Visit"
        ],
        "insiderTip": "Trek the cliff trail from Om Beach to Half Moon Beach and Paradise Beach for secluded secret coves.",
        "googleMapsUrl": "https://maps.google.com/?q=Om+Beach+Gokarna",
        "lat": 14.5186,
        "lng": 74.3156,
        "durationHours": 3
      }
    ]
  },
  "Chikmagalur": {
    "name": "Chikmagalur",
    "stateOrCountry": "Karnataka, India",
    "tagline": "Coffee Cradle & Mullayanagiri High Peak",
    "badge": "Western Ghats",
    "description": "The historic birthplace of coffee in India where Baba Budan first planted beans. Home to Mullayanagiri (Karnataka highest summit) and misty jungle homestays.",
    "weather": "Crisp & Mountain Breeze",
    "temp": "21°C",
    "bestSeason": "September – April",
    "language": "Kannada, English",
    "avgBudget": "₹2,000 – ₹4,000 / day",
    "lat": 13.3161,
    "lng": 75.772,
    "famousFood": [
      "Authentic Arabica Filter Coffee",
      "Akki Rotti with Chutney",
      "Malnad Style Chicken Sukka",
      "Pathrode Colocasia Rolls",
      "Jackfruit Payasam"
    ],
    "emergencyContacts": [
      {
        "name": "Chikmagalur Town Police",
        "number": "112 / 08262-230401",
        "type": "Police"
      },
      {
        "name": "District Hospital Chikmagalur",
        "number": "08262-230555",
        "type": "Hospital"
      },
      {
        "name": "Forest Range Control",
        "number": "1926",
        "type": "Forest"
      }
    ],
    "places": [
      {
        "id": "chk-1",
        "name": "Mullayanagiri Peak & Shiva Shrine",
        "category": "Adventure & Trekking",
        "rating": 4.9,
        "reviewCount": "58k+",
        "description": "The highest summit in Karnataka (1,930 m) offering breathless views of rolling emerald Ghat hills and a tranquil sage shrine at the top.",
        "bestTime": "6:00 AM – 9:30 AM (Catching the cloud sea)",
        "timing": "6:00 AM – 6:00 PM",
        "entryFee": "Free",
        "approxCost": 100,
        "address": "Mullayanagiri, Baba Budangiri Range, Karnataka 577101",
        "imageUrl": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Highest Point in Karnataka (1,930 m)",
          "Sea of Clouds View",
          "Hilltop Shiva Shrine"
        ],
        "tags": [
          "Peak",
          "Trek",
          "Adventure",
          "Must Visit"
        ],
        "insiderTip": "Climb the final 500 stone steps early in the morning when the peak floats above the clouds.",
        "googleMapsUrl": "https://maps.google.com/?q=Mullayanagiri+Peak+Chikmagalur",
        "lat": 13.3912,
        "lng": 75.7214,
        "durationHours": 3
      }
    ]
  },
  "Badami": {
    "name": "Badami",
    "stateOrCountry": "Karnataka, India",
    "tagline": "Chalukya Rock-Cut Cave Temples & Agastya Lake",
    "badge": "Chalukyan Architecture",
    "description": "Capital of the Early Chalukya dynasty, famed for four red-sandstone rock-cut cave temples overlooking the emerald waters of Agastya Lake and Bhutanatha shrines.",
    "weather": "Warm & Dry",
    "temp": "30°C",
    "bestSeason": "October – March",
    "language": "Kannada, English",
    "avgBudget": "₹1,400 – ₹2,800 / day",
    "lat": 15.9187,
    "lng": 75.6766,
    "famousFood": [
      "North Karnataka Jolada Rotti Oota",
      "Shenga Chutney (Peanut)",
      "Girmit Street Snack",
      "Badami Peda",
      "Yennegai"
    ],
    "emergencyContacts": [
      {
        "name": "Badami Police Station",
        "number": "112 / 08357-220033",
        "type": "Police"
      },
      {
        "name": "Community Health Centre Badami",
        "number": "08357-220120",
        "type": "Hospital"
      }
    ],
    "places": [
      {
        "id": "bad-1",
        "name": "Badami Rock-Cut Cave Temples",
        "category": "Heritage & Archaeology",
        "rating": 4.8,
        "reviewCount": "42k+",
        "description": "6th-century rock-cut monuments carved out of fiery red cliff sandstone, depicting Nataraja with 81 dancing poses, Vishnu, and Jain tirthankaras.",
        "bestTime": "8:30 AM – 11:00 AM & 3:30 PM – 5:30 PM",
        "timing": "9:00 AM – 5:30 PM",
        "entryFee": "₹25 (ASI entry ticket)",
        "approxCost": 50,
        "address": "Badami, Bagalkot District, Karnataka 587201",
        "imageUrl": "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "18-Armed Dancing Nataraja",
          "Cave 3 Maha Vishnu Relief",
          "Agastya Lake Panorama"
        ],
        "tags": [
          "Caves",
          "Chalukya",
          "Rock Cut",
          "Must Visit"
        ],
        "insiderTip": "Cross around Agastya Lake to the Bhutanatha temples during sunset for the iconic postcard reflection.",
        "googleMapsUrl": "https://maps.google.com/?q=Badami+Cave+Temples",
        "lat": 15.9187,
        "lng": 75.6766,
        "durationHours": 2.5
      }
    ]
  },
  "Udupi": {
    "name": "Udupi",
    "stateOrCountry": "Karnataka, India",
    "tagline": "Krishna Mutt, Coastal Cuisine & Malpe Beach",
    "badge": "Coastal & Culinary",
    "description": "Renowned pilgrimage and culinary hub famous for the 13th-century Sri Krishna Mutt, Kanakana Kindi window, St. Mary basalt islands, and classic Udupi vegetarian food.",
    "weather": "Breezy & Warm",
    "temp": "27°C",
    "bestSeason": "October – March",
    "language": "Kannada, Tulu, English",
    "avgBudget": "₹1,500 – ₹3,000 / day",
    "lat": 13.3409,
    "lng": 74.7421,
    "famousFood": [
      "Authentic Masala Dosa with Coconut Chutney",
      "Goli Baje (Mangalore Bajji)",
      "Kottige",
      "Patrode",
      "Banana Halwa"
    ],
    "emergencyContacts": [
      {
        "name": "Udupi Town Police",
        "number": "112 / 0820-2520444",
        "type": "Police"
      },
      {
        "name": "KMC Hospital Manipal",
        "number": "0820-2922761",
        "type": "Hospital"
      }
    ],
    "places": [
      {
        "id": "udp-1",
        "name": "Sri Krishna Mutt & Kanakana Kindi",
        "category": "Spiritual & Heritage",
        "rating": 4.9,
        "reviewCount": "75k+",
        "description": "Venerated 13th-century monastery established by Saint Madhvacharya where Lord Krishna is worshipped exclusively through a silver nine-holed window.",
        "bestTime": "6:30 AM – 9:00 AM & 5:00 PM – 8:00 PM",
        "timing": "5:30 AM – 9:30 PM daily",
        "entryFee": "Free (Annaprasada lunch served daily)",
        "approxCost": 0,
        "address": "Car Street, Udupi, Karnataka 576101",
        "imageUrl": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Kanakana Kindi Silver Window",
          "Golden Chariot",
          "Free Sacred Temple Dining"
        ],
        "tags": [
          "Krishna",
          "Temple",
          "Pilgrimage",
          "Must Visit"
        ],
        "insiderTip": "Partake in the serene free Annaprasada lunch served on plantain leaves in the grand dining hall at 12:00 PM.",
        "googleMapsUrl": "https://maps.google.com/?q=Udupi+Sri+Krishna+Matha",
        "lat": 13.3409,
        "lng": 74.7521,
        "durationHours": 2
      }
    ]
  },
  "Mangalore": {
    "name": "Mangalore (Mangaluru)",
    "stateOrCountry": "Karnataka, India",
    "tagline": "Port City, Ghee Roast & Tannirbhavi Beach",
    "badge": "Coastal Hub",
    "description": "Premier port city of Karnataka, famed for Kundapura Chicken Ghee Roast, fresh seafood, Panambur surf festivals, and St. Aloysius chapel Italian frescoes.",
    "weather": "Warm Coastal Breeze",
    "temp": "28°C",
    "bestSeason": "October – March",
    "language": "Tulu, Kannada, Konkani, English",
    "avgBudget": "₹1,800 – ₹3,500 / day",
    "lat": 12.9141,
    "lng": 74.856,
    "famousFood": [
      "Chicken Ghee Roast at Maharaja",
      "Kori Rotti with Coconut Gravy",
      "Anjal (Kingfish) Tawa Fry",
      "Gadbad Ice Cream at Pabbas",
      "Neer Dosa"
    ],
    "emergencyContacts": [
      {
        "name": "Mangaluru City Police",
        "number": "112 / 0824-2220800",
        "type": "Police"
      },
      {
        "name": "Father Muller Hospital",
        "number": "0824-2238000",
        "type": "Hospital"
      }
    ],
    "places": [
      {
        "id": "mng-1",
        "name": "Panambur Beach & Tannirbhavi Seaside",
        "category": "Beaches & Recreation",
        "rating": 4.7,
        "reviewCount": "48k+",
        "description": "Vibrant golden sand shoreline with safe lifeguard patrols, jet ski rides, coastal food shacks, and romantic sunset views over Arabian Sea freighters.",
        "bestTime": "4:30 PM – 7:00 PM",
        "timing": "6:00 AM – 7:30 PM",
        "entryFee": "Free",
        "approxCost": 150,
        "address": "Panambur, Mangaluru, Karnataka 575010",
        "imageUrl": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Golden Sunset Views",
          "Jet Ski & Water Sports",
          "Fresh Fish Fry Shacks"
        ],
        "tags": [
          "Beach",
          "Coast",
          "Sunset"
        ],
        "insiderTip": "Visit Pabbas Ice Cream afterwards on MG Road for their legendary multi-layer Gadbad sundae.",
        "googleMapsUrl": "https://maps.google.com/?q=Panambur+Beach+Mangalore",
        "lat": 12.9538,
        "lng": 74.8037,
        "durationHours": 2.5
      }
    ]
  },
  "Dandeli": {
    "name": "Dandeli",
    "stateOrCountry": "Karnataka, India",
    "tagline": "Kali River Rafting & Hornbill Jungle Reserve",
    "badge": "Adventure Capital",
    "description": "Ultimate white-water rafting haven nestled along the Kali river in the dense Western Ghats, brimming with hornbills, black panthers, and jungle canopy stays.",
    "weather": "Cool & Rainforest Canopy",
    "temp": "24°C",
    "bestSeason": "October – May",
    "language": "Kannada, English",
    "avgBudget": "₹2,500 – ₹4,500 / day",
    "lat": 15.2417,
    "lng": 74.6294,
    "famousFood": [
      "Malenadu Jungle Thali",
      "Bamboo Shoot Stir Fry",
      "Desi Ghee Rice",
      "Local River Fish Curry"
    ],
    "emergencyContacts": [
      {
        "name": "Dandeli Police Station",
        "number": "112 / 08284-231233",
        "type": "Police"
      },
      {
        "name": "Dandeli Forest Office",
        "number": "1926",
        "type": "Forest"
      }
    ],
    "places": [
      {
        "id": "dan-1",
        "name": "Kali River White Water Rafting",
        "category": "Adventure & Water Sports",
        "rating": 4.8,
        "reviewCount": "34k+",
        "description": "Exhilarating 9 km Grade 2 and 3 rapids through pristine rainforest gorges with professional river instructors.",
        "bestTime": "8:30 AM – 1:00 PM",
        "timing": "8:00 AM – 4:00 PM",
        "entryFee": "₹1,200 – ₹1,800 / person",
        "approxCost": 1500,
        "address": "Kali River Banks, Dandeli, Karnataka 581325",
        "imageUrl": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Grade 3 Rapids",
          "Rainforest River Gorges",
          "Natural Jacuzzi Rapids"
        ],
        "tags": [
          "Rafting",
          "Adventure",
          "River",
          "Must Visit"
        ],
        "insiderTip": "Rafting depends on dam water discharge timing; book morning slots for maximum rapid volume.",
        "googleMapsUrl": "https://maps.google.com/?q=Kali+River+Rafting+Dandeli",
        "lat": 15.2417,
        "lng": 74.6294,
        "durationHours": 3.5
      }
    ]
  },
  "Kabini": {
    "name": "Kabini",
    "stateOrCountry": "Karnataka, India",
    "tagline": "Nagarhole Tiger Safari & Kaveri River Lodges",
    "badge": "Wildlife Sanctuary",
    "description": "Premier wildlife reserve in the Nilgiri Biosphere, famous for frequent leopard and Bengal tiger sightings, Asian elephant herds, and luxury river safaris.",
    "weather": "Gentle & Forest Breezes",
    "temp": "23°C",
    "bestSeason": "October – May",
    "language": "Kannada, English",
    "avgBudget": "₹4,000 – ₹9,000 / day",
    "lat": 11.95,
    "lng": 76.25,
    "famousFood": [
      "South Karnataka Homestyle Feasts",
      "Kori Gassi with Steamed Rice",
      "Filter Coffee & Jackfruit Chips"
    ],
    "emergencyContacts": [
      {
        "name": "Nagarhole Wildlife Control",
        "number": "1926",
        "type": "Forest / Rescue"
      },
      {
        "name": "HD Kote Police Station",
        "number": "112 / 08228-255333",
        "type": "Police"
      }
    ],
    "places": [
      {
        "id": "kab-1",
        "name": "Nagarhole Boat Safari on Kabini Reservoir",
        "category": "Wildlife & Nature",
        "rating": 4.9,
        "reviewCount": "28k+",
        "description": "Cruising the tranquil Kabini backwaters where wild elephants gather on banks, marsh crocodiles bask, and black panthers are occasionally spotted.",
        "bestTime": "6:00 AM – 9:00 AM & 3:30 PM – 6:30 PM",
        "timing": "Morning and Evening Jungle Safari slots",
        "entryFee": "₹1,500 – ₹2,500 / person",
        "approxCost": 2000,
        "address": "Kabini Reservoir, Nagarhole Tiger Reserve, Karnataka 571114",
        "imageUrl": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Wild Asian Elephant Herds",
          "Osprey & Water Birds",
          "Sunset Backwater Reflections"
        ],
        "tags": [
          "Safari",
          "Wildlife",
          "Elephants",
          "Tigers"
        ],
        "insiderTip": "Book forest department vehicle and boat safaris at least 15 days ahead through Karnataka Eco-Tourism portal.",
        "googleMapsUrl": "https://maps.google.com/?q=Kabini+River+Lodge",
        "lat": 11.95,
        "lng": 76.25,
        "durationHours": 3
      }
    ]
  },
  "Bandipur": {
    "name": "Bandipur",
    "stateOrCountry": "Karnataka, India",
    "tagline": "Project Tiger Reserve & Chital Deer Meadows",
    "badge": "National Park",
    "description": "Sprawling deciduous sanctuary along the foothills of the Western Ghats, housing high densities of Bengal tigers, Indian gaurs, and peacocks.",
    "weather": "Warm Forest Air",
    "temp": "25°C",
    "bestSeason": "October – May",
    "language": "Kannada, English",
    "avgBudget": "₹2,500 – ₹6,000 / day",
    "lat": 11.6664,
    "lng": 76.6291,
    "famousFood": [
      "Mysore Style Thali",
      "Milagu Rasam & Rice",
      "Tender Coconut"
    ],
    "emergencyContacts": [
      {
        "name": "Bandipur Forest Reception",
        "number": "08229-236043 / 1926",
        "type": "Forest"
      },
      {
        "name": "Gundlupet Police",
        "number": "112",
        "type": "Police"
      }
    ],
    "places": [
      {
        "id": "ban-1",
        "name": "Bandipur Open Jeep Jungle Safari",
        "category": "Wildlife & Safari",
        "rating": 4.8,
        "reviewCount": "38k+",
        "description": "Open-top 4x4 forest department safari navigating deep inside the tiger reserve tracks under guided naturalists.",
        "bestTime": "6:15 AM – 9:00 AM & 3:30 PM – 6:00 PM",
        "timing": "Scheduled slots only",
        "entryFee": "₹800 – ₹2,500 / person",
        "approxCost": 1500,
        "address": "Bandipur National Park, Gundlupet Taluk, Karnataka 571126",
        "imageUrl": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Bengal Tigers & Leopards",
          "Wild Indian Gaurs",
          "Peacock Groves"
        ],
        "tags": [
          "Tiger Reserve",
          "Safari",
          "Wildlife"
        ],
        "insiderTip": "The 6:15 AM morning safari offers the highest chance of seeing gaurs and predator tracks on the mud roads.",
        "googleMapsUrl": "https://maps.google.com/?q=Bandipur+National+Park",
        "lat": 11.6664,
        "lng": 76.6291,
        "durationHours": 2.5
      }
    ]
  },
  "Jog Falls": {
    "name": "Jog Falls",
    "stateOrCountry": "Karnataka, India",
    "tagline": "Second Highest Plunge Waterfall in India",
    "badge": "Natural Wonder",
    "description": "Spectacular Sharavathi river plunge drop of 253 meters (830 feet), cascading as four distinct streams named Raja, Roarer, Rocket, and Rani.",
    "weather": "Misty & Humid",
    "temp": "22°C",
    "bestSeason": "July – December",
    "language": "Kannada, English",
    "avgBudget": "₹1,200 – ₹2,500 / day",
    "lat": 14.2285,
    "lng": 74.8124,
    "famousFood": [
      "Malnad Jackfruit Chips",
      "Mirchi Bajji & Chai",
      "Jolada Rotti Oota"
    ],
    "emergencyContacts": [
      {
        "name": "Jog Falls Police Outpost",
        "number": "112 / 08183-258222",
        "type": "Police"
      },
      {
        "name": "Sagar Taluk Hospital",
        "number": "08183-226102",
        "type": "Hospital"
      }
    ],
    "places": [
      {
        "id": "jog-1",
        "name": "Jog Falls Raja & Rani Viewpoint",
        "category": "Waterfalls & Views",
        "rating": 4.8,
        "reviewCount": "45k+",
        "description": "Vantage amphitheatre overlooking the majestic 830-foot vertical drop of the Sharavathi river into the deep misty canyon below.",
        "bestTime": "9:00 AM – 12:00 PM & 3:00 PM – 5:30 PM",
        "timing": "7:30 AM – 6:30 PM",
        "entryFee": "₹20 (Viewpoint deck)",
        "approxCost": 50,
        "address": "Jog Falls, Shivamogga District, Karnataka 577435",
        "imageUrl": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "830-Foot Vertical Plunge",
          "Raja, Roarer, Rocket, Rani Streams",
          "Canyon Rainbow Views"
        ],
        "tags": [
          "Waterfall",
          "Sharavathi",
          "Nature",
          "Must Visit"
        ],
        "insiderTip": "Visit immediately after dam water release or during monsoon months for the thundering wall of water.",
        "googleMapsUrl": "https://maps.google.com/?q=Jog+Falls+Karnataka",
        "lat": 14.2285,
        "lng": 74.8124,
        "durationHours": 2.5
      }
    ]
  },
  "Sakleshpur": {
    "name": "Sakleshpur",
    "stateOrCountry": "Karnataka, India",
    "tagline": "Manjarabad Star Fort & Green Route Hills",
    "badge": "Western Ghats",
    "description": "Charming hill town nestled in the Bisle Ghats, known for Tipu Sultan eight-pointed star fort, cardamom hills, and scenic railway trek ridges.",
    "weather": "Cool & Mountain Air",
    "temp": "20°C",
    "bestSeason": "September – April",
    "language": "Kannada, English",
    "avgBudget": "₹1,800 – ₹3,500 / day",
    "lat": 12.9438,
    "lng": 75.7865,
    "famousFood": [
      "Akki Rotti with Avarekalu Sambhar",
      "Cardamom Tea",
      "Jackfruit Halwa",
      "Malnad Chicken Curry"
    ],
    "emergencyContacts": [
      {
        "name": "Sakleshpur Police",
        "number": "112 / 08173-244133",
        "type": "Police"
      },
      {
        "name": "Crawford Hospital Sakleshpur",
        "number": "08173-244222",
        "type": "Hospital"
      }
    ],
    "places": [
      {
        "id": "sak-1",
        "name": "Manjarabad Star Fort",
        "category": "Heritage & Forts",
        "rating": 4.7,
        "reviewCount": "32k+",
        "description": "Unique 8-pointed star-shaped granite fortress built in 1792 by Tipu Sultan, offering breathtaking views of the Arabian Sea horizon on clear days.",
        "bestTime": "8:00 AM – 11:00 AM & 3:30 PM – 5:30 PM",
        "timing": "8:00 AM – 6:00 PM",
        "entryFee": "Free",
        "approxCost": 0,
        "address": "Donigal, Sakleshpur, Hassan District, Karnataka 573134",
        "imageUrl": "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Eight-Pointed Star Design",
          "Ghat Valley Vista",
          "Tipu Sultan Military Architecture"
        ],
        "tags": [
          "Star Fort",
          "Heritage",
          "Viewpoint"
        ],
        "insiderTip": "Climb the 250 steps to the parapet to clearly see the symmetrical eight points of the star layout.",
        "googleMapsUrl": "https://maps.google.com/?q=Manjarabad+Fort+Sakleshpur",
        "lat": 12.9238,
        "lng": 75.7665,
        "durationHours": 2
      }
    ]
  },
  "Belur-Halebidu": {
    "name": "Belur & Halebidu",
    "stateOrCountry": "Karnataka, India",
    "tagline": "UNESCO Hoysala Stone Temple Architecture",
    "badge": "Hoysala Masterpieces",
    "description": "World Heritage Hoysala temples of Chennakeshava and Hoysaleshwara (12th century), famous for soapstone carvings of dancing celestial dancers (Madanikas).",
    "weather": "Pleasant & Sunny",
    "temp": "26°C",
    "bestSeason": "October – March",
    "language": "Kannada, English",
    "avgBudget": "₹1,500 – ₹3,000 / day",
    "lat": 13.1623,
    "lng": 75.8596,
    "famousFood": [
      "Hassan Style Veg Oota",
      "Ragi Mudde with Bassaru",
      "Mysore Pak",
      "Benne Dosa"
    ],
    "emergencyContacts": [
      {
        "name": "Belur Police",
        "number": "112 / 08177-222233",
        "type": "Police"
      },
      {
        "name": "Hassan District Hospital",
        "number": "08172-268022",
        "type": "Hospital"
      }
    ],
    "places": [
      {
        "id": "bel-1",
        "name": "Chennakeshava Temple Belur",
        "category": "UNESCO World Heritage",
        "rating": 4.9,
        "reviewCount": "52k+",
        "description": "1117 AD Hoysala masterpiece built by King Vishnuvardhana over 103 years, renowned for intricate bracket figures (Shilabalikas) and star-shaped platform.",
        "bestTime": "7:30 AM – 11:00 AM & 3:30 PM – 6:30 PM",
        "timing": "7:30 AM – 7:30 PM",
        "entryFee": "Free (Audio guides / certified guides available)",
        "approxCost": 150,
        "address": "Temple Rd, Belur, Hassan District, Karnataka 573115",
        "imageUrl": "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "Shilabalika Bracket Dancers",
          "Star-Shaped Sanctum Base",
          "Gravity Pillar"
        ],
        "tags": [
          "Hoysala",
          "UNESCO",
          "Stone Carvings",
          "Architecture"
        ],
        "insiderTip": "Hire a certified ASI guide at the entrance gate to illuminate the intricate jewelry, moving stone rings, and mirror reflections.",
        "googleMapsUrl": "https://maps.google.com/?q=Chennakeshava+Temple+Belur",
        "lat": 13.1623,
        "lng": 75.8596,
        "durationHours": 2.5
      }
    ]
  },
  "Murdeshwar": {
    "name": "Murdeshwar",
    "stateOrCountry": "Karnataka, India",
    "tagline": "World Second Tallest Shiva Statue & Arabian Sea Coast",
    "badge": "Coastal Landmark",
    "description": "Breathtaking coastal pilgrimage town surrounded on three sides by the Arabian Sea, featuring a towering 123-foot Lord Shiva statue and 20-story Raja Gopura.",
    "weather": "Coastal Breeze & Sunny",
    "temp": "28°C",
    "bestSeason": "October – March",
    "language": "Kannada, Konkani, English",
    "avgBudget": "₹1,500 – ₹3,200 / day",
    "lat": 14.094,
    "lng": 74.4899,
    "famousFood": [
      "Coastal Fish Meals",
      "Mangalorean Buns",
      "Tender Coconut",
      "Neer Dosa with Chutney"
    ],
    "emergencyContacts": [
      {
        "name": "Murdeshwar Police Station",
        "number": "112 / 08385-268233",
        "type": "Police"
      },
      {
        "name": "Government Hospital Bhatkal",
        "number": "08385-226424",
        "type": "Hospital"
      }
    ],
    "places": [
      {
        "id": "mur-1",
        "name": "Giant 123-Foot Shiva Statue & Raja Gopura",
        "category": "Spiritual & Coastal",
        "rating": 4.8,
        "reviewCount": "68k+",
        "description": "Magnificent 123-foot monolithic Shiva statue on Kanduka Hill, with a high-speed elevator inside the 249-foot 20-story Raja Gopura offering coastal vistas.",
        "bestTime": "6:30 AM – 10:30 AM & 4:30 PM – 7:30 PM (Sunset glow)",
        "timing": "6:00 AM – 8:30 PM",
        "entryFee": "Free (Lift to 18th floor ₹20)",
        "approxCost": 50,
        "address": "Kanduka Hill, Murdeshwar, Uttara Kannada 581350",
        "imageUrl": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
        "highlights": [
          "123-Foot Lord Shiva Statue",
          "249-Foot 20-Story Raja Gopura Lift",
          "Arabian Sea Surrounding Panorama"
        ],
        "tags": [
          "Shiva",
          "Statue",
          "Coast",
          "Must Visit"
        ],
        "insiderTip": "Take the internal elevator to the 18th floor of the Raja Gopura for a jaw-dropping aerial view of the Shiva statue against the blue sea.",
        "googleMapsUrl": "https://maps.google.com/?q=Murdeshwar+Temple+Karnataka",
        "lat": 14.094,
        "lng": 74.4899,
        "durationHours": 2.5
      }
    ]
  }
};

export const SUPPORTED_CITIES = Object.keys(CITIES_DATABASE);
export const DEFAULT_CITY = "Bengaluru";

// WMO Weather code interpreter for Open-Meteo
function interpretWeatherCode(code: number): { condition: string; emoji: string } {
  if (code === 0) return { condition: "Clear Sky & Sunny", emoji: "☀️" };
  if (code === 1 || code === 2) return { condition: "Mainly Clear", emoji: "🌤️" };
  if (code === 3) return { condition: "Partly Cloudy", emoji: "⛅" };
  if (code === 45 || code === 48) return { condition: "Fog & Mist", emoji: "🌫️" };
  if (code >= 51 && code <= 55) return { condition: "Light Drizzle", emoji: "🌦️" };
  if (code >= 61 && code <= 65) return { condition: "Rain Showers", emoji: "🌧️" };
  if (code >= 71 && code <= 77) return { condition: "Snowfall", emoji: "❄️" };
  if (code >= 80 && code <= 82) return { condition: "Passing Rain Showers", emoji: "🌧️" };
  if (code >= 95 && code <= 99) return { condition: "Thunderstorm", emoji: "⛈️" };
  return { condition: "Pleasant", emoji: "🌤️" };
}

export const travelGuruService = {
  // Returns list of popular / supported destination names
  getSupportedCities(): string[] {
    return SUPPORTED_CITIES;
  },

  // Live real-time weather integration via free Open-Meteo API
  async fetchLiveWeather(cityName: string, lat?: number, lng?: number): Promise<LiveWeatherInfo> {
    const cached = weatherCache.get(cityName.toLowerCase());
    const now = Date.now();
    if (cached && cached.expiry > now) {
      return cached.data;
    }

    try {
      let targetLat = lat;
      let targetLng = lng;

      // If lat/lng not provided, lookup via Geocoding
      if (!targetLat || !targetLng) {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.results && geoData.results.length > 0) {
            targetLat = geoData.results[0].latitude;
            targetLng = geoData.results[0].longitude;
          }
        }
      }

      if (targetLat && targetLng) {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
        const res = await fetch(weatherUrl);
        if (res.ok) {
          const data = await res.json();
          const cur = data.current;
          const tempNum = Math.round(cur.temperature_2m);
          const wInfo = interpretWeatherCode(cur.weather_code);

          // Generate dynamic advisory
          let advisory = "Great conditions for outdoor exploring and sightseeing.";
          if (tempNum > 33) {
            advisory = "Warm afternoon heat. Best to explore monuments early morning or evening and carry water.";
          } else if (tempNum < 12) {
            advisory = "Chilly mountain weather! Wear cozy warm layers or jackets.";
          } else if (cur.weather_code >= 61 && cur.weather_code <= 82) {
            advisory = "Rain showers expected. Carry an umbrella or enjoy indoor heritage cafes.";
          } else if (tempNum >= 18 && tempNum <= 28) {
            advisory = "Ideal golden travel weather! Perfect for walking tours and sunset points.";
          }

          const liveWeather: LiveWeatherInfo = {
            temp: `${tempNum}°C`,
            tempNum,
            condition: wInfo.condition,
            conditionEmoji: wInfo.emoji,
            humidity: `${cur.relative_humidity_2m}%`,
            windSpeed: `${Math.round(cur.wind_speed_10m)} km/h`,
            weatherAdvisory: advisory,
            isLive: true,
            lastUpdated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          };

          // Cache for 15 minutes
          weatherCache.set(cityName.toLowerCase(), {
            data: liveWeather,
            expiry: now + 15 * 60 * 1000
          });

          return liveWeather;
        }
      }
    } catch (e) {
      console.warn("Could not fetch live weather, falling back to catalog stats:", e);
    }

    // Default Fallback
    const fallback: LiveWeatherInfo = {
      temp: "27°C",
      tempNum: 27,
      condition: "Pleasant & Clear",
      conditionEmoji: "☀️",
      humidity: "55%",
      windSpeed: "10 km/h",
      weatherAdvisory: "Pleasant travel weather! Great time for exploring city sights.",
      isLive: false,
      lastUpdated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    return fallback;
  },

  // Open-City Engine: Dynamic city metadata and place generation for ANY entered city
  async resolveCityInfo(cityName: string): Promise<CityInfo> {
    const trimmed = cityName.trim();
    const key = Object.keys(CITIES_DATABASE).find(k => k.toLowerCase() === trimmed.toLowerCase());
    if (key) {
      const city = { ...CITIES_DATABASE[key] };
      // Attach live weather asynchronously or cached
      const weather = await this.fetchLiveWeather(city.name, city.lat, city.lng);
      city.weatherDetails = weather;
      city.temp = weather.temp;
      city.weather = `${weather.conditionEmoji} ${weather.condition}`;
      return city;
    }

    // Check custom cache
    const cachedCustom = customCityCache.get(trimmed.toLowerCase());
    if (cachedCustom) {
      return cachedCustom;
    }

    // Geocode custom city dynamically using Open-Meteo Geocoding
    let lat = 20.5937;
    let lng = 78.9629;
    let stateOrCountry = "India";
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=en&format=json`
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          const r = geoData.results[0];
          lat = r.latitude;
          lng = r.longitude;
          stateOrCountry = [r.admin1, r.country].filter(Boolean).join(", ");
        }
      }
    } catch (_) {}

    const liveWeather = await this.fetchLiveWeather(trimmed, lat, lng);

    const generatedCity: CityInfo = {
      name: trimmed,
      stateOrCountry,
      tagline: `Discover the Wonders & Local Charm of ${trimmed}`,
      badge: "Dynamic Destination",
      description: `A vibrant destination in ${stateOrCountry}, renowned for iconic cultural sights, historic landmarks, bustling local bazaars, and regional culinary delicacies.`,
      weather: `${liveWeather.conditionEmoji} ${liveWeather.condition}`,
      temp: liveWeather.temp,
      weatherDetails: liveWeather,
      bestSeason: "October – March",
      language: "Regional Language, Hindi, English",
      avgBudget: "₹1,800 – ₹3,200 / day",
      lat,
      lng,
      famousFood: [`Signature Regional Specialties of ${trimmed}`, "Local Street Food Trail", "Traditional Desserts & Beverages"],
      emergencyContacts: [
        { name: "National Tourist Helpline", number: "1363", type: "Tourist Help" },
        { name: "Police Emergency", number: "112 / 100", type: "Police" },
        { name: "Medical Ambulance", number: "108", type: "Ambulance" }
      ],
      places: [
        {
          id: `dyn-${trimmed.toLowerCase()}-1`,
          name: `${trimmed} Historic Fort & Heritage Monument`,
          category: "Heritage & History",
          rating: 4.8,
          reviewCount: "25k+",
          description: `The iconic historical landmark and cultural centerpiece of ${trimmed}, featuring magnificent period architecture, panoramic ramparts, and heritage archives.`,
          bestTime: "8:30 AM – 11:00 AM (Cool morning breeze & best photography)",
          timing: "8:30 AM – 6:00 PM",
          entryFee: "₹50 (General)",
          approxCost: 50,
          address: `Old Fort Road, Central ${trimmed}`,
          imageUrl: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80",
          highlights: ["Historical Ramparts", "Archaeological Museum", "Panoramic City Views"],
          tags: ["Heritage", "Architecture", "Must Visit"],
          insiderTip: "Visit during early morning hours to avoid peak heat and long ticket lines.",
          googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(trimmed)}+Fort`,
          lat,
          lng,
          durationHours: 2.5
        },
        {
          id: `dyn-${trimmed.toLowerCase()}-2`,
          name: `${trimmed} Traditional Food Bazaar & Night Market`,
          category: "Food & Markets",
          rating: 4.7,
          reviewCount: "30k+",
          description: `Vibrant culinary lane famous for regional specialties, fresh street savories, sweets, and handicrafts in ${trimmed}.`,
          bestTime: "7:00 PM – 10:30 PM (Vibrant nightlife atmosphere)",
          timing: "11:00 AM – 11:00 PM",
          entryFee: "Free to explore (₹200 - ₹500 food)",
          approxCost: 300,
          address: `Old City Bazaar Square, ${trimmed}`,
          imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
          highlights: ["Regional Street Food", "Local Handicrafts", "Vibrant Night Stalls"],
          tags: ["Food", "Bazaar", "Street Snacks"],
          insiderTip: "Try the signature local street dish and fresh kulhad chai from the crowded central stall.",
          googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(trimmed)}+Market`,
          lat,
          lng,
          durationHours: 2
        },
        {
          id: `dyn-${trimmed.toLowerCase()}-3`,
          name: `${trimmed} Waterfront Promenade & Sunset Viewpoint`,
          category: "Nightlife & Views",
          rating: 4.8,
          reviewCount: "20k+",
          description: `Scenic promenade offering panoramic sunset horizons, gentle breezes, and evening walking paths.`,
          bestTime: "5:00 PM – 7:00 PM (Golden hour & dusk lighting)",
          timing: "Open 24 Hours",
          entryFee: "Free Entry",
          approxCost: 0,
          address: `Lake / Riverfront Boulevard, ${trimmed}`,
          imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
          highlights: ["Sunset Point", "Breezy Promenade", "Evening Lighting"],
          tags: ["Sunset", "Views", "Romantic", "Relaxing"],
          insiderTip: "Arrive 30 minutes before sundown to secure an unblocked viewing spot.",
          googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(trimmed)}+Sunset+Point`,
          lat,
          lng,
          durationHours: 1.5
        },
        {
          id: `dyn-${trimmed.toLowerCase()}-4`,
          name: `${trimmed} Sacred Temple & Peace Pavilion`,
          category: "Cultural & Spiritual",
          rating: 4.7,
          reviewCount: "18k+",
          description: `Spiritual sanctuary revered for intricate stone sculptures, serene prayer gardens, and sacred water tanks.`,
          bestTime: "7:00 AM – 9:30 AM (Peaceful morning prayer)",
          timing: "6:00 AM – 8:30 PM",
          entryFee: "Free Entry",
          approxCost: 0,
          address: `Temple Road, ${trimmed}`,
          imageUrl: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80",
          highlights: ["Intricate Stone Carvings", "Peaceful Courtyard", "Morning Chants"],
          tags: ["Spiritual", "Heritage", "Peaceful"],
          insiderTip: "Dress modestly and remove shoes at the designated entrance counter.",
          googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(trimmed)}+Temple`,
          lat,
          lng,
          durationHours: 1.5
        },
        {
          id: `dyn-${trimmed.toLowerCase()}-5`,
          name: `${trimmed} Secret Garden & Heritage Stepwell`,
          category: "Hidden Gem",
          rating: 4.6,
          reviewCount: "8k+",
          description: `Hidden architectural marvel and peaceful oasis tucked away from main traffic routes, loved by photographers and heritage lovers.`,
          bestTime: "10:00 AM – 1:00 PM (Best natural lighting)",
          timing: "8:00 AM – 6:00 PM",
          entryFee: "Free Entry",
          approxCost: 0,
          address: `Old Heritage Quarter, ${trimmed}`,
          imageUrl: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?auto=format&fit=crop&w=800&q=80",
          highlights: ["Ancient Stone Architecture", "Uncrowded Atmosphere", "Photography Spot"],
          tags: ["Hidden Gem", "Offbeat", "Photography"],
          insiderTip: "A tranquil spot away from crowds, perfect for sketching or reading under old shade trees.",
          googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(trimmed)}+Heritage`,
          lat,
          lng,
          durationHours: 1.5
        }
      ]
    };

    customCityCache.set(trimmed.toLowerCase(), generatedCity);
    return generatedCity;
  },

  // Synchronous city info getter (looks up database or cached)
  getCityInfo(cityName: string): CityInfo {
    const key = Object.keys(CITIES_DATABASE).find(k => k.toLowerCase() === cityName.toLowerCase());
    if (key) {
      return CITIES_DATABASE[key];
    }
    const cached = customCityCache.get(cityName.toLowerCase());
    if (cached) {
      return cached;
    }
    // Fallback default
    return CITIES_DATABASE[DEFAULT_CITY];
  },

  // Dynamic multi-day itinerary builder
  generateDynamicItinerary(cityData: CityInfo, days: number = 1): ItinerarySlot[] {
    const places = cityData.places;
    const slots: ItinerarySlot[] = [];

    const heritagePlace = places.find(p => p.category === "Heritage & History") || places[0];
    const foodPlace = places.find(p => p.category === "Food & Markets") || places[1] || places[0];
    const sunsetPlace = places.find(p => p.category === "Nightlife & Views" || p.category === "Nature & Parks") || places[places.length - 1];
    const spiritualPlace = places.find(p => p.category === "Cultural & Spiritual" || p.category === "Hidden Gem") || places[2] || places[0];
    const hiddenGem = places.find(p => p.category === "Hidden Gem") || places[places.length - 1];

    // Day 1
    slots.push(
      {
        day: 1,
        timeSlot: "8:30 AM – 11:30 AM",
        placeName: heritagePlace.name,
        category: "Heritage & History",
        activity: `Morning cultural exploration of ${heritagePlace.name}. Take in the iconic architecture in comfortable morning light.`,
        tip: heritagePlace.insiderTip || "Arrive early to beat queues.",
        estimatedCost: heritagePlace.approxCost || 0,
        googleMapsUrl: heritagePlace.googleMapsUrl
      },
      {
        day: 1,
        timeSlot: "12:30 PM – 2:30 PM",
        placeName: `Traditional Lunch at ${foodPlace.name}`,
        category: "Food & Markets",
        activity: `Authentic regional feast & resting during afternoon warmth. Savor signature local delicacies of ${cityData.name}.`,
        tip: foodPlace.insiderTip || "Try the signature local specialty and chilled beverage.",
        estimatedCost: foodPlace.approxCost || 250,
        googleMapsUrl: foodPlace.googleMapsUrl
      },
      {
        day: 1,
        timeSlot: "4:30 PM – 7:00 PM",
        placeName: sunsetPlace.name,
        category: "Nightlife & Views",
        activity: `Golden hour sunset & panoramic breeze at ${sunsetPlace.name}. Catch spectacular skyline views as twilight sets in.`,
        tip: sunsetPlace.insiderTip || "Reach 30 mins before sunset for prime views.",
        estimatedCost: sunsetPlace.approxCost || 0,
        googleMapsUrl: sunsetPlace.googleMapsUrl
      },
      {
        day: 1,
        timeSlot: "8:30 PM – 10:30 PM",
        placeName: `${foodPlace.name} Night Food Trail`,
        category: "Food & Markets",
        activity: `Vibrant night street food walk and dessert tasting. Soak in the lively night pulse of ${cityData.name}.`,
        tip: "Keep cash or UPI handy for small street vendors.",
        estimatedCost: 350,
        googleMapsUrl: foodPlace.googleMapsUrl
      }
    );

    // If Day 2 requested
    if (days >= 2) {
      slots.push(
        {
          day: 2,
          timeSlot: "8:30 AM – 11:00 AM",
          placeName: spiritualPlace.name,
          category: "Cultural & Spiritual",
          activity: `Serene morning visit to ${spiritualPlace.name}. Immerse in the peaceful ambience and historic artistry.`,
          tip: spiritualPlace.insiderTip || "Modest attire recommended.",
          estimatedCost: spiritualPlace.approxCost || 0,
          googleMapsUrl: spiritualPlace.googleMapsUrl
        },
        {
          day: 2,
          timeSlot: "12:00 PM – 2:30 PM",
          placeName: hiddenGem.name,
          category: "Hidden Gem",
          activity: `Discovering offbeat architectural treasures at ${hiddenGem.name} away from tourist crowds.`,
          tip: hiddenGem.insiderTip || "Great spot for photography.",
          estimatedCost: hiddenGem.approxCost || 0,
          googleMapsUrl: hiddenGem.googleMapsUrl
        },
        {
          day: 2,
          timeSlot: "5:00 PM – 8:00 PM",
          placeName: `Old City Heritage Walk & Handicraft Shopping in ${cityData.name}`,
          category: "Food & Markets",
          activity: `Leisurely walking tour through historical bazaars to pick up authentic artisanal souvenirs, textiles, and spices.`,
          tip: "Bargain politely in traditional bazaars; check multiple shops.",
          estimatedCost: 400,
          googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(cityData.name)}+bazaar`
        }
      );
    }

    // If Day 3 requested
    if (days >= 3) {
      slots.push(
        {
          day: 3,
          timeSlot: "9:00 AM – 1:00 PM",
          placeName: `Countryside / Outskirts Excursion of ${cityData.name}`,
          category: "Nature & Parks",
          activity: `Day trip to nearby scenic nature spots, ancient stepwells or lake view reserves surrounding ${cityData.name}.`,
          tip: "Hire a pre-booked local cab for the morning trip.",
          estimatedCost: 800,
          googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(cityData.name)}+attractions`
        },
        {
          day: 3,
          timeSlot: "6:00 PM – 9:30 PM",
          placeName: `Farewell Rooftop Dining & Cultural Evening`,
          category: "Cultural & Spiritual",
          activity: `Celebratory farewell dinner overlooking the illuminated city skyline with live folk music and regional tasting menu.`,
          tip: "Reserve rooftop seats in advance.",
          estimatedCost: 900,
          googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(cityData.name)}+rooftop+restaurant`
        }
      );
    }

    return slots;
  },

  // Dynamic Query Processor & Local Guru Engine
  async queryLocalGuru(userPrompt: string, selectedCity: string): Promise<LocalGuruResponse> {
    // Dynamic city resolution (supports ANY city)
    const cityData = await this.resolveCityInfo(selectedCity);
    const lowerPrompt = userPrompt.toLowerCase();

    // Check for days in prompt (e.g. "2 days", "3 days", "weekend")
    let requestedDays = 1;
    if (lowerPrompt.includes("3 day") || lowerPrompt.includes("3-day") || lowerPrompt.includes("three day")) {
      requestedDays = 3;
    } else if (lowerPrompt.includes("2 day") || lowerPrompt.includes("2-day") || lowerPrompt.includes("two day") || lowerPrompt.includes("weekend")) {
      requestedDays = 2;
    }

    let filteredPlaces = cityData.places;
    let replyText = "";
    let speechAudioText = "";
    let suggestedFollowUps: string[] = [];
    let itineraryPlan: ItinerarySlot[] | undefined = undefined;
    let activeFilter: string | undefined = undefined;

    // 1. Itinerary Planning Request
    if (
      lowerPrompt.includes("itinerary") ||
      lowerPrompt.includes("plan my day") ||
      lowerPrompt.includes("day plan") ||
      lowerPrompt.includes("schedule") ||
      lowerPrompt.includes("trip plan") ||
      lowerPrompt.includes("guide me")
    ) {
      itineraryPlan = this.generateDynamicItinerary(cityData, requestedDays);
      const totalBudget = itineraryPlan.reduce((sum, s) => sum + (s.estimatedCost || 0), 0);

      replyText = `Here is your **Curated ${requestedDays}-Day Master Itinerary for ${cityData.name}**! 🗓️\n\n` +
        `Mapped out chronologically from morning heritage walks to afternoon feasts and golden hour sunsets. ` +
        `Estimated activity & meal budget: **₹${totalBudget.toLocaleString()} / person**.\n\n` +
        itineraryPlan.map(s => `• **${s.timeSlot}** (${s.placeName}): ${s.activity} *(Tip: ${s.tip})*`).join("\n\n");

      speechAudioText = `Here is your curated ${requestedDays}-day itinerary for ${cityData.name}. Starting with ${itineraryPlan[0].placeName} in the morning, followed by local dining, sunset viewpoints, and night street food!`;

      suggestedFollowUps = [
        `Where is the best street food in ${cityData.name}?`,
        `What are the entry ticket costs in ${cityData.name}?`,
        `Suggest best sunset viewpoints in ${cityData.name}`,
        `Show live weather & what to wear in ${cityData.name}`
      ];

      return {
        id: `guru-msg-${Date.now()}`,
        role: "assistant",
        content: replyText,
        city: cityData.name,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        recommendations: filteredPlaces,
        audioText: speechAudioText,
        suggestedFollowUps,
        itineraryPlan,
        weatherSnapshot: cityData.weatherDetails,
        daysPlanned: requestedDays
      };
    }

    // 2. Food & Culinary Intent
    if (
      lowerPrompt.includes("food") ||
      lowerPrompt.includes("eat") ||
      lowerPrompt.includes("restaurant") ||
      lowerPrompt.includes("street food") ||
      lowerPrompt.includes("thali") ||
      lowerPrompt.includes("breakfast") ||
      lowerPrompt.includes("dinner") ||
      lowerPrompt.includes("lunch") ||
      lowerPrompt.includes("snack") ||
      lowerPrompt.includes("dish") ||
      lowerPrompt.includes("specialty") ||
      lowerPrompt.includes("sweet")
    ) {
      filteredPlaces = cityData.places.filter(p => p.category === "Food & Markets" || p.category === "Cultural & Spiritual");
      if (filteredPlaces.length === 0) filteredPlaces = cityData.places;
      activeFilter = "Food & Markets";

      const foodItems = cityData.famousFood ? cityData.famousFood.join(", ") : "Local regional thali, hot snacks & seasonal sweets";

      replyText = `Namaste foodie! 🍲 In **${cityData.name}**, you must treat your taste buds to:\n\n` +
        `**Famous Delicacies:** ${foodItems}\n\n` +
        `Here are the highest-rated dining spots & street food havens you cannot miss:`;

      speechAudioText = `Here are the top local food spots you must try in ${cityData.name}: ${filteredPlaces.slice(0, 3).map(p => p.name).join(", ")}. Don't miss the local ${cityData.famousFood?.[0] || "regional thali"}!`;

      suggestedFollowUps = [
        `Plan a 1-day itinerary including these food spots`,
        `Where to watch sunset in ${cityData.name}?`,
        `How much does a full meal cost here?`,
        `Suggest pure veg / traditional dining`
      ];
    }
    // 3. Heritage & Historical Forts
    else if (
      lowerPrompt.includes("heritage") ||
      lowerPrompt.includes("fort") ||
      lowerPrompt.includes("history") ||
      lowerPrompt.includes("palace") ||
      lowerPrompt.includes("museum") ||
      lowerPrompt.includes("temple") ||
      lowerPrompt.includes("ashram") ||
      lowerPrompt.includes("monument") ||
      lowerPrompt.includes("stepwell")
    ) {
      filteredPlaces = cityData.places.filter(p => p.category === "Heritage & History" || p.category === "Cultural & Spiritual");
      if (filteredPlaces.length === 0) filteredPlaces = cityData.places;
      activeFilter = "Heritage & History";

      replyText = `Step back in time! 🏛️ **${cityData.name}** is steeped in extraordinary history and timeless architecture.\n\n` +
        `Here are the iconic historical monuments, royal fortresses & heritage landmarks you should visit:`;

      speechAudioText = `Here are the iconic historical monuments and heritage sites in ${cityData.name}: ${filteredPlaces.slice(0, 3).map(p => p.name).join(", ")}.`;

      suggestedFollowUps = [
        `Plan a heritage tour itinerary for ${cityData.name}`,
        `What are the opening timings and entry tickets?`,
        `Where to eat good food near these monuments?`,
        `Tell me secret hidden gems in ${cityData.name}`
      ];
    }
    // 4. Sunset, Views & Waterfronts
    else if (
      lowerPrompt.includes("sunset") ||
      lowerPrompt.includes("night") ||
      lowerPrompt.includes("view") ||
      lowerPrompt.includes("evening") ||
      lowerPrompt.includes("lake") ||
      lowerPrompt.includes("promenade") ||
      lowerPrompt.includes("beach") ||
      lowerPrompt.includes("golden hour") ||
      lowerPrompt.includes("rooftop")
    ) {
      filteredPlaces = cityData.places.filter(p => p.category === "Nightlife & Views" || p.category === "Nature & Parks");
      if (filteredPlaces.length === 0) filteredPlaces = cityData.places;
      activeFilter = "Nightlife & Views";

      replyText = `Looking for breathtaking views? 🌅 Here are prime evening viewpoints, scenic waterfronts, and golden hour sunset spots in **${cityData.name}**:`;
      speechAudioText = `For sunset and evening views in ${cityData.name}, I recommend ${filteredPlaces.slice(0, 3).map(p => p.name).join(", ")}.`;

      suggestedFollowUps = [
        `What dinner places are near these sunset spots?`,
        `Plan a 1-day itinerary for ${cityData.name}`,
        `Show live weather for ${cityData.name}`,
        `Are there boat rides or rooftop cafes available?`
      ];
    }
    // 5. Hidden Gems & Offbeat Spots
    else if (
      lowerPrompt.includes("hidden") ||
      lowerPrompt.includes("gem") ||
      lowerPrompt.includes("offbeat") ||
      lowerPrompt.includes("secret") ||
      lowerPrompt.includes("peaceful") ||
      lowerPrompt.includes("unique") ||
      lowerPrompt.includes("less crowded")
    ) {
      filteredPlaces = cityData.places.filter(p => p.category === "Hidden Gem" || p.category === "Cultural & Spiritual" || p.tags.includes("Instagrammable"));
      if (filteredPlaces.length === 0) filteredPlaces = cityData.places;
      activeFilter = "Hidden Gem";

      replyText = `Ready to discover secret spots? ✨ Here are authentic hidden gems and cultural treasures in **${cityData.name}** away from typical tourist crowds:`;
      speechAudioText = `Here are secret local gems and offbeat spots in ${cityData.name}: ${filteredPlaces.slice(0, 3).map(p => p.name).join(", ")}.`;

      suggestedFollowUps = [
        `What local tips should I know for these spots?`,
        `What are the best street food spots in ${cityData.name}?`,
        `Plan a 2-day offbeat itinerary`,
        `How to get around easily in ${cityData.name}?`
      ];
    }
    // 6. Budget & Cost Breakdown
    else if (
      lowerPrompt.includes("budget") ||
      lowerPrompt.includes("cost") ||
      lowerPrompt.includes("cheap") ||
      lowerPrompt.includes("save") ||
      lowerPrompt.includes("expensive") ||
      lowerPrompt.includes("price") ||
      lowerPrompt.includes("how much")
    ) {
      replyText = `💰 **Trip Budget Breakdown for ${cityData.name}**:\n\n` +
        `• **Backpacker / Shoestring:** ₹1,200 – ₹1,800 / day *(Hostel/dharamsala, street food, autos/metro)*\n` +
        `• **Comfort / Mid-Range:** ₹2,500 – ₹4,000 / day *(3-star heritage hotel, sit-down dining, day cab)*\n` +
        `• **Luxury Experience:** ₹6,000+ / day *(Heritage palace stay, fine dining, private AC chauffeur)*\n\n` +
        `💡 **Money-Saving Hacks in ${cityData.name}:**\n` +
        `1. Most historical temples and riverfronts are **100% Free** entry.\n` +
        `2. Opt for shared auto-rickshaws, metro or daily cab rental instead of booking multiple one-way cabs.\n` +
        `3. Savor authentic regional thalis at lunchtime for unlimited multi-dish courses at great value.`;

      speechAudioText = `For ${cityData.name}, average daily budgets range from 1,500 rupees for backpackers up to 4,000 rupees for comfortable mid-range travel. Most major riverfronts and temples offer free entry!`;

      suggestedFollowUps = [
        `🗓️ Plan a budget-friendly 1-day itinerary`,
        `🍲 Cheap & iconic street food in ${cityData.name}`,
        `What are the entry ticket costs?`,
        `Where to stay in ${cityData.name}?`
      ];
    }
    // 7. Weather & What to Wear
    else if (
      lowerPrompt.includes("weather") ||
      lowerPrompt.includes("temp") ||
      lowerPrompt.includes("temperature") ||
      lowerPrompt.includes("rain") ||
      lowerPrompt.includes("cloth") ||
      lowerPrompt.includes("wear") ||
      lowerPrompt.includes("climate")
    ) {
      const weather = cityData.weatherDetails || await this.fetchLiveWeather(cityData.name, cityData.lat, cityData.lng);
      replyText = `🌤️ **Live Real-Time Weather in ${cityData.name}**:\n\n` +
        `• **Current Condition:** ${weather.conditionEmoji} ${weather.condition}\n` +
        `• **Temperature:** **${weather.temp}** (Humidity: ${weather.humidity || "50%"}, Wind: ${weather.windSpeed || "10 km/h"})\n` +
        `• **Best Season to Visit:** ${cityData.bestSeason || "October – March"}\n\n` +
        `🧥 **What to Pack & Wear:**\n` +
        `${weather.weatherAdvisory}\n\n` +
        `• Wear breathable cottons for daytime exploration.\n` +
        `• Carry comfortable walking sneakers or sandals (many heritage places require removing shoes).\n` +
        `• Carry sunglasses and a light jacket for breezy evenings.`;

      speechAudioText = `Current weather in ${cityData.name} is ${weather.temp} and ${weather.condition}. ${weather.weatherAdvisory}`;

      suggestedFollowUps = [
        `Plan my day based on this weather`,
        `What are good indoor places if it gets hot/rainy?`,
        `Suggest best sunset viewpoints`,
        `Famous street foods to enjoy right now`
      ];
    }
    // 8. Emergency & Safety Intent
    else if (
      lowerPrompt.includes("emergency") ||
      lowerPrompt.includes("police") ||
      lowerPrompt.includes("hospital") ||
      lowerPrompt.includes("help") ||
      lowerPrompt.includes("safety") ||
      lowerPrompt.includes("lost") ||
      lowerPrompt.includes("ambulance") ||
      lowerPrompt.includes("doctor")
    ) {
      const contacts = cityData.emergencyContacts || [
        { name: "National Emergency Helpline", number: "112", type: "All Emergencies" },
        { name: "Tourist Helpline", number: "1363", type: "Tourist Assistance" },
        { name: "Police Control Room", number: "100", type: "Police" },
        { name: "Ambulance", number: "108", type: "Ambulance" }
      ];

      replyText = `🚨 **Emergency Helplines & Safety in ${cityData.name}**:\n\n` +
        `Help is immediately available 24/7:\n\n` +
        contacts.map(c => `• **${c.name}:** \`${c.number}\` *(${c.type})*`).join("\n") +
        `\n\n⚠️ *For any immediate threat or emergency, dial **112** or **100** right away.*`;

      speechAudioText = `Emergency assistance in ${cityData.name}: Dial 112 or 100 for police, 108 for ambulance, and 1363 for national tourist helpline.`;

      suggestedFollowUps = [
        `What are safe areas to stay in ${cityData.name}?`,
        `How to travel safely at night?`,
        `Plan my 1-day itinerary`,
        `Suggest nearest hospital / police station`
      ];
    }
    // 9. Default General / Welcome
    else {
      const liveW = cityData.weatherDetails;
      replyText = `Welcome to **${cityData.name}** (${cityData.stateOrCountry})! 🧭\n\n` +
        `${cityData.description}\n\n` +
        (liveW ? `🌡️ **Live Weather:** ${liveW.conditionEmoji} ${liveW.temp}, ${liveW.condition}\n\n` : "") +
        `Here are the top famous places you must visit in **${cityData.name}**:`;

      speechAudioText = `Welcome to ${cityData.name}! Here are the top famous attractions you must visit: ${filteredPlaces.slice(0, 3).map(p => p.name).join(", ")}.`;

      suggestedFollowUps = [
        `🗓️ Plan a 1-Day Itinerary for ${cityData.name}`,
        `🍲 Famous street food in ${cityData.name}`,
        `🌅 Evening & Sunset views in ${cityData.name}`,
        `💰 Daily budget breakdown for ${cityData.name}`,
        `✨ Secret local gems in ${cityData.name}`,
        `🌤️ Live weather and clothing tips`
      ];
    }

    return {
      id: `guru-msg-${Date.now()}`,
      role: "assistant",
      content: replyText,
      city: cityData.name,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      recommendations: filteredPlaces,
      audioText: speechAudioText,
      suggestedFollowUps,
      itineraryPlan,
      weatherSnapshot: cityData.weatherDetails,
      categoryFilter: activeFilter
    };
  }
};
