"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRightIcon,
  ChatTextIcon,
  CheckCircleIcon,
  CloudRainIcon,
  HeartIcon,
  LightningIcon,
  MicrophoneIcon,
  RobotIcon,
  ShieldCheckIcon,
  SirenIcon,
  FlaskIcon,
  ArrowsClockwiseIcon,
  TreeStructureIcon,
  SmileyIcon,
  ChatCircleDotsIcon,
  TelegramLogoIcon,
  XCircleIcon,
  PlayIcon,
  CheckIcon,
  CompassIcon,
  SparkleIcon,
  MapTrifoldIcon,
  CurrencyInrIcon,
  TicketIcon,
  BackpackIcon,
  NavigationArrowIcon,
  HandWavingIcon,
  ArrowsSplitIcon,
  FlagIcon,
  StarIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { destinations } from "@/data/destinations";
import { DestinationArt } from "@/components/art/DestinationArt";
import { Zippy } from "@/components/art/Zippy";
import { Button } from "@/components/ui/Button";
import { Stars } from "@/components/ui/primitives";
import { TRAIT_META } from "@/lib/engine/dna";
import { cn, rupees } from "@/lib/format";
import { Burst } from "./Burst";

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Kicker({ children, tone = "bg-sun" }: { children: ReactNode; tone?: string }) {
  return (
    <span className={cn("inline-flex -rotate-1 items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink shadow-pop", tone)}>
      {children}
    </span>
  );
}

export function SectionHead({ kicker, title, body, tone, center = true }: { kicker: string; title: ReactNode; body?: ReactNode; tone?: string; center?: boolean }) {
  return (
    <Reveal className={cn("mb-10 max-w-2xl", center && "mx-auto text-center")}>
      <Kicker tone={tone}>{kicker}</Kicker>
      <h2 className="mt-4 text-balance text-3xl font-extrabold leading-[1.1] text-ink sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-base text-ink-soft sm:text-lg">{body}</p>}
    </Reveal>
  );
}

// ─── Destinations marquee ──────────────────────────────────────────────

export function DestinationStrip() {
  const list = [...destinations, ...destinations];
  return (
    <div className="relative overflow-hidden py-6" aria-label="Destinations">
      <motion.div className="flex w-max gap-4" animate={{ x: ["0%", "-50%"] }} transition={{ duration: 40, ease: "linear", repeat: Infinity }}>
        {list.map((d, i) => (
          <Link key={`${d.id}-${i}`} href={`/discover/${d.id}`} className="group relative h-40 w-60 shrink-0 overflow-hidden rounded-[28px] border-2 border-ink shadow-pop" tabIndex={i >= destinations.length ? -1 : 0}>
            <DestinationArt kind={d.art} className="transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-2xl bg-white/90 px-3 py-1.5 backdrop-blur">
              <span className="font-display text-sm font-bold">{d.name}</span>
              <Stars value={d.rating} size={12} />
            </div>
          </Link>
        ))}
      </motion.div>
    </div>
  );
}

// ─── How it works ──────────────────────────────────────────────────────

