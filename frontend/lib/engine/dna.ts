import type { DNATraits, Interest, Pace, TravelDNA } from "@/types";

export type TraitKey = keyof DNATraits;
type Delta = Partial<Record<TraitKey, number>> & { pace?: Pace; rhythm?: "early-bird" | "night-owl" };

export interface QuizOption {
  id: string;
  label: string;
  emoji: string;
  hint?: string;
  tone: "pink" | "lavender" | "mint" | "sun" | "sky" | "coral" | "cream";
  delta: Delta;
}

export type QuizQuestion =
  | { id: string; kind: "single"; title: string; subtitle?: string; options: QuizOption[] }
  | { id: string; kind: "multi"; title: string; subtitle?: string; max: number; options: QuizOption[] }
  | { id: string; kind: "slider"; title: string; subtitle?: string; trait: TraitKey; left: string; right: string; emojiLeft: string; emojiRight: string };

export const QUIZ: QuizQuestion[] = [
  {
    id: "morning",
    kind: "single",
    title: "Your perfect holiday morning?",
    subtitle: "Go with your gut.",
    options: [
      { id: "trek", label: "Sunrise trek", emoji: "🥾", tone: "mint", delta: { adventure: 18, nature: 20, rhythm: "early-bird" } },
      { id: "view", label: "Slow breakfast with a view", emoji: "☕", tone: "sky", delta: { luxury: 14, nature: 8 } },
      { id: "market", label: "Wander a local market", emoji: "🧺", tone: "sun", delta: { culture: 16, food: 14, social: 8 } },
      { id: "sleep", label: "Sleep in, obviously", emoji: "😴", tone: "lavender", delta: { luxury: 10, rhythm: "night-owl" } },
    ],
  },
  {
    id: "view",
    kind: "single",
    title: "Pick a view to wake up to",
    options: [
      { id: "peaks", label: "Snow peaks & pine forest", emoji: "🏔️", tone: "sky", delta: { nature: 22, adventure: 10 } },
      { id: "palace", label: "A palace courtyard", emoji: "🏰", tone: "pink", delta: { culture: 20, luxury: 12 } },
      { id: "sea", label: "Turquoise sea", emoji: "🏝️", tone: "mint", delta: { nature: 12, luxury: 8, social: 6 } },
      { id: "street", label: "A buzzing food street", emoji: "🍜", tone: "sun", delta: { food: 22, social: 12 } },
    ],
  },
  {
    id: "thrill",
    kind: "slider",
    title: "Paragliding, rapids, ziplines…",
    subtitle: "How much adrenaline do you want?",
    trait: "adventure",
    left: "Keep my feet on the ground",
    right: "Throw me off a cliff",
    emojiLeft: "🧘",
    emojiRight: "🪂",
  },
  {
    id: "food",
    kind: "single",
    title: "Food on a trip is…",
    options: [
      { id: "fuel", label: "Just fuel", emoji: "⛽", tone: "cream", delta: { food: 2 } },
      { id: "half", label: "Half the reason I travel", emoji: "🤤", tone: "sun", delta: { food: 26 } },
      { id: "locals", label: "Only where locals eat", emoji: "🍛", tone: "coral", delta: { food: 20, culture: 10 } },
      { id: "fine", label: "Fine dining, please", emoji: "🍷", tone: "pink", delta: { food: 16, luxury: 18 } },
    ],
  },
  {
    id: "pace",
    kind: "single",
    title: "How full should each day be?",
    options: [
      { id: "slow", label: "Slow & easy", emoji: "🐢", hint: "2 things a day", tone: "mint", delta: { pace: "relaxed", luxury: 4 } },
      { id: "balanced", label: "Balanced", emoji: "⚖️", hint: "3 things + evenings", tone: "sky", delta: { pace: "balanced" } },
      { id: "packed", label: "Pack it all in", emoji: "🚀", hint: "4+ things a day", tone: "coral", delta: { pace: "packed", adventure: 8 } },
    ],
  },
  {
    id: "crew",
    kind: "single",
    title: "Your travel crew energy",
    options: [
      { id: "quiet", label: "Quiet, just us", emoji: "🤫", tone: "lavender", delta: { social: 4, nature: 6 } },
      { id: "meet", label: "Meet other travellers", emoji: "👋", tone: "sun", delta: { social: 20 } },
      { id: "party", label: "Big group fun", emoji: "🎉", tone: "pink", delta: { social: 30 } },
    ],
  },
  {
    id: "sleep",
    kind: "single",
    title: "Where do you sleep best?",
    options: [
      { id: "hostel", label: "Hostel with a bonfire", emoji: "🔥", tone: "coral", delta: { social: 14, luxury: 0 } },
      { id: "homestay", label: "Homestay with a family", emoji: "🏡", tone: "mint", delta: { culture: 12, food: 6 } },
      { id: "boutique", label: "Boutique with character", emoji: "🛋️", tone: "lavender", delta: { luxury: 14 } },
      { id: "palace", label: "Palace or 5-star", emoji: "👑", tone: "pink", delta: { luxury: 30 } },
    ],
  },
  {
    id: "culture",
    kind: "slider",
    title: "Forts, temples & old stories",
    subtitle: "How much history do you want?",
    trait: "culture",
    left: "A quick photo is enough",
    right: "Give me the audio guide",
    emojiLeft: "📸",
    emojiRight: "🏛️",
  },
  {
    id: "evening",
    kind: "multi",
    title: "Evenings are for…",
    subtitle: "Pick up to 2",
    max: 2,
    options: [
      { id: "music", label: "Live music", emoji: "🎸", tone: "pink", delta: { social: 12 } },
      { id: "stars", label: "Stargazing", emoji: "🌌", tone: "lavender", delta: { nature: 12 } },
      { id: "night-market", label: "Night markets", emoji: "🏮", tone: "sun", delta: { food: 10, culture: 6 } },
      { id: "early", label: "An early night", emoji: "🛌", tone: "sky", delta: { rhythm: "early-bird" } },
      { id: "rooftop", label: "Rooftop dinners", emoji: "🌇", tone: "coral", delta: { luxury: 10, food: 8 } },
    ],
  },
  {
    id: "never-skip",
    kind: "multi",
    title: "Things you'd never skip",
    subtitle: "Pick up to 3",
    max: 3,
    options: [
      { id: "wild", label: "Nature walks", emoji: "🌿", tone: "mint", delta: { nature: 14 } },
      { id: "museum", label: "Museums", emoji: "🏺", tone: "lavender", delta: { culture: 14 } },
      { id: "sport", label: "Adventure sports", emoji: "🛶", tone: "coral", delta: { adventure: 16 } },
      { id: "cook", label: "Cooking class", emoji: "👩‍🍳", tone: "sun", delta: { food: 14, culture: 4 } },
      { id: "spa", label: "Spa day", emoji: "💆", tone: "pink", delta: { luxury: 14 } },
      { id: "festival", label: "Local festivals", emoji: "🪔", tone: "cream", delta: { social: 10, culture: 8 } },
    ],
  },
];

