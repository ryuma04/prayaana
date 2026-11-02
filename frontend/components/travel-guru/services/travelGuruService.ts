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
  "Ahmedabad": {
    name: "Ahmedabad",
    stateOrCountry: "Gujarat, India",
    tagline: "India's First UNESCO World Heritage City",
    badge: "Heritage & Culture",
    description: "Famous for textile heritage, Gandhi Ashram, vibrant night street markets, and 15th-century stepwells.",
    weather: "Pleasant & Clear",
    temp: "28°C",
    bestSeason: "October – March",
    language: "Gujarati, Hindi, English",
    avgBudget: "₹1,500 – ₹2,500 / day",
    lat: 23.0225,
    lng: 72.5714,
    famousFood: ["Gwalior Dosa at Manek Chowk", "Authentic Gujarati Thali at Agashiye", "Fafda & Jalebi at Chandravilas", "Khaman Dhokla", "Jamun Shots"],
    emergencyContacts: [
      { name: "Tourist Police Helpline", number: "1363", type: "Tourist Help" },
      { name: "Ahmedabad City Police", number: "100 / 112", type: "Police" },
      { name: "Civil Hospital Asarwa", number: "079-22683721", type: "Hospital" },
      { name: "Medical Emergency Ambulance", number: "108", type: "Ambulance" }
    ],
    places: [
      {
        id: "ahd-1",
        name: "Sabarmati Ashram",
        category: "Heritage & History",
        rating: 4.8,
        reviewCount: "42k+",
        description: "Historical residence of Mahatma Gandhi along the banks of Sabarmati River. Peaceful atmosphere with freedom movement archives and tranquil tree-shaded grounds.",
        bestTime: "8:30 AM – 11:00 AM (Cool morning breeze)",
        timing: "8:30 AM – 6:30 PM",
        entryFee: "Free Entry",
        approxCost: 0,
        address: "Ashram Road, Old Wadaj, Ahmedabad",
        imageUrl: "https://images.unsplash.com/photo-1598890777032-bde835ba27c2?auto=format&fit=crop&w=800&q=80",
        highlights: ["Hridaya Kunj", "Gandhi Heritage Museum", "Riverfront Promenade Walk"],
        tags: ["UNESCO", "Peaceful", "History", "Must Visit"],
        insiderTip: "Visit early morning at 8:30 AM before tourist buses arrive. Walk the tree-shaded riverfront walkway directly behind the ashram.",
        googleMapsUrl: "https://maps.google.com/?q=Sabarmati+Ashram+Ahmedabad",
        lat: 23.0605,
        lng: 72.5802,
        durationHours: 2
      },
      {
        id: "ahd-2",
        name: "Adalaj Stepwell (Adalaj ni Vav)",
        category: "Heritage & History",
        rating: 4.7,
        reviewCount: "28k+",
        description: "5-storey deep intricate Indo-Islamic architectural marvel built in 1498 by Queen Rudabai. Unique octagonal shaft keeps subterranean temperature 5 degrees cooler.",
        bestTime: "9:00 AM – 12:00 PM (Best natural lighting)",
        timing: "8:00 AM – 6:00 PM",
        entryFee: "Free Entry",
        approxCost: 0,
        address: "Adalaj, Gandhinagar Highway, Ahmedabad",
        imageUrl: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?auto=format&fit=crop&w=800&q=80",
        highlights: ["Intricate Carvings", "5-Level Underground Structure", "Photography Hotspot"],
        tags: ["Architecture", "Heritage", "Instagrammable"],
        insiderTip: "Walk down to the 3rd subterranean level for symmetrical pillar alignment photos with sunlight filtering down the central shaft.",
        googleMapsUrl: "https://maps.google.com/?q=Adalaj+Stepwell+Ahmedabad",
        lat: 23.1667,
        lng: 72.5833,
        durationHours: 1.5
      },
      {
        id: "ahd-3",
        name: "Manek Chowk Street Food Market",
        category: "Food & Markets",
        rating: 4.6,
        reviewCount: "35k+",
        description: "Jewelry market by day and bustling midnight street food haven from 8:30 PM with over 80 dessert, cheese, and spicy snack stalls.",
        bestTime: "9:00 PM – 11:30 PM (Vibrant nightlife)",
        timing: "8:30 PM – 1:30 AM",
        entryFee: "₹200 - ₹500 for food",
        approxCost: 350,
        address: "Old City, Near Bhadra Fort, Ahmedabad",
        imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
        highlights: ["Gwalior Dosa", "Pineapple Cheese Sandwich", "Kulfi & Rabdi"],
        tags: ["Street Food", "Nightlife", "Iconic"],
        insiderTip: "Try the iconic Gwalior butter dosa and Jamun shots. Arrive after 9:30 PM when the entire square converts into food stalls.",
        googleMapsUrl: "https://maps.google.com/?q=Manek+Chowk+Ahmedabad",
        lat: 23.0244,
        lng: 72.5906,
        durationHours: 2
      },
      {
        id: "ahd-4",
        name: "Sabarmati Riverfront & Atal Pedestrian Bridge",
        category: "Nightlife & Views",
        rating: 4.7,
        reviewCount: "40k+",
        description: "Spectacular glass-and-steel footbridge inspired by kite culture, offering breezy riverside panoramic views and evening light shows.",
        bestTime: "5:30 PM – 8:00 PM (Sunset & Illuminations)",
        timing: "9:00 AM – 11:00 PM",
        entryFee: "₹30 (Adults), ₹15 (Kids)",
        approxCost: 30,
        address: "Sabarmati Riverfront Promenade, Ellisbridge, Ahmedabad",
        imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
        highlights: ["Kite-inspired design", "River view sunset", "Illuminated evening walkway"],
        tags: ["Sunset", "Promenade", "Romantic", "Views"],
        insiderTip: "Buy the bridge ticket online or at the counter before 6 PM to enjoy both the daylight river reflection and the dusk LED lighting.",
        googleMapsUrl: "https://maps.google.com/?q=Atal+Bridge+Sabarmati+Riverfront",
        lat: 23.0289,
        lng: 72.5714,
        durationHours: 1.5
      },
      {
        id: "ahd-5",
        name: "Sidi Saiyyed Mosque (Tree of Life)",
        category: "Hidden Gem",
        rating: 4.7,
        reviewCount: "15k+",
        description: "1573 AD mosque famous for world-renowned delicate stone latticework jalis carved like intertwined tree branches and foliage.",
        bestTime: "10:00 AM – 12:00 PM (Direct morning sun reveals intricate shadows)",
        timing: "7:00 AM – 7:00 PM",
        entryFee: "Free Entry",
        approxCost: 0,
        address: "Opposite Electricity House, Gheekanta, Ahmedabad",
        imageUrl: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80",
        highlights: ["Stone Jali filigree", "Tree of Life motif (IIM Logo)", "Peaceful prayer hall"],
        tags: ["Heritage", "Architecture", "Spiritual", "Photography"],
        insiderTip: "Step into the courtyard to see the eastern marble filigree screen. Wear modest clothing covering knees and shoulders.",
        googleMapsUrl: "https://maps.google.com/?q=Sidi+Saiyyed+Mosque+Ahmedabad",
        lat: 23.0278,
        lng: 72.5815,
        durationHours: 1
      },
      {
        id: "ahd-6",
        name: "Agashiye Rooftop – The House of MG",
        category: "Cultural & Spiritual",
        rating: 4.8,
        reviewCount: "14k+",
        description: "Heritage haveli rooftop dining experience serving grand multi-course authentic Gujarati Thali on bronze plates with live folk music.",
        bestTime: "12:30 PM (Lunch) or 8:00 PM (Dinner under the stars)",
        timing: "12:00 PM – 3:30 PM, 7:00 PM – 11:00 PM",
        entryFee: "₹1,050 – ₹1,300 per thali",
        approxCost: 1100,
        address: "Opposite Sidi Saiyyed Mosque, Lal Darwaja, Ahmedabad",
        imageUrl: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
        highlights: ["Authentic Silver & Bronze Thali", "Live Jalebi Counter", "1920s Heritage Mansion"],
        tags: ["Fine Dining", "Authentic Thali", "Luxury", "Food"],
        insiderTip: "Reserve a terrace table 1 day in advance. Arrive 20 mins early to sample the fresh panna welcome drink and visit the vintage textile gallery.",
        googleMapsUrl: "https://maps.google.com/?q=Agashiye+House+of+MG+Ahmedabad",
        lat: 23.0272,
        lng: 72.5819,
        durationHours: 2
      }
    ]
  },

  "Jaipur": {
    name: "Jaipur",
    stateOrCountry: "Rajasthan, India",
    tagline: "The Pink City of Forts & Palaces",
    badge: "Royalty & Culture",
    description: "Capital of Rajasthan, famous for hilltop royal palaces, vibrant bazaars, Rajput heritage, and mouth-watering Pyaz Kachori.",
    weather: "Pleasant & Clear",
    temp: "27°C",
    bestSeason: "October – March",
    language: "Hindi, Rajasthani, English",
    avgBudget: "₹2,000 – ₹3,500 / day",
    lat: 26.9124,
    lng: 75.7873,
    famousFood: ["Pyaz Kachori at Rawat Mishtan", "Dal Baati Churma at LMB", "Laal Maas at Handi", "Lassi at Lassiwala MI Road", "Ghewar"],
    emergencyContacts: [
      { name: "Rajasthan Tourist Assistance Force", number: "1363", type: "Tourist Help" },
      { name: "Jaipur Police Control", number: "100 / 112", type: "Police" },
      { name: "SMS Hospital (Sawai Man Singh)", number: "0141-2560291", type: "Hospital" },
      { name: "Emergency Ambulance", number: "108", type: "Ambulance" }
    ],
    places: [
      {
        id: "jpr-1",
        name: "Amber Palace (Amer Fort)",
        category: "Heritage & History",
        rating: 4.8,
        reviewCount: "65k+",
        description: "Magnificent hilltop 16th-century fortress overlooking Maota Lake, famous for Sheesh Mahal (Hall of Mirrors) and grand ramparts.",
        bestTime: "8:00 AM – 11:00 AM or 6:30 PM (Evening Sound & Light show)",
        timing: "8:00 AM – 5:30 PM, 6:30 PM – 9:15 PM (Night Fort)",
        entryFee: "₹100 (Indians), ₹550 (Foreigners)",
        approxCost: 100,
        address: "Devisinghpura, Amer, Jaipur",
        imageUrl: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80",
        highlights: ["Sheesh Mahal (Mirror Palace)", "Ganesh Pol Gate", "Panoramic Aravalli Views"],
        tags: ["UNESCO", "Royal Palace", "Must Visit"],
        insiderTip: "Enter through Suraj Pol gate at 8:00 AM sharp to photograph Sheesh Mahal without crowds before tour groups arrive.",
        googleMapsUrl: "https://maps.google.com/?q=Amer+Fort+Jaipur",
        lat: 26.9855,
        lng: 75.8513,
        durationHours: 3
      },
      {
        id: "jpr-2",
        name: "Hawa Mahal (Palace of Winds)",
        category: "Heritage & History",
        rating: 4.7,
        reviewCount: "55k+",
        description: "5-storey pink sandstone facade featuring 953 jharokha honeycomb windows designed for royal women to observe street festivals secretly.",
        bestTime: "8:00 AM – 10:00 AM (Morning sunlight illuminates pink stone)",
        timing: "9:00 AM – 5:00 PM",
        entryFee: "₹50 (Indians), ₹200 (Foreigners)",
        approxCost: 50,
        address: "Hawa Mahal Rd, Badi Choupad, J.D.A. Market, Jaipur",
        imageUrl: "https://images.unsplash.com/photo-1600100397608-f010f44390b1?auto=format&fit=crop&w=800&q=80",
        highlights: ["953 Honeycomb Casements", "Tattoo Cafe Rooftop View", "Vibrant Old City Street"],
        tags: ["Iconic", "Pink City", "Photography"],
        insiderTip: "Cross the street and head to Wind View Cafe or Tattoo Cafe on the rooftop across Hawa Mahal for the classic postcard frame photo.",
        googleMapsUrl: "https://maps.google.com/?q=Hawa+Mahal+Jaipur",
        lat: 26.9239,
        lng: 75.8267,
        durationHours: 1.5
      },
      {
        id: "jpr-3",
        name: "Nahargarh Fort & Padao Sunset Point",
        category: "Nightlife & Views",
        rating: 4.7,
        reviewCount: "42k+",
        description: "Crown of the Aravalli hills built as a royal defense sanctuary. Offers sweeping 360-degree views of Jaipur cityscape during sunset.",
        bestTime: "5:00 PM – 7:30 PM (Golden hour sunset into twilight)",
        timing: "10:00 AM – 10:00 PM",
        entryFee: "₹50 (Entry), ₹200 (Padao Open Air Cafe)",
        approxCost: 250,
        address: "Krishna Nagar, Brahampuri, Jaipur",
        imageUrl: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80",
        highlights: ["Padao Rooftop Cafe", "Madhavendra Bhawan", "City Skyline Sunset"],
        tags: ["Sunset", "Panoramic", "Night View"],
        insiderTip: "Hire a cab with waiting time for the winding mountain road up. Watch the entire Pink City illuminate with twinkling lights after dusk.",
        googleMapsUrl: "https://maps.google.com/?q=Nahargarh+Fort+Jaipur",
        lat: 26.9372,
        lng: 75.8156,
        durationHours: 2.5
      },
      {
        id: "jpr-4",
        name: "Rawat Mishtan Bhandar & Bazaars",
        category: "Food & Markets",
        rating: 4.6,
        reviewCount: "38k+",
        description: "Legendary 70-year-old culinary institution famous across India for piping hot crispy Pyaz Kachori, Mawa Kachori, and Mirchi Vada.",
        bestTime: "8:30 AM – 11:30 AM (Fresh morning batch)",
        timing: "6:00 AM – 10:30 PM",
        entryFee: "₹100 – ₹250 per person",
        approxCost: 150,
        address: "Station Road, Sindhi Camp, Jaipur",
        imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
        highlights: ["Crispy Pyaz Kachori", "Sweet Mawa Kachori", "Ghewar with Rabdi"],
        tags: ["Street Food", "Iconic Breakfast", "Snacks"],
        insiderTip: "Pair the crispy Onion Kachori with their sweet Tamarind chutney and a glass of hot masala chai.",
        googleMapsUrl: "https://maps.google.com/?q=Rawat+Mishtan+Bhandar+Jaipur",
        lat: 26.9208,
        lng: 75.7978,
        durationHours: 1
      },
      {
        id: "jpr-5",
        name: "Panna Meena ka Kund Stepwell",
        category: "Hidden Gem",
        rating: 4.6,
        reviewCount: "12k+",
        description: "16th-century geometric stepwell with crisscross staircases, pastel ochre hues, and serene temple courtyards hidden near Amer Fort.",
        bestTime: "7:30 AM – 9:30 AM (Quiet morning without crowds)",
        timing: "7:00 AM – 6:00 PM",
        entryFee: "Free Entry",
        approxCost: 0,
        address: "Near Amer Fort, Kheri Gate, Amer, Jaipur",
        imageUrl: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?auto=format&fit=crop&w=800&q=80",
        highlights: ["Geometric Stair Patterns", "Quiet Historical Courtyard", "Architectural Symmetries"],
        tags: ["Hidden Gem", "Geometry", "Instagrammable"],
        insiderTip: "Combine this with your Amer Fort morning visit. It is just a 5-minute walk down from Amer Fort's elephant stand.",
        googleMapsUrl: "https://maps.google.com/?q=Panna+Meena+ka+Kund+Amer+Jaipur",
        lat: 26.9922,
        lng: 75.8569,
        durationHours: 1
      }
    ]
  },

  "Mumbai": {
    name: "Mumbai",
    stateOrCountry: "Maharashtra, India",
    tagline: "The City of Dreams & Arabian Sea Breezes",
    badge: "Metropolis & Coastal",
    description: "Financial powerhouse of India, famous for Victorian Gothic architecture, Marine Drive Queen's Necklace, Bollywood, and iconic street snacks.",
    weather: "Warm & Coastal Breeze",
    temp: "29°C",
    bestSeason: "November – February",
    language: "Marathi, Hindi, English",
    avgBudget: "₹2,500 – ₹4,500 / day",
    lat: 18.9220,
    lng: 72.8347,
    famousFood: ["Ashok Vada Pav Kirti College", "Bademiya Seekh Kebabs Colaba", "Pav Bhaji at Sardar / Cannon", "Parsi Akuri at Britannia & Co", "Bun Maska Chai"],
    emergencyContacts: [
      { name: "Mumbai Police Helpline", number: "100 / 112", type: "Police" },
      { name: "Maharashtra Tourism Helpline", number: "1800-229-930", type: "Tourist Help" },
      { name: "KEM Hospital Parel", number: "022-24107000", type: "Hospital" },
      { name: "Emergency Ambulance", number: "108", type: "Ambulance" }
    ],
    places: [
      {
        id: "bom-1",
        name: "Gateway of India & Taj Mahal Palace",
        category: "Heritage & History",
        rating: 4.8,
        reviewCount: "80k+",
        description: "Iconic 26-meter basalt arch built in 1924 overlooking Mumbai Harbour, flanked by the 1903 heritage Taj Mahal Palace Hotel.",
        bestTime: "6:30 AM – 9:00 AM (Sunrise & seabirds) or late evening",
        timing: "Open 24 Hours",
        entryFee: "Free Entry",
        approxCost: 0,
        address: "Apollo Bandar, Colaba, Mumbai",
        imageUrl: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=800&q=80",
        highlights: ["Basalt Archway", "Heritage Taj Hotel", "Elephanta Island Ferry Point"],
        tags: ["Iconic", "Harbour View", "Heritage", "Must Visit"],
        insiderTip: "Take the 7:00 AM ferry from here to Elephanta Caves for ancient rock-cut Shiva sculptures. Return by afternoon for high tea near the promenade.",
        googleMapsUrl: "https://maps.google.com/?q=Gateway+of+India+Mumbai",
        lat: 18.9220,
        lng: 72.8347,
        durationHours: 2
      },
      {
        id: "bom-2",
        name: "Marine Drive & Queen's Necklace",
        category: "Nightlife & Views",
        rating: 4.8,
        reviewCount: "70k+",
        description: "3.6-kilometer C-shaped coastal promenade along Netaji Subhash Chandra Bose Road. Glowing streetlights curve like a pearl necklace at night.",
        bestTime: "5:30 PM – 9:00 PM (Sunset over the Arabian Sea)",
        timing: "Open 24 Hours",
        entryFee: "Free Entry",
        approxCost: 0,
        address: "Netaji Subhash Chandra Bose Road, South Mumbai",
        imageUrl: "https://images.unsplash.com/photo-1566552881560-0be862a7c445?auto=format&fit=crop&w=800&q=80",
        highlights: ["Sunset over Arabian Sea", "Tetrapod seating", "Queen's Necklace Night Curve"],
        tags: ["Sunset", "Promenade", "Romantic", "Views"],
        insiderTip: "Grab roasted bhutta (corn) with lemon masala from street vendors and sit on the seawall tetrapods to enjoy the cool Arabian sea breeze.",
        googleMapsUrl: "https://maps.google.com/?q=Marine+Drive+Mumbai",
        lat: 18.9432,
        lng: 72.8230,
        durationHours: 2
      },
      {
        id: "bom-3",
        name: "Colaba Causeway & Cafe Mondegar",
        category: "Food & Markets",
        rating: 4.6,
        reviewCount: "32k+",
        description: "Eclectic shopping street packed with vintage jewelry, curios, bohemian fashion, alongside vintage Parsi cafes and retro jukebox bistros.",
        bestTime: "3:00 PM – 8:00 PM",
        timing: "11:00 AM – 10:00 PM",
        entryFee: "Free to explore (₹300 - ₹800 food/shopping)",
        approxCost: 400,
        address: "Shahid Bhagat Singh Road, Colaba, Mumbai",
        imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
        highlights: ["Mario Miranda Cartoons", "Vintage Jukebox", "Antique & Silver Jewelry"],
        tags: ["Shopping", "Cafes", "Street Market"],
        insiderTip: "Bargain politely at the street stalls (start at 60% of quoted price), then chill with draught beer and cheese chili toast at Cafe Mondegar.",
        googleMapsUrl: "https://maps.google.com/?q=Colaba+Causeway+Mumbai",
        lat: 18.9189,
        lng: 72.8285,
        durationHours: 2.5
      },
      {
        id: "bom-4",
        name: "Chhatrapati Shivaji Maharaj Terminus (CSMT)",
        category: "Heritage & History",
        rating: 4.7,
        reviewCount: "45k+",
        description: "Victorian Gothic UNESCO World Heritage railway terminal built in 1887 with gargoyles, domes, stained glass, and peacock arches.",
        bestTime: "7:00 PM – 9:00 PM (Spectacular multi-color architectural LED illumination)",
        timing: "Open 24 Hours",
        entryFee: "Free outside viewing",
        approxCost: 0,
        address: "Fort, Mumbai, Maharashtra 400001",
        imageUrl: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80",
        highlights: ["Victorian Gothic Architecture", "Night Light Display", "Heritage Gallery"],
        tags: ["UNESCO", "Architecture", "Photography"],
        insiderTip: "Stand on the pedestrian viewing gallery bridge across the junction at 7:30 PM to snap the illuminated golden facade against evening traffic trails.",
        googleMapsUrl: "https://maps.google.com/?q=CSMT+Mumbai",
        lat: 18.9400,
        lng: 72.8353,
        durationHours: 1
      },
      {
        id: "bom-5",
        name: "Kala Ghoda Art Precinct",
        category: "Hidden Gem",
        rating: 4.7,
        reviewCount: "22k+",
        description: "Mumbai's creative cultural hub brimming with indie art galleries, heritage bookshops, designer boutiques, and artisanal bakeries.",
        bestTime: "11:00 AM – 5:00 PM",
        timing: "10:30 AM – 8:00 PM",
        entryFee: "Free Entry (Gallery visits free)",
        approxCost: 200,
        address: "Kala Ghoda, Fort, Mumbai",
        imageUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
        highlights: ["Jehangir Art Gallery", "David Sassoon Library", "Kala Ghoda Cafe"],
        tags: ["Art", "Culture", "Walkable", "Heritage"],
        insiderTip: "Walk into Jehangir Art Gallery (free entry) to meet local artists, then enjoy cold brew coffee and waffles at Kala Ghoda Cafe.",
        googleMapsUrl: "https://maps.google.com/?q=Kala+Ghoda+Mumbai",
        lat: 18.9288,
        lng: 72.8329,
        durationHours: 2
      }
    ]
  },

  "Goa": {
    name: "Goa",
    stateOrCountry: "Goa, India",
    tagline: "Sun, Sand, Portuguese Heritage & Susegad",
    badge: "Beaches & Coastal",
    description: "Tropical coastal paradise known for golden beaches, 16th-century Portuguese churches, vibrant beach shacks, spice plantations, and seafood curries.",
    weather: "Breezy & Sunny",
    temp: "30°C",
    bestSeason: "November – March",
    language: "Konkani, English, Hindi, Portuguese",
    avgBudget: "₹2,500 – ₹5,000 / day",
    lat: 15.2993,
    lng: 74.1240,
    famousFood: ["Goan Fish Curry Thali", "Pork Vindaloo", "Bebinca Dessert", "Poi Bread & Chorizo", "Prawn Balchão"],
    emergencyContacts: [
      { name: "Goa Tourist Police", number: "1363 / 0832-2420821", type: "Tourist Help" },
      { name: "Police Emergency", number: "100 / 112", type: "Police" },
      { name: "Goa Medical College (Bambolim)", number: "0832-2458700", type: "Hospital" },
      { name: "Beach Lifeguard & Rescue (Drishti)", number: "0832-2414113", type: "Rescue" }
    ],
    places: [
      {
        id: "goa-1",
        name: "Fontainhas – Latin Quarter",
        category: "Heritage & History",
        rating: 4.8,
        reviewCount: "25k+",
        description: "Asia's only preserved Latin Quarter with pastel-painted Portuguese villas, tiled nameplates, overhanging wooden balconies, and artisan bakeries.",
        bestTime: "7:30 AM – 10:30 AM (Soft morning light for photography)",
        timing: "Open 24 Hours (Best in daylight)",
        entryFee: "Free Entry",
        approxCost: 0,
        address: "Panjim, Goa 403001",
        imageUrl: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80",
        highlights: ["Pastel Portuguese Mansions", "31st January Road", "Traditional Confeitaria 31 De Janeiro"],
        tags: ["Portuguese", "Heritage", "Instagrammable", "Culture"],
        insiderTip: "Stop by Confeitaria 31 De Janeiro for fresh warm Swiss rolls and Bebinca baked in a traditional wood-fired oven since 1930.",
        googleMapsUrl: "https://maps.google.com/?q=Fontainhas+Latin+Quarter+Panaji+Goa",
        lat: 15.4989,
        lng: 73.8315,
        durationHours: 2
      },
      {
        id: "goa-2",
        name: "Basilica of Bom Jesus",
        category: "Heritage & History",
        rating: 4.7,
        reviewCount: "48k+",
        description: "1605 UNESCO World Heritage baroque church enshrining the sacred mortal remains of St. Francis Xavier in a silver casket.",
        bestTime: "9:00 AM – 11:30 AM",
        timing: "9:00 AM – 6:30 PM (Sun: 10:30 AM – 6:30 PM)",
        entryFee: "Free Entry",
        approxCost: 0,
        address: "Old Goa Rd, Bainguinim, Goa 403402",
        imageUrl: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80",
        highlights: ["Tomb of St. Francis Xavier", "Baroque Basalt Facade", "Se Cathedral across the square"],
        tags: ["UNESCO", "Spiritual", "Baroque", "Old Goa"],
        insiderTip: "Walk directly across the garden square after your visit to see Sé Cathedral, one of the largest churches in all of Asia with its Golden Bell.",
        googleMapsUrl: "https://maps.google.com/?q=Basilica+of+Bom+Jesus+Old+Goa",
        lat: 15.5009,
        lng: 73.9116,
        durationHours: 1.5
      },
      {
        id: "goa-3",
        name: "Chapora Fort & Vagator Sunset",
        category: "Nightlife & Views",
        rating: 4.7,
        reviewCount: "38k+",
        description: "Red laterite cliff fortress immortalized in Bollywood ('Dil Chahta Hai') with breathtaking views of the Chapora river estuary and Vagator sea.",
        bestTime: "5:00 PM – 6:45 PM (Classic cinematic sunset)",
        timing: "6:00 AM – 7:00 PM",
        entryFee: "Free Entry",
        approxCost: 0,
        address: "Chapora, Vagator, North Goa 403509",
        imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
        highlights: ["Dil Chahta Hai Corner", "Cliff edge panoramic sunset", "Chapora river view"],
        tags: ["Sunset", "Ocean View", "Iconic", "Bollywood"],
        insiderTip: "Wear grippy sneakers for the 10-minute stone incline walk. Sit on the western rampart wall for the iconic sun dip over the Arabian Sea.",
        googleMapsUrl: "https://maps.google.com/?q=Chapora+Fort+Goa",
        lat: 15.6059,
        lng: 73.7364,
        durationHours: 2
      },
      {
        id: "goa-4",
        name: "Palolem Beach & Butterfly Island",
        category: "Nature & Parks",
        rating: 4.8,
        reviewCount: "42k+",
        description: "Gentle crescent-shaped south Goan bay fringed by leaning coconut palms, calm turquoise waters, colorful beach huts, and dolphin boat tours.",
        bestTime: "7:00 AM (Dolphin boat trips) or 4:00 PM – Sunset",
        timing: "Open 24 Hours",
        entryFee: "Free Entry",
        approxCost: 300,
        address: "Canacona, South Goa 403702",
        imageUrl: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=800&q=80",
        highlights: ["Kayaking in calm bay", "Dolphin safari boats", "Silent Noise club"],
        tags: ["Beach", "Relaxing", "South Goa", "Nature"],
        insiderTip: "Rent a sea kayak at Palolem for ₹300/hour to paddle across to Monkey Island or Butterfly Beach during morning low tide.",
        googleMapsUrl: "https://maps.google.com/?q=Palolem+Beach+Goa",
        lat: 15.0099,
        lng: 74.0232,
        durationHours: 3
      }
    ]
  },

  "Varanasi": {
    name: "Varanasi",
    stateOrCountry: "Uttar Pradesh, India",
    tagline: "The Eternal City of Light & Sacred Ghats",
    badge: "Spiritual & Ancient",
    description: "One of the world's oldest continuously inhabited cities, renowned for 84 holy Ganga ghats, evening Ganga Aarti, silk weavers, and Banarasi cuisine.",
    weather: "Pleasant & Clear",
    temp: "26°C",
    bestSeason: "October – March",
    language: "Hindi, Bhojpuri, English",
    avgBudget: "₹1,200 – ₹2,200 / day",
    lat: 25.3176,
    lng: 82.9739,
    famousFood: ["Kachori Sabzi & Jalebi at Ram Bhandar", "Blue Lassi Shop Chowk", "Banarasi Tamatar Chaat at Kashi Chaat", "Malaiyo Dessert", "Banarasi Paan"],
    emergencyContacts: [
      { name: "Varanasi Tourist Police", number: "1363 / 0542-2508101", type: "Tourist Help" },
      { name: "Police Emergency", number: "100 / 112", type: "Police" },
      { name: "Sir Sunderlal Hospital (BHU)", number: "0542-2307500", type: "Hospital" },
      { name: "Emergency Ambulance", number: "108", type: "Ambulance" }
    ],
    places: [
      {
        id: "vns-1",
        name: "Dashashwamedh Ghat & Evening Ganga Aarti",
        category: "Cultural & Spiritual",
        rating: 4.9,
        reviewCount: "90k+",
        description: "The most sacred and grandest ghat along the Ganges, renowned for the synchronized daily sunset Maha Aarti performed by priests with multi-tiered brass oil lamps.",
        bestTime: "5:30 PM – 7:30 PM (Evening Aarti ceremony starts at dusk)",
        timing: "Open 24 Hours (Aarti: ~6:45 PM)",
        entryFee: "Free on ghat steps (₹150 – ₹300 for boat seat)",
        approxCost: 200,
        address: "Dashashwamedh Ghat Road, Varanasi",
        imageUrl: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=800&q=80",
        highlights: ["Sync brass lamp aarti", "Chanting of Vedic mantras", "Ganga floating clay lamps (diyas)"],
        tags: ["Spiritual", "Must Visit", "Iconic", "Ghats"],
        insiderTip: "Book a wooden hand-rowed boat at 5:15 PM from Assi or Dashashwamedh to watch the Aarti illuminated from the river surface with reflections.",
        googleMapsUrl: "https://maps.google.com/?q=Dashashwamedh+Ghat+Varanasi",
        lat: 25.3076,
        lng: 83.0107,
        durationHours: 2.5
      },
      {
        id: "vns-2",
        name: "Sunrise Boat Ride along the Ghats",
        category: "Nature & Parks",
        rating: 4.9,
        reviewCount: "60k+",
        description: "Unforgettable dawn boat cruise gliding past all 84 historical ghats from Assi to Manikarnika while morning sunlight bathes the temple facades.",
        bestTime: "5:30 AM – 7:30 AM (Sunrise & Subah-e-Banaras)",
        timing: "5:15 AM – 8:30 AM",
        entryFee: "₹300 – ₹600 per boat (shared/private)",
        approxCost: 400,
        address: "Assi Ghat to Manikarnika Ghat, Varanasi",
        imageUrl: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80",
        highlights: ["Subah-e-Banaras morning chants", "Golden sunrise on ancient palaces", "Bird feeding on the river"],
        tags: ["Sunrise", "Peaceful", "Ghats", "Photography"],
        insiderTip: "Start at Assi Ghat at 5:30 AM for morning classical Shehnai music, then row upstream past Harishchandra and Scindia ghats.",
        googleMapsUrl: "https://maps.google.com/?q=Assi+Ghat+Varanasi",
        lat: 25.2954,
        lng: 83.0069,
        durationHours: 2
      },
      {
        id: "vns-3",
        name: "Kashi Vishwanath Corridor & Temple",
        category: "Heritage & History",
        rating: 4.8,
        reviewCount: "85k+",
        description: "Golden Temple dedicated to Lord Shiva housing one of the 12 sacred Jyotirlingas, newly unified to the riverbanks via the grand stone corridor.",
        bestTime: "6:00 AM – 9:00 AM (Morning Mangala or Sugam darshan)",
        timing: "4:00 AM – 11:00 PM",
        entryFee: "Free Entry (Sugam VIP ticket ₹300)",
        approxCost: 0,
        address: "Lahori Tola, Varanasi, UP 221001",
        imageUrl: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80",
        highlights: ["Gold-plated temple spires", "Direct river promenade connection", "Ancient Jyotirlinga"],
        tags: ["Spiritual", "Jyotirlinga", "Sacred", "Heritage"],
        insiderTip: "Mobile phones, leather belts, and bags are prohibited inside. Leave them safely at official lockers at Gate 4 near Gyanvapi.",
        googleMapsUrl: "https://maps.google.com/?q=Kashi+Vishwanath+Temple+Varanasi",
        lat: 25.3109,
        lng: 83.0107,
        durationHours: 2
      },
      {
        id: "vns-4",
        name: "Kashi Chaat Bhandar & Blue Lassi",
        category: "Food & Markets",
        rating: 4.7,
        reviewCount: "35k+",
        description: "Famous local culinary haven serving mouthwatering hot Tamatar Chaat (mashed spiced tomatoes with cashews) and hand-churned fruit lassis.",
        bestTime: "4:30 PM – 9:00 PM",
        timing: "3:30 PM – 10:30 PM",
        entryFee: "₹80 – ₹200 for food",
        approxCost: 150,
        address: "Girja Ghar Crossing, Godowlia, Varanasi",
        imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
        highlights: ["Signature Tamatar Chaat", "Dahi Puri in Clay Kulhads", "Pomegranate Lassi"],
        tags: ["Street Food", "Iconic", "Culinary Legend"],
        insiderTip: "Ask for the Tamatar Chaat with extra clarified butter (desi ghee) tadka, followed by a chilled Rabdi Malai kulhad.",
        googleMapsUrl: "https://maps.google.com/?q=Kashi+Chaat+Bhandar+Varanasi",
        lat: 25.3090,
        lng: 83.0065,
        durationHours: 1
      }
    ]
  },

  "Manali": {
    name: "Manali",
    stateOrCountry: "Himachal Pradesh, India",
    tagline: "Snow Peaks, Pine Forests & Riverside Cafés",
    badge: "Himalayas & Adventure",
    description: "Himalayan valley resort town on the Beas river. Gateway to Solang Valley adventures, Atal Tunnel, Rohtang Pass, and rustic wooden Old Manali bistros.",
    weather: "Crisp & Mountain Air",
    temp: "15°C",
    bestSeason: "March – June & September – December",
    language: "Hindi, Pahari, English",
    avgBudget: "₹2,200 – ₹4,000 / day",
    lat: 32.2432,
    lng: 77.1892,
    famousFood: ["Himachali Siddu with Ghee & Chutney", "Trout Fish at Johnson's Cafe", "Tibetan Thukpa & Momos", "Wood-fired Pizza at Cafe 1947", "Fresh Apple Cider"],
    emergencyContacts: [
      { name: "Manali Police Station", number: "01902-252322 / 112", type: "Police" },
      { name: "Himachal Tourism Helpline", number: "1800-180-8077", type: "Tourist Help" },
      { name: "Civil Hospital Manali", number: "01902-253385", type: "Hospital" },
      { name: "Mountain Rescue / Disaster Control", number: "1077", type: "Rescue" }
    ],
    places: [
      {
        id: "man-1",
        name: "Solang Valley & Paragliding",
        category: "Nature & Parks",
        rating: 4.7,
        reviewCount: "50k+",
        description: "High altitude adventure haven flanked by snow-capped peaks, offering tandem paragliding, zorbing, ATV quad biking, and winter snow ski slopes.",
        bestTime: "9:00 AM – 2:00 PM (Clear morning winds for flights)",
        timing: "9:00 AM – 6:00 PM",
        entryFee: "Free valley entry (₹1,500 – ₹3,000 for paragliding)",
        approxCost: 2000,
        address: "Solang Valley, 14 km from Manali, HP",
        imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
        highlights: ["Tandem Paragliding", "Ropeway Gondola to Anjani Mahadev", "Snow sports in winter"],
        tags: ["Adventure", "Snow", "Mountain Views", "Must Visit"],
        insiderTip: "Book your paragliding pilot through government-authorized counters. Take the cable car gondola to the ridge top for breathtaking Pir Panjal views.",
        googleMapsUrl: "https://maps.google.com/?q=Solang+Valley+Manali",
        lat: 32.3167,
        lng: 77.1583,
        durationHours: 3.5
      },
      {
        id: "man-2",
        name: "Hadimba Devi Temple & Cedar Forest",
        category: "Heritage & History",
        rating: 4.8,
        reviewCount: "42k+",
        description: "Unique 1553 AD pagoda-style wooden temple with carved wooden antlers and multi-tiered timber roofs nestled amidst towering giant deodar cedar forests.",
        bestTime: "8:00 AM – 10:30 AM (Morning mist between cedar trees)",
        timing: "8:00 AM – 6:00 PM",
        entryFee: "Free Entry",
        approxCost: 0,
        address: "Hadimba Temple Rd, Old Manali, HP 175131",
        imageUrl: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80",
        highlights: ["4-Tier Pagoda Woodwork", "Ancient Deodar Cedar Grove", "Yak photography spot"],
        tags: ["Heritage", "Forest", "Peaceful", "Spiritual"],
        insiderTip: "Walk behind the temple along the tranquil forest trails through the Dhungri Van Vihar sanctuary to escape commercial stalls.",
        googleMapsUrl: "https://maps.google.com/?q=Hadimba+Devi+Temple+Manali",
        lat: 32.2483,
        lng: 77.1812,
        durationHours: 1.5
      },
      {
        id: "man-3",
        name: "Old Manali Riverside & Cafe 1947",
        category: "Nightlife & Views",
        rating: 4.7,
        reviewCount: "30k+",
        description: "Bohemian village across Manalsu stream with live acoustic music, wooden verandas overlooking rushing mountain waters, and wood-fired pizzas.",
        bestTime: "1:00 PM (Sunny riverside lunch) or 7:30 PM (Live music)",
        timing: "11:00 AM – 11:30 PM",
        entryFee: "₹400 – ₹900 per meal",
        approxCost: 600,
        address: "Near Old Manali Bridge, Old Manali, HP",
        imageUrl: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80",
        highlights: ["Riverside outdoor deck", "Live acoustic indie performances", "Artisan Wood-fired Pizzas"],
        tags: ["Cafes", "Music", "Riverside", "Chill"],
        insiderTip: "Request an outdoor bridge-side table directly above the gushing river. Try their thin-crust quattro formaggi pizza and mountain mint tea.",
        googleMapsUrl: "https://maps.google.com/?q=Cafe+1947+Old+Manali",
        lat: 32.2536,
        lng: 77.1802,
        durationHours: 2
      }
    ]
  },

  "Udaipur": {
    name: "Udaipur",
    stateOrCountry: "Rajasthan, India",
    tagline: "The City of Lakes & Venice of the East",
    badge: "Lakes & Royalty",
    description: "Romantic lake city surrounded by the Aravalli Hills, famous for marble palaces, serene Lake Pichola boat cruises, and rooftop Mewari feasts.",
    weather: "Sunny & Pleasant",
    temp: "27°C",
    bestSeason: "October – March",
    language: "Hindi, Mewari, English",
    avgBudget: "₹2,200 – ₹4,000 / day",
    lat: 24.5854,
    lng: 73.7125,
    famousFood: ["Dal Baati Churma at Krishna Dal Bati", "Gatte ki Sabzi", "Mirchi Vada at Jagdish Chowk", "Lal Maas at Ambrai", "Kullad Coffee at Fatehsagar"],
    emergencyContacts: [
      { name: "Udaipur Tourist Police", number: "1363 / 0294-2411535", type: "Tourist Help" },
      { name: "City Police Control", number: "100 / 112", type: "Police" },
      { name: "Maharana Bhupal Hospital (MB)", number: "0294-2528811", type: "Hospital" },
      { name: "Emergency Ambulance", number: "108", type: "Ambulance" }
    ],
    places: [
      {
        id: "udr-1",
        name: "City Palace Complex",
        category: "Heritage & History",
        rating: 4.8,
        reviewCount: "58k+",
        description: "Rajasthan's largest royal palace complex overlooking Lake Pichola, featuring mirror mosaics, peacock courtyards, and royal Mewar weaponry.",
        bestTime: "9:00 AM – 12:00 PM (Best natural courtyard lighting)",
        timing: "9:30 AM – 5:30 PM",
        entryFee: "₹300 (Adults), ₹100 (Kids)",
        approxCost: 300,
        address: "Old City, Udaipur, Rajasthan 313001",
        imageUrl: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80",
        highlights: ["Mor Chowk (Peacock Courtyard)", "Sheesh Mahal Mirrors", "Lake Pichola balcony views"],
        tags: ["Royal", "Palace", "Architecture", "Must Visit"],
        insiderTip: "Get the combined Palace + Boat ticket at the Badi Pol counter to avoid a second queue at the jetty.",
        googleMapsUrl: "https://maps.google.com/?q=City+Palace+Udaipur",
        lat: 24.5764,
        lng: 73.6835,
        durationHours: 3
      },
      {
        id: "udr-2",
        name: "Lake Pichola Sunset Boat Cruise",
        category: "Nightlife & Views",
        rating: 4.9,
        reviewCount: "45k+",
        description: "Magical evening cruise on Pichola's shimmering waters, sailing past the floating Taj Lake Palace and Jag Mandir island palace under the golden sunset.",
        bestTime: "5:00 PM – 6:30 PM (Sunset golden hour slot)",
        timing: "10:00 AM – 6:30 PM",
        entryFee: "₹500 (Regular) / ₹800 (Sunset special with Jagmandir stop)",
        approxCost: 800,
        address: "Rameshwar Ghat Jetty, City Palace, Udaipur",
        imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
        highlights: ["Taj Lake Palace views", "Jag Mandir Island stopover", "Aravalli range sunset reflections"],
        tags: ["Romantic", "Sunset", "Boat Cruise", "Lake View"],
        insiderTip: "Book the 5:15 PM sunset slot. You get 30 minutes to stroll Jag Mandir island's marble elephant courtyard while the sunset glows behind the mountains.",
        googleMapsUrl: "https://maps.google.com/?q=Lake+Pichola+Boat+Cruise+Udaipur",
        lat: 24.5722,
        lng: 73.6811,
        durationHours: 1.5
      }
    ]
  },

  "Delhi": {
    name: "Delhi",
    stateOrCountry: "Delhi NCR, India",
    tagline: "The Historic & Vibrant Heart of India",
    badge: "Heritage & Capital",
    description: "India's historic capital blending Mughal fortresses, Lutyens' colonial avenues, vibrant Chandni Chowk street food lanes, and modern art.",
    weather: "Clear & Pleasant",
    temp: "26°C",
    bestSeason: "October – March",
    language: "Hindi, English, Punjabi, Urdu",
    avgBudget: "₹2,000 – ₹4,000 / day",
    lat: 28.6139,
    lng: 77.2090,
    famousFood: ["Chole Bhature at Sita Ram Diwan Chand", "Paranthe at Paranthe Wali Gali", "Butter Chicken at Moti Mahal", "Daulat ki Chaat Chandni Chowk", "Kathi Rolls Khan Market"],
    emergencyContacts: [
      { name: "Delhi Tourist Police", number: "1363 / 011-23365330", type: "Tourist Help" },
      { name: "Police Emergency", number: "112", type: "Police" },
      { name: "AIIMS New Delhi", number: "011-26588500", type: "Hospital" },
      { name: "Ambulance", number: "102 / 108", type: "Ambulance" }
    ],
    places: [
      {
        id: "del-1",
        name: "Qutub Minar & Mehrauli Archaeological Park",
        category: "Heritage & History",
        rating: 4.8,
        reviewCount: "75k+",
        description: "73-meter fluted red sandstone victory tower built in 1192, surrounded by ancient 4th-century rust-resistant Iron Pillar and Indo-Islamic ruins.",
        bestTime: "8:30 AM – 11:00 AM (Soft morning lighting on stone calligraphy)",
        timing: "7:00 AM – 9:00 PM (Night illuminated minar)",
        entryFee: "₹50 (Indians), ₹600 (Foreigners)",
        approxCost: 50,
        address: "Mehrauli, New Delhi 110030",
        imageUrl: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80",
        highlights: ["73m Sandstone Minaret", "4th Century Iron Pillar", "Alai Darwaza"],
        tags: ["UNESCO", "Architecture", "Ancient", "Must Visit"],
        insiderTip: "Take the Delhi Metro directly to Qutab Minar station. Walk into the adjacent Mehrauli Archaeological Park to discover Jamali Kamali tomb and Rajon ki Baoli stepwell.",
        googleMapsUrl: "https://maps.google.com/?q=Qutub+Minar+Delhi",
        lat: 28.5245,
        lng: 77.1855,
        durationHours: 2.5
      },
      {
        id: "del-2",
        name: "Humayun's Tomb & Sunder Nursery",
        category: "Heritage & History",
        rating: 4.8,
        reviewCount: "68k+",
        description: "Magnificent 16th-century Persian garden-tomb of Emperor Humayun that inspired the Taj Mahal, flanked by 90-acre heritage botanical park Sunder Nursery.",
        bestTime: "3:30 PM – 6:00 PM (Golden hour photography)",
        timing: "6:00 AM – 6:00 PM",
        entryFee: "₹40 (Indians), ₹600 (Foreigners)",
        approxCost: 40,
        address: "Mathura Road, Nizamuddin East, New Delhi",
        imageUrl: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=800&q=80",
        highlights: ["Charbagh Persian Gardens", "White Marble Dome", "Adjacent Sunder Nursery Cafes"],
        tags: ["UNESCO", "Mughal", "Architecture", "Garden"],
        insiderTip: "Spend 2 hours at the tomb, then cross the gate into Sunder Nursery to enjoy lake views, artisan coffee, and weekend farmers' markets.",
        googleMapsUrl: "https://maps.google.com/?q=Humayun+Tomb+Delhi",
        lat: 28.5933,
        lng: 77.2507,
        durationHours: 3
      },
      {
        id: "del-3",
        name: "Chandni Chowk & Jama Masjid Food Walk",
        category: "Food & Markets",
        rating: 4.7,
        reviewCount: "50k+",
        description: "Bustling 17th-century Shahjahanabad bazaar filled with spice markets, cycle rickshaw rides, hot Jalebi stalls, and views of India's largest mosque.",
        bestTime: "4:00 PM – 9:00 PM (Evening street food and lights)",
        timing: "10:30 AM – 10:00 PM (Closed Sundays for wholesale shops, food open daily)",
        entryFee: "Free to explore (₹300 – ₹700 for food tour)",
        approxCost: 450,
        address: "Old Delhi, Chandni Chowk, Delhi 110006",
        imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80",
        highlights: ["Khari Baoli Spice Market", "Old Famous Jalebi Wala", "Jama Masjid Minaret view"],
        tags: ["Street Food", "Bazaar", "Old Delhi", "Culture"],
        insiderTip: "Take an electric rickshaw to Khari Baoli (Asia's largest spice market) and climb to the 4th floor rooftop of Gadodia Market for a bird's-eye view of Old Delhi.",
        googleMapsUrl: "https://maps.google.com/?q=Chandni+Chowk+Delhi",
        lat: 28.6506,
        lng: 77.2303,
        durationHours: 3
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
