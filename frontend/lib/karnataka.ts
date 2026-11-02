import type { DestinationId } from "@/types";

export interface KarnatakaCircuit {
  id: string;
  name: string;
  tagline: string;
  idealDays: number;
  destinations: DestinationId[];
  highlights: string[];
  approxBudgetPerPerson: number;
  coverImage?: string;
  theme: "heritage" | "hills" | "coastal" | "wildlife" | "grand";
}

export interface KarnatakaRegionInfo {
  id: string;
  name: string;
  kannadaName: string;
  tagline: string;
  description: string;
  destinations: DestinationId[];
  bestSeason: string;
  tone: "mint" | "sky" | "sun" | "coral" | "lavender";
}

export const KARNATAKA_REGIONS: Record<string, KarnatakaRegionInfo> = {
  western_ghats: {
    id: "western_ghats",
    name: "Western Ghats & Coffee Country",
    kannadaName: "ಮಲೆನಾಡು (Malenadu)",
    tagline: "Misty peaks, shade-grown coffee & roaring waterfalls",
    description: "The emerald backbone of Karnataka. Lush rainforest ridges, plantation homestays, highest summits, and gentle cloud-covered mornings.",
    destinations: ["coorg", "chikmagalur", "sakleshpur", "jogfalls"],
    bestSeason: "September – May",
    tone: "mint",
  },
  heritage: {
    id: "heritage",
    name: "Heritage & Ancient Empires",
    kannadaName: "ಐತಿಹಾಸಿಕ ತಾಣಗಳು (Aitihasika)",
    tagline: "UNESCO monuments, boulder ruins & Hoysala stone carvings",
    description: "Centuries of royal empires etched in granite and soapstone: the Vijayanagara ruins of Hampi, Chalukya rock caves of Badami, and Hoysala temples.",
    destinations: ["hampi", "badami", "belur-halebidu", "mysuru"],
    bestSeason: "October – March",
    tone: "sun",
  },
  coastal: {
    id: "coastal",
    name: "Karavali Coastal Strip",
    kannadaName: "ಕರಾವಳಿ (Karavali)",
    tagline: "Arabian Sea cliffs, sacred shrines & legendary coastal feast",
    description: "Over 300km of pristine shoreline, cliffside crescent beaches, St. Mary's basalt columns, world-class scuba, and world-renowned coastal cuisine.",
    destinations: ["gokarna", "udupi", "mangalore", "murdeshwar"],
    bestSeason: "October – March",
    tone: "sky",
  },
  wildlife: {
    id: "wildlife",
    name: "Wildlife & Forest Reserves",
    kannadaName: "ಕಾಡು ಮತ್ತು ವನ್ಯಜೀವಿ (Aranya)",
    tagline: "Tiger reserves, elephant herds & Kali river rapids",
    description: "Among Asia's greatest biological hotspots. Nagarhole boat safaris, Bandipur tiger tracking, and Dandeli white water rapids.",
    destinations: ["kabini", "bandipur", "dandeli"],
    bestSeason: "October – May",
    tone: "coral",
  },
  city: {
    id: "city",
    name: "Royal & Modern Capital",
    kannadaName: "ರಾಜಧಾನಿ ಮತ್ತು ಅರಮನೆ (Rajadhani)",
    tagline: "Wadiyar palaces, botanical gardens & craft brewpubs",
    description: "Where Karnataka's royal past meets 21st-century innovation. Mysore Palace illumination, Bangalore's botanical gardens, and world-class craft breweries.",
    destinations: ["bengaluru", "mysuru"],
    bestSeason: "Year-round (Best Sep – Mar)",
    tone: "lavender",
  },
};

export const KARNATAKA_CIRCUITS: KarnatakaCircuit[] = [
  {
    id: "heritage-triangle",
    name: "The UNESCO Heritage Triangle",
    tagline: "Vijayanagara boulders, Chalukya caves & Hoysala stone lace",
    idealDays: 5,
    destinations: ["hampi", "badami", "belur-halebidu"],
    highlights: ["Hampi Stone Chariot", "Badami Rock Caves", "Belur Chennakeshava Bracket Figures"],
    approxBudgetPerPerson: 18000,
    theme: "heritage",
  },
  {
    id: "coffee-clouds",
    name: "Misty Coffee & High Peaks Trail",
    tagline: "Summits, waterfalls & private planter homestays",
    idealDays: 4,
    destinations: ["chikmagalur", "sakleshpur", "coorg"],
    highlights: ["Mullayanagiri Sunrise Peak", "Manjarabad Star Fort", "Coorg Cupping & Abbey Falls"],
    approxBudgetPerPerson: 16500,
    theme: "hills",
  },
  {
    id: "coastal-soul",
    name: "Karavali Coastal & Beach Circuit",
    tagline: "Cliffside sunsets, island basalt rocks & fresh ghee roast",
    idealDays: 5,
    destinations: ["mangalore", "udupi", "murdeshwar", "gokarna"],
    highlights: ["Giri Manja's Seafood", "St. Mary's Island Ferry", "123ft Shiva Statue", "Om Beach Shacks"],
    approxBudgetPerPerson: 17500,
    theme: "coastal",
  },
  {
    id: "wildlife-expedition",
    name: "Royal Safari & Wilderness",
    tagline: "Nagarhole boat safaris, Bandipur tigers & river rapids",
    idealDays: 4,
    destinations: ["mysuru", "kabini", "bandipur"],
    highlights: ["Mysore Palace Night Lights", "Kabini River Boat Safari", "Bandipur Tiger Tracking"],
    approxBudgetPerPerson: 24000,
    theme: "wildlife",
  },
  {
    id: "royal-and-coffee",
    name: "The Classic Karnataka Yatra",
    tagline: "Royal palaces, spice hills & peaceful Tibetan monasteries",
    idealDays: 5,
    destinations: ["bengaluru", "mysuru", "coorg"],
    highlights: ["Bangalore Palace", "Mysore Pak & Silk Market", "Dubare Elephant Camp"],
    approxBudgetPerPerson: 19500,
    theme: "grand",
  },
  {
    id: "grand-karnataka",
    name: "The Grand Karnataka Odyssey",
    tagline: "The complete journey: Palaces, Peaks, Ruins & Coastal Waters",
    idealDays: 10,
    destinations: ["bengaluru", "mysuru", "coorg", "chikmagalur", "hampi", "gokarna"],
    highlights: ["Wadiyar Palaces", "Mullayanagiri Summit", "Hampi Boulder Sunset", "Gokarna Arabian Sea"],
    approxBudgetPerPerson: 38000,
    theme: "grand",
  },
];

