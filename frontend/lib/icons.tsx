import type { Icon, IconProps } from "@phosphor-icons/react";
import {
  AirplaneTiltIcon,
  BarricadeIcon,
  ProhibitIcon,
  WarningIcon,
  BackpackIcon,
  BusIcon,
  CarIcon,
  CloudRainIcon,
  CurrencyInrIcon,
  DnaIcon as DnaGlyph,
  HeartIcon,
  MapPinIcon,
  MapTrifoldIcon,
  PencilSimpleIcon,
  PersonSimpleRunIcon,
  ShieldCheckIcon,
  SmileyMehIcon,
  SparkleIcon,
  SuitcaseIcon,
  SunHorizonIcon,
  TargetIcon,
  TrainIcon,
  UsersIcon,
  UsersThreeIcon,
  ArmchairIcon,
  BankIcon,
  BasketIcon,
  BedIcon,
  BoatIcon,
  BowlSteamIcon,
  BuildingsIcon,
  CampfireIcon,
  CastleTurretIcon,
  ChefHatIcon,
  CoffeeIcon,
  CompassIcon,
  ConfettiIcon,
  CrownIcon,
  FireIcon,
  FlowerLotusIcon,
  ForkKnifeIcon,
  GasPumpIcon,
  GuitarIcon,
  HandWavingIcon,
  HouseLineIcon,
  IslandIcon,
  LeafIcon,
  MoonIcon,
  MoonStarsIcon,
  MountainsIcon,
  ParachuteIcon,
  PersonSimpleTaiChiIcon,
  RocketLaunchIcon,
  ScalesIcon,
  SneakerMoveIcon,
  SpeakerSimpleSlashIcon,
  StorefrontIcon,
  TreeIcon,
  WineIcon,
  CameraIcon,
  PersonSimpleWalkIcon,
} from "@phosphor-icons/react";

// Icons for the Travel DNA quiz, keyed by option id (the catalog's emojis are not shown).
export const QUIZ_ICONS: Record<string, Icon> = {
  trek: SneakerMoveIcon, view: CoffeeIcon, market: BasketIcon, sleep: MoonIcon,
  peaks: MountainsIcon, palace: CastleTurretIcon, sea: IslandIcon, street: BowlSteamIcon,
  fuel: GasPumpIcon, half: ForkKnifeIcon, locals: ChefHatIcon, fine: WineIcon,
  slow: PersonSimpleWalkIcon, balanced: ScalesIcon, packed: RocketLaunchIcon,
  quiet: SpeakerSimpleSlashIcon, meet: HandWavingIcon, party: ConfettiIcon,
  hostel: CampfireIcon, homestay: HouseLineIcon, boutique: ArmchairIcon,
  music: GuitarIcon, stars: MoonStarsIcon, "night-market": StorefrontIcon, early: BedIcon, rooftop: BuildingsIcon,
  wild: LeafIcon, museum: BankIcon, sport: BoatIcon, cook: ChefHatIcon, spa: FlowerLotusIcon, festival: FireIcon,
};

// Slider ends, keyed by question id.
export const SLIDER_ICONS: Record<string, [Icon, Icon]> = {
  thrill: [PersonSimpleTaiChiIcon, ParachuteIcon],
  culture: [CameraIcon, BankIcon],
};

// One icon per Travel DNA type (in place of its emoji).
const DNA_ICONS: Record<string, Icon> = {
  "Summit Seeker": MountainsIcon,
  "Heritage Foodie": BowlSteamIcon,
  "Street Food Hunter": ForkKnifeIcon,
  "Palace Hopper": CrownIcon,
  "Quiet Explorer": CompassIcon,
  "Thrill Tribe Leader": ParachuteIcon,
  "Orchard Wanderer": TreeIcon,
  "Slow Luxe Wanderer": FlowerLotusIcon,
  "Trail Historian": CastleTurretIcon,
  "Festival Chaser": ConfettiIcon,
  "Gourmet Nomad": WineIcon,
  "Adrenaline Gourmand": FireIcon,
};

export const dnaIcon = (name?: string): Icon => (name && DNA_ICONS[name]) || CompassIcon;

/** The icon of a Travel DNA type. */
export function DnaIcon({ name, ...props }: IconProps & { name?: string }) {
  const I = (name && DNA_ICONS[name]) || CompassIcon;
  return <I weight="duotone" aria-hidden {...props} />;
}

// Emoji → icon, for data that still carries an emoji (onboarding options, moods, badges, map pins).
const GLYPHS: Record<string, Icon> = {
  "🎒": BackpackIcon, "💑": HeartIcon, "👨‍👩‍👧": UsersThreeIcon, "🧑‍🤝‍🧑": UsersIcon,
  "🛏️": BedIcon, "🏨": BuildingsIcon, "🏡": HouseLineIcon, "🛋️": ArmchairIcon, "👑": CrownIcon,
  "✈️": AirplaneTiltIcon, "✈": AirplaneTiltIcon, "🚆": TrainIcon, "🚌": BusIcon, "🚗": CarIcon,
  "🌿": LeafIcon, "🪂": ParachuteIcon, "🏛️": BankIcon, "🍛": BowlSteamIcon, "✨": SparkleIcon, "🎉": ConfettiIcon,
  "🧘": PersonSimpleTaiChiIcon, "📸": CameraIcon, "🐢": PersonSimpleWalkIcon, "⚖️": ScalesIcon, "🚀": RocketLaunchIcon,
  "🌅": SunHorizonIcon, "🌙": MoonIcon,
  "😴": MoonIcon, "🍴": ForkKnifeIcon, "🌧": CloudRainIcon, "🏃": PersonSimpleRunIcon, "💰": CurrencyInrIcon, "🥱": SmileyMehIcon,
  "🧬": DnaGlyph, "🗺️": MapTrifoldIcon, "❤️": HeartIcon, "❤": HeartIcon, "🧳": SuitcaseIcon, "🛡️": ShieldCheckIcon, "✍️": PencilSimpleIcon,
  "🍽️": ForkKnifeIcon, "🎯": TargetIcon, "📍": MapPinIcon,
  "🚫": ProhibitIcon, "🚧": BarricadeIcon, "👥": UsersIcon, "⚠️": WarningIcon,
};

/** Renders the icon for an emoji carried in data (falls back to a neutral icon, never the emoji). */
export function Glyph({ emoji, ...props }: IconProps & { emoji?: string }) {
  const I = (emoji && GLYPHS[emoji]) || CompassIcon;
  return <I weight="duotone" aria-hidden {...props} />;
}