export type QuizAnswers = Record<string, string | string[] | number>;

const NAMES: { keys: [TraitKey, TraitKey]; name: string; emoji: string }[] = [
  { keys: ["adventure", "nature"], name: "Summit Seeker", emoji: "🏔️" },
  { keys: ["culture", "food"], name: "Heritage Foodie", emoji: "🍛" },
  { keys: ["food", "social"], name: "Street Food Hunter", emoji: "🌶️" },
  { keys: ["luxury", "culture"], name: "Palace Hopper", emoji: "👑" },
  { keys: ["nature", "culture"], name: "Quiet Explorer", emoji: "🧭" },
  { keys: ["adventure", "social"], name: "Thrill Tribe Leader", emoji: "🪂" },
  { keys: ["nature", "food"], name: "Orchard Wanderer", emoji: "🍎" },
  { keys: ["luxury", "nature"], name: "Slow Luxe Wanderer", emoji: "🛶" },
  { keys: ["adventure", "culture"], name: "Trail Historian", emoji: "🗺️" },
  { keys: ["social", "culture"], name: "Festival Chaser", emoji: "🪔" },
  { keys: ["luxury", "food"], name: "Gourmet Nomad", emoji: "🍷" },
  { keys: ["adventure", "food"], name: "Adrenaline Gourmand", emoji: "🔥" },
];