const STEPS = [
  { n: "01", title: "Tell us what you love", body: "A 60-second Travel DNA quiz, or just type “quiet places, great food, dad can't walk much”.", Icon: SparkleIcon, tone: "bg-lavender" },
  { n: "02", title: "Get a full plan in seconds", body: "Day-by-day, with times, stays, transport, a map and a live price, not a fixed package.", Icon: MapTrifoldIcon, tone: "bg-sun" },
  { n: "03", title: "Change anything, see the price", body: "Swap, move, compare, heart your must-dos. The budget meter updates as you go.", Icon: CurrencyInrIcon, tone: "bg-mint" },
  { n: "04", title: "Rain? Delay? We fix it", body: "The Trip Fixer Agent re-plans, gets every partner's yes and tells you what changed.", Icon: RobotIcon, tone: "bg-pink" },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHead kicker="How Prayaana works" title={<>Your trip, your way, and it <span className="text-purple">fixes itself</span></>} body="Four steps from “I want mountains” to a trip that survives real life." />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <div className="group h-full rounded-[28px] bg-white p-6 shadow-clay transition-transform duration-300 hover:-translate-y-1.5">
              <div className="flex items-center justify-between">
                <span className={cn("grid h-14 w-14 place-items-center rounded-2xl border-2 border-ink shadow-pop", s.tone)}>
                  <s.Icon size={26} weight="duotone" />
                </span>
                <span className="font-display text-3xl font-extrabold text-ink/10">{s.n}</span>
              </div>
              <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── Personalized planning ─────────────────────────────────────────────

export function Personalization() {
  const values = { adventure: 82, nature: 90, culture: 58, food: 76, luxury: 34, social: 46 };
  const wishes = ["Quiet places", "Great food", "Easy on walking", "Views & photos"];
  return (
    <section id="features" className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
      <div>
        <SectionHead center={false} kicker="Personalized planning" tone="bg-lavender" title="Built from your Travel DNA, not a brochure" body="Six traits, your pace, your morning-or-night rhythm and your own words. Jev Match scores every experience against every wish in under a second." />
        <Reveal className="flex flex-wrap gap-2">
          {wishes.map((w) => (
            <span key={w} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold shadow-clay-sm">
              <CheckCircleIcon size={16} weight="fill" className="text-success" /> {w}
            </span>
          ))}
        </Reveal>
      </div>
      <Reveal delay={0.1}>
        <div className="relative rounded-[36px] border-2 border-ink bg-white p-6 shadow-pop-lg sm:p-8">
          <div className="absolute -right-5 -top-7">
            <Burst text="YOU!" color="#c6b5f6" size={96} rotate={10} />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Your Travel DNA</p>
          <p className="mt-1 font-display text-2xl font-extrabold">Summit Seeker</p>
          <div className="mt-6 space-y-3.5">
            {TRAIT_META.map((t, i) => (
              <div key={t.key} className="grid grid-cols-[88px_1fr_36px] items-center gap-3">
                <span className="text-sm font-semibold">{t.label}</span>
                <div className="h-3.5 overflow-hidden rounded-full bg-ink/5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: t.color }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${values[t.key]}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
                  />
                </div>
                <span className="tabular text-right text-sm font-bold">{values[t.key]}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 rounded-2xl bg-canvas p-4 text-sm text-ink-soft">
            “You travel for nature and adventure, at a balanced pace that starts early. We&apos;ll go easy on luxury and fill your days with places that feel like you.”
          </p>
        </div>
      </Reveal>
    </section>
  );
}

// ─── Dynamic fixing + agent ─────────────────────────────────────────────

const AGENT_STEPS = [
  { label: "Detecting problem", result: "Heavy rain · 92% on Day 2", Icon: CloudRainIcon },
  { label: "Analyzing impact", result: "2 activities affected · ₹7,600 at risk", Icon: TreeStructureIcon },
  { label: "Creating fix plans", result: "3 plans · cheapest, fastest, keep favourites", Icon: ArrowsSplitIcon },
  { label: "Running safety checks", result: "10/10 passed in 0.3 s (Jev + code)", Icon: ShieldCheckIcon },
  { label: "Contacting vendors", result: "Kodagu Eco-Trek Guides said no", Icon: ChatCircleDotsIcon, fail: true },
  { label: "Rolling back", result: "Nothing half-updated · trying next vendor", Icon: ArrowsClockwiseIcon, warn: true },
  { label: "Voice note received", result: "“Haan, kal subah 9 baje” → Confirmed 9:00 AM", Icon: MicrophoneIcon },
  { label: "Trip repaired", result: "All vendors said yes · traveler informed", Icon: CheckCircleIcon, ok: true },
];

export function AgentShowcase() {
  const [played, setPlayed] = useState(0);
  const [running, setRunning] = useState(false);
  const play = () => {
    if (running) return;
    setRunning(true);
    setPlayed(0);
    AGENT_STEPS.forEach((_, i) =>
      setTimeout(() => {
        setPlayed(i + 1);
        if (i === AGENT_STEPS.length - 1) setRunning(false);
      }, 650 * (i + 1)),
    );
  };
  return (
    <section className="relative overflow-hidden bg-ink py-24 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1.2px)", backgroundSize: "22px 22px" }} aria-hidden />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <Kicker tone="bg-coral">Hero feature · Trip Fixer Agent</Kicker>
          <h2 className="mt-5 text-balance text-3xl font-extrabold leading-[1.1] sm:text-5xl">
            A broken trip that <span className="text-sun">fixes itself.</span>
          </h2>
          <p className="mt-5 max-w-lg text-base text-white/75 sm:text-lg">
            When a flight is late, it rains, or a hotel is overbooked, the agent finds everything the change touches, builds 3 fix plans, checks them for safety in half a second and asks every affected vendor immediately. It applies the change only when <b className="text-white">every vendor says yes</b>.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
            {[
              ["3 h → 3 min", "per disruption"],
              ["0", "half-updated trips"],
              ["10/10", "safety checks"],
            ].map(([a, b]) => (
              <div key={a} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                <p className="font-display text-lg font-bold text-sun">{a}</p>
                <p className="text-[11px] text-white/60">{b}</p>
              </div>
            ))}
          </div>
          <Button variant="outline" className="mt-8 bg-sun" onClick={play} icon={<PlayIcon size={16} weight="fill" />}>
            {running ? "Agent working…" : played ? "Play again" : "Watch the agent work"}
          </Button>
        </div>
        <div className="rounded-[32px] border-2 border-white/15 bg-white/[0.04] p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-lavender text-ink">
              <RobotIcon size={18} weight="fill" />
            </span>
            <p className="font-display text-sm font-bold">Trip Fixer Agent · TRZ-2071</p>
            <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold", played === AGENT_STEPS.length ? "bg-success text-white" : running ? "bg-purple text-white" : "bg-white/10")}>
              {played === AGENT_STEPS.length ? "Repaired" : running ? "Live" : "Ready"}
            </span>
          </div>
          <ol className="space-y-2" aria-live="polite">
            {AGENT_STEPS.map((s, i) => {
              const done = i < played;
              const active = running && i === played;
              return (
                <li key={s.label} className={cn("flex items-start gap-3 rounded-2xl p-2.5 transition-all duration-300", done ? "bg-white/[0.06]" : "opacity-40")}>
                  <span
                    className={cn(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full",
                      done ? (s.fail ? "bg-danger" : s.warn ? "bg-warning" : s.ok ? "bg-success" : "bg-purple") : active ? "bg-white/20" : "bg-white/10",
                    )}
                  >
                    {done ? s.fail ? <XCircleIcon size={15} weight="bold" /> : <s.Icon size={15} weight="bold" /> : active ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <s.Icon size={14} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{s.label}</p>
                    {done && <p className="text-xs text-white/65">{s.result}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ─── Impact map + 3 plans preview ─────────────────────────────────────────

export function ImpactPreview() {
  const chain = [
    { t: "Rain on Day 2", s: "Root cause", c: "bg-sky" },
    { t: "Paragliding", s: "Cannot happen", c: "bg-pink" },
    { t: "Lunch timing", s: "Moves", c: "bg-sun" },
    { t: "Ropeway", s: "Cannot happen", c: "bg-pink" },
    { t: "Cab pickup", s: "Moves 9:00 → 9:30", c: "bg-sun" },
  ];
  const plans = [
    { name: "Cheapest", big: rupees(-7100), sub: "refunded · 2 indoor swaps", tone: "bg-mint" },
    { name: "Fastest", big: "Same day", sub: "Plan B backups · 1 cab change", tone: "bg-sky" },
    { name: "Keep favourites", big: "All Must-Dos kept", sub: "paragliding moves to Friday", tone: "bg-pink", star: true },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHead kicker="Dynamic trip fixing" tone="bg-sky" title="See the whole ripple, then pick a fix" body="Every item knows what it depends on. When something breaks we follow the links forward, label what moves, what's at risk and what can't happen, and offer three plans with clear numbers." />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Reveal>
          <div className="h-full rounded-[32px] bg-white p-6 shadow-clay">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Change Impact Map</p>
            <div className="mt-5 flex flex-col gap-2">
              {chain.map((c, i) => (
                <motion.div
                  key={c.t}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 * i }}
                  className="flex items-center gap-3"
                  style={{ paddingLeft: i === 0 ? 0 : 24 }}
                >
                  {i > 0 && <span className="h-6 w-4 border-b-2 border-l-2 border-ink/25" aria-hidden />}
                  <span className={cn("rounded-2xl border-2 border-ink px-3 py-2 text-sm font-bold shadow-pop", c.c)}>{c.t}</span>
                  <span className="text-xs font-semibold text-muted">{c.s}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>
        <div className="grid gap-4">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.1}>
              <div className={cn("relative flex items-center gap-4 rounded-[28px] border-2 border-ink p-5 shadow-pop", p.tone)}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white font-display text-sm font-extrabold">{String.fromCharCode(65 + i)}</span>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider">{p.name}</p>
                  <p className="font-display text-xl font-extrabold">{p.big}</p>
                  <p className="text-xs text-ink-soft">{p.sub}</p>
                </div>
                {p.star && <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold text-white">Recommended</span>}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Instant Coordination ──────────────────────────────────────────

export function WhatsAppSection() {
  const [answer, setAnswer] = useState<null | "yes" | "no" | "voice">(null);
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
      <Reveal className="order-2 lg:order-1">
        <div className="mx-auto max-w-sm rounded-[40px] border-2 border-ink bg-[#e9e3d7] p-3 shadow-pop-lg">
          <div className="flex items-center gap-2 rounded-t-[30px] bg-ink px-4 py-3 text-white">
            <TelegramLogoIcon size={22} weight="fill" className="text-purple" />
            <div>
              <p className="text-sm font-semibold">Prayaana Dispatch</p>
              <p className="text-[10px] text-white/70">Instant channel · verified</p>
            </div>
          </div>
          <div className="space-y-2 rounded-b-[30px] bg-[#efe7dc] p-3" style={{ backgroundImage: "radial-gradient(rgb(0 0 0 / 0.04) 1px, transparent 1px)", backgroundSize: "14px 14px" }}>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white p-3 text-[13px] shadow-sm">
              <p className="font-bold">Change request · TRZ-2071</p>
              <p className="mt-1 text-ink-soft">Traveler: Rahul · 2 guests</p>
              <p className="mt-1">
                <span className="text-muted line-through">Pickup 9:00 AM</span> → <b>Pickup 10:30 AM</b>
              </p>
              <p className="mt-1 text-ink-soft">Can you confirm?</p>
            </div>
            <div className="grid max-w-[85%] grid-cols-3 gap-1">
              {(["yes", "no", "voice"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAnswer(a)}
                  className={cn("rounded-xl bg-white py-2 text-xs font-bold text-[#0b7a5f] shadow-sm transition active:scale-95", answer === a && "ring-2 ring-[#0b7a5f]")}
                >
                  {a === "yes" ? "Yes" : a === "no" ? "No" : "Voice"}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              {answer && (
                <motion.div key={answer} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] p-3 text-[13px] shadow-sm">
                  {answer === "yes" && "✓ Confirmed. Thank you!"}
                  {answer === "no" && "Noted, we'll offer this to another partner. No action needed."}
                  {answer === "voice" && (
                    <div>
                      <div className="flex items-center gap-2">
                        <PlayIcon size={14} weight="fill" />
                        <div className="flex h-5 flex-1 items-center gap-0.5">
                          {Array.from({ length: 24 }).map((_, i) => (
                            <span key={i} className="w-0.5 rounded-full bg-[#0b7a5f]" style={{ height: `${30 + ((i * 37) % 70)}%` }} />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted">0:05</span>
                      </div>
                      <p className="mt-2 text-xs italic">“Haan, kal subah saadhe das baje aa jaunga.”</p>
                      <p className="mt-1 text-[11px] font-bold text-[#0b7a5f]">Jev: Confirmed · 10:30 AM · 96%</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Reveal>
      <div className="order-1 lg:order-2">
        <SectionHead
          center={false}
          kicker="Instant vendor coordination"
          tone="bg-mint"
          title="Vendors answer where they already are"
          body="Drivers, homestays and activity partners get clear requests with [Yes] [No] [Other time] buttons, or just send a voice note in Hindi. Whisper transcribes it, Jev reads it, and the All-or-Nothing engine applies a change only when everyone agrees."
        />
        <ul className="space-y-3">
          {[
            [ChatTextIcon, "No new app, no login, plus a one-page web link as backup"],
            [MicrophoneIcon, "Voice notes in any language become typed decisions with confidence"],
            [ArrowsClockwiseIcon, "Someone says no? Safe rollback and the next plan, automatically"],
          ].map(([Icon, text], i) => {
            const I = Icon as typeof ChatTextIcon;
            return (
              <Reveal key={i} delay={i * 0.08}>
                <li className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-clay-sm">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint">
                    <I size={20} weight="duotone" />
                  </span>
                  <span className="text-sm font-medium">{text as string}</span>
                </li>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ─── Two experiences ───────────────────────────────────────────────────

export function TwoSides() {
  return (
    <section id="operators" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHead kicker="One platform · two sides" tone="bg-pink" title="Soft and fun for travelers. Calm and clear for operators." body="The same trip, seen two ways. Operators open any tour and switch between exactly what the traveler sees and everything operations must do." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-[36px] bg-pink-soft p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-pink-deep">Traveler app · mobile-first</p>
            <h3 className="mt-2 text-2xl font-extrabold">Plan, book, live the trip</h3>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ["Must-Do Hearts", "5 per trip, always protected", HeartIcon, "bg-pink"],
                ["Mood buttons", "Tired? Hungry? One tap re-plans", SmileyIcon, "bg-sun"],
                ["Live price", "Every swap updates the budget", CurrencyInrIcon, "bg-mint"],
                ["Offline Trip Pass", "QR, tickets, SOS, no network", TicketIcon, "bg-lavender"],
              ].map(([t, s, I, c]) => {
                const Icon = I as typeof HeartIcon;
                return (
                  <div key={t as string} className="rounded-3xl bg-white p-4 shadow-clay-sm">
                    <span className={cn("grid h-10 w-10 place-items-center rounded-xl", c as string)}>
                      <Icon size={20} weight="duotone" />
                    </span>
                    <p className="mt-3 text-sm font-bold">{t as string}</p>
                    <p className="text-xs text-ink-soft">{s as string}</p>
                  </div>
                );
              })}
            </div>
            <Button href="/login?role=traveler" className="mt-6" icon={<ArrowRightIcon size={16} weight="bold" />}>
              Try the traveler app
            </Button>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="h-full rounded-[36px] border border-line-cool bg-canvas-cool p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-deep">Operator console · desktop-first</p>
            <h3 className="mt-2 text-2xl font-extrabold">Run 100 custom tours from one screen</h3>
            <div className="mt-6 grid grid-cols-3 gap-2.5">
              {[
                ["Active", "24"],
                ["At risk", "3"],
                ["Revenue", "₹8.4L"],
              ].map(([a, b]) => (
                <div key={a} className="rounded-2xl border border-line-cool bg-white p-3 shadow-soft">
                  <p className="text-[11px] text-muted">{a}</p>
                  <p className="font-display text-xl font-bold">{b}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2 rounded-2xl border border-line-cool bg-white p-3 shadow-soft">
              {[
                ["TRZ-2041 · Kulkarni family", "Live", "bg-success-soft text-success"],
                ["TRZ-2071 · Mehta couple", "At risk", "bg-danger-soft text-danger"],
                ["TRZ-2051 · Kapoor honeymoon", "Confirmed", "bg-info-soft text-info"],
              ].map(([a, b, c]) => (
                <div key={a} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{a}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", c)}>{b}</span>
                </div>
              ))}
            </div>
            <Button href="/login?role=operator" variant="outline" className="mt-6" icon={<ArrowRightIcon size={16} weight="bold" />}>
              Open the operator console
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Feature grid ──────────────────────────────────────────────────────

const FEATURES = [
  { t: "Trip Fixer Agent", b: "Agentic AI that repairs trips inside safe rules, live on screen.", I: RobotIcon, c: "bg-lavender" },
  { t: "Change Impact Map", b: "Every ripple of a change, with money and time at risk.", I: TreeStructureIcon, c: "bg-sky" },
  { t: "All-or-Nothing confirm", b: "A change applies only when every vendor says yes.", I: CheckCircleIcon, c: "bg-mint" },
  { t: "Voice notes, any language", b: "“Haan, 5 baje” becomes “Confirmed, 5:00 PM”.", I: MicrophoneIcon, c: "bg-pink" },
  { t: "Jev instant decisions", b: "Typed answers with confidence in 70 to 500 ms.", I: LightningIcon, c: "bg-sun" },
  { t: "Hearts + Mood buttons", b: "Protect must-dos, re-plan the day with one tap.", I: HeartIcon, c: "bg-coral" },
  { t: "What-If Simulator", b: "“What if heavy rain hits Coorg tomorrow?”, before it does.", I: FlaskIcon, c: "bg-cream" },
  { t: "Live alerts", b: "Early warnings and verified crowd reports across tours.", I: SirenIcon, c: "bg-lavender-soft" },
];

export function FeatureGrid() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHead kicker="Key features" title="Eight things judges (and travelers) remember" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <Reveal key={f.t} delay={(i % 4) * 0.06}>
            <div className="group h-full rounded-[26px] bg-white p-5 shadow-clay-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-clay">
              <span className={cn("grid h-12 w-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:-rotate-6", f.c)}>
                <f.I size={24} weight="duotone" />
              </span>
              <h3 className="mt-4 text-base font-bold">{f.t}</h3>
              <p className="mt-1.5 text-sm text-ink-soft">{f.b}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── 11-step journey ──────────────────────────────────────────────────

export const JOURNEY = [
  { t: "Discover", I: CompassIcon, d: "Browse by feeling" },
  { t: "Personalize", I: SparkleIcon, d: "Travel DNA" },
  { t: "Plan", I: MapTrifoldIcon, d: "Day-by-day builder" },
  { t: "Price", I: CurrencyInrIcon, d: "Live budget meter" },
  { t: "Book", I: TicketIcon, d: "Razorpay + email" },
  { t: "Prepare", I: BackpackIcon, d: "Smart checklist" },
  { t: "Operate", I: NavigationArrowIcon, d: "Live trip mode" },
  { t: "Assist", I: HandWavingIcon, d: "Mood buttons" },
  { t: "Adapt", I: ArrowsSplitIcon, d: "3 fix plans" },
  { t: "Complete", I: FlagIcon, d: "Trip story" },
  { t: "Review", I: StarIcon, d: "Vendor trust" },
];

export function JourneySection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead kicker="The full lifecycle" tone="bg-sun" title="11 steps. One connected journey." body="Every step has its own screen, and the operator sees each one from the other side." />
      </div>
      <div className="scrollbar-none overflow-x-auto px-4 sm:px-6">
        <ol className="mx-auto flex w-max gap-3 pb-4 lg:w-auto lg:max-w-6xl lg:flex-wrap lg:justify-center">
          {JOURNEY.map((s, i) => (
            <Reveal key={s.t} delay={i * 0.04}>
              <li className="relative flex w-36 flex-col items-center rounded-[26px] bg-white p-4 text-center shadow-clay-sm">
                <span className="absolute -top-2.5 left-3 rounded-full border-2 border-ink bg-sun px-2 text-[10px] font-extrabold shadow-pop">{i + 1}</span>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lavender-soft text-purple-deep">
                  <s.I size={24} weight="duotone" />
                </span>
                <p className="mt-3 font-display text-sm font-bold">{s.t}</p>
                <p className="text-[11px] text-muted">{s.d}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── Trust ────────────────────────────────────────────────────────────

export function TrustSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="grid gap-6 rounded-[40px] bg-white p-6 shadow-clay sm:p-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Kicker tone="bg-mint">Trust & safety</Kicker>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">Code decides. AI assists. Humans approve.</h2>
          <p className="mt-4 text-ink-soft">
            Times, prices and confirmations are always calculated by our own code. The agent acts alone only when the extra cost is under your limit, no hearted item is lost and all 10 safety checks pass. After two failed tries, a human coordinator takes over.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["1 in 7", "Indian flights delayed in peak 2025"],
              ["120+", "Western Ghats monsoon alerts & Ghat roads rerouted"],
              [">95%", "Instant vendor confirmation rate"],
            ].map(([a, b]) => (
              <div key={a} className="rounded-2xl bg-canvas p-4">
                <p className="font-display text-2xl font-extrabold text-purple">{a}</p>
                <p className="mt-1 text-xs text-ink-soft">{b}</p>
              </div>
            ))}
          </div>
        </div>
        <ul className="space-y-2.5">
          {[
            "Within the traveler's auto-approve budget",
            "No timing clashes · inside opening hours",
            "Energy stays balanced for the group",
            "New plan avoids the rain",
            "Must-Dos protected",
            "Jev: walking suits the group? · kid-friendly? · veg food?",
            "Every change logged with a Change Receipt",
          ].map((t, i) => (
            <Reveal key={t} delay={i * 0.05}>
              <li className="flex items-center gap-3 rounded-2xl bg-mint-soft px-4 py-3 text-sm font-medium">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success text-white">
                  <CheckIcon size={13} weight="bold" />
                </span>
                {t}
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── CTA + footer ─────────────────────────────────────────────────────

export function CTA() {
  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="bg-speed relative mx-auto max-w-6xl overflow-hidden rounded-[44px] border-2 border-ink bg-sun px-6 py-14 text-center shadow-pop-lg sm:px-12">
        <div className="absolute left-4 top-4 hidden sm:block">
          <Burst text="GO!" color="#f9cbc9" size={90} rotate={-14} />
        </div>
        <div className="absolute bottom-3 right-6 hidden animate-float sm:block">
          <Zippy mood="celebrate" size={110} />
        </div>
        <h2 className="mx-auto max-w-2xl text-balance text-3xl font-extrabold leading-tight sm:text-5xl">Plan your own trip. We handle the changes.</h2>
        <p className="mx-auto mt-4 max-w-lg text-ink-soft">Try the full journey, from quiz to booking to a rainy day that fixes itself, in under 7 minutes.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" href="/signup" icon={<ArrowRightIcon size={18} weight="bold" />}>
            Start planning free
          </Button>
          <Button size="lg" variant="outline" href="/login" icon={<UsersThreeIcon size={18} weight="bold" />}>
            Create your account
          </Button>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink pb-10 pt-16 text-white">
      <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-between px-6 font-display text-[18vw] font-extrabold italic leading-none text-white/[0.04]" aria-hidden>
        <span className="-rotate-6">PLAN</span>
        <span className="rotate-3">FIX</span>
        <span className="-rotate-3">GO</span>
      </div>
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-2xl font-extrabold">prayaana</span>
            <span className="rounded-full bg-sun px-2 py-0.5 text-[10px] font-bold text-ink">beta</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-white/65">The travel platform where a broken trip fixes itself, for travelers, tour operators and every vendor in between.</p>
          <p className="mt-4 inline-flex rounded-xl bg-white/5 px-3 py-2 font-mono text-xs text-sun ring-1 ring-white/10">npm install tripfix</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-sun">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-white/75">
            <li><Link href="/discover" className="hover:text-white">Discover</Link></li>
            <li><Link href="/quiz" className="hover:text-white">Travel DNA quiz</Link></li>
            <li><Link href="/ops" className="hover:text-white">Operator console</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-sun">Built with</p>
          <ul className="mt-3 space-y-2 text-sm text-white/75">
            <li>Next.js · Go · Postgres</li>
            <li>Nugen aligned travel model</li>
            <li>Groq · Gemini · Whisper</li>
            <li>OR-Tools · MapLibre</li>
          </ul>
        </div>
      </div>
      <div className="relative mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-2 border-t border-white/10 px-4 pt-6 text-xs text-white/45 sm:flex-row sm:px-6">
        <p>© 2026 Prayaana. Made for the Pillai Hackathon.</p>
      </div>
    </footer>
  );
}