const TRAIT_LABEL: Record<TraitKey, string> = {
  adventure: "adventure",
  nature: "nature",
  culture: "culture & history",
  food: "food",
  luxury: "comfort",
  social: "meeting people",
};

export function computeDNA(answers: QuizAnswers): TravelDNA {
  const t: DNATraits = { adventure: 30, nature: 30, culture: 30, food: 30, luxury: 20, social: 25 };
  let pace: Pace = "balanced";
  let rhythm: "early-bird" | "night-owl" = "early-bird";
  const apply = (d: Delta) => {
    for (const k of Object.keys(t) as TraitKey[]) t[k] += d[k] ?? 0;
    if (d.pace) pace = d.pace;
    if (d.rhythm) rhythm = d.rhythm;
  };
  for (const q of QUIZ) {
    const a = answers[q.id];
    if (a == null) continue;
    if (q.kind === "slider" && typeof a === "number") t[q.trait] += Math.round((a - 50) * 0.8);
    if (q.kind === "single" && typeof a === "string") {
      const opt = q.options.find((o) => o.id === a);
      if (opt) apply(opt.delta);
    }
    if (q.kind === "multi" && Array.isArray(a)) {
      for (const id of a) {
        const opt = q.options.find((o) => o.id === id);
        if (opt) apply(opt.delta);
      }
    }
  }
  for (const k of Object.keys(t) as TraitKey[]) t[k] = Math.max(5, Math.min(98, Math.round(t[k])));
  return describeDNA(t, pace, rhythm);
}

export function describeDNA(t: DNATraits, pace: Pace, rhythm: "early-bird" | "night-owl"): TravelDNA {
  const sorted = (Object.keys(t) as TraitKey[]).sort((a, b) => t[b] - t[a]);
  const [a, b] = sorted;
  const match = NAMES.find((n) => (n.keys[0] === a && n.keys[1] === b) || (n.keys[0] === b && n.keys[1] === a)) ??
    NAMES.find((n) => n.keys.includes(a)) ?? { name: "Curious Nomad", emoji: "🧳" };
  const low = sorted[sorted.length - 1];
  const summary = `You travel for ${TRAIT_LABEL[a]} and ${TRAIT_LABEL[b]}, at a ${pace} pace${
    rhythm === "early-bird" ? " that starts early" : " that starts late and ends later"
  }. We'll go easy on ${TRAIT_LABEL[low]} and fill your days with places that feel like you.`;
  return { traits: t, name: match.name, emoji: match.emoji, summary, pace, rhythm };
}

export function dnaToInterests(dna: TravelDNA): Interest[] {
  const map: Record<TraitKey, Interest> = {
    adventure: "adventure",
    nature: "nature",
    culture: "culture",
    food: "food",
    luxury: "luxury",
    social: "social",
  };
  return (Object.keys(dna.traits) as TraitKey[])
    .sort((a, b) => dna.traits[b] - dna.traits[a])
    .slice(0, 3)
    .map((k) => map[k]);
}

export function dnaFromInterests(interests: Interest[], pace: Pace, rhythm: "early-bird" | "night-owl"): TravelDNA {
  const t: DNATraits = { adventure: 30, nature: 30, culture: 30, food: 30, luxury: 20, social: 25 };
  const bump: Partial<Record<Interest, TraitKey>> = { adventure: "adventure", nature: "nature", culture: "culture", food: "food", luxury: "luxury", social: "social", relax: "luxury", photo: "nature" };
  interests.forEach((i, idx) => {
    const k = bump[i];
    if (k) t[k] = Math.min(95, t[k] + 45 - idx * 6);
  });
  return describeDNA(t, pace, rhythm);
}

export const TRAIT_META: { key: TraitKey; label: string; color: string }[] = [
  { key: "adventure", label: "Adventure", color: "var(--color-coral)" },
  { key: "nature", label: "Nature", color: "var(--color-mint-deep)" },
  { key: "culture", label: "Culture", color: "var(--color-purple)" },
  { key: "food", label: "Food", color: "var(--color-sun-deep)" },
  { key: "luxury", label: "Luxury", color: "var(--color-pink-deep)" },
  { key: "social", label: "Social", color: "var(--color-sky-deep)" },
];
