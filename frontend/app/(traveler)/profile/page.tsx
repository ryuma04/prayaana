"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { SparkleIcon, SignOutIcon, ShieldCheckIcon, TranslateIcon, HeartIcon, SquaresFourIcon, BellIcon } from "@phosphor-icons/react";
import { useAuthStore } from "@/stores/authStore";
import { useTravelerStore, BADGES } from "@/stores/travelerStore";
import { useTripStore } from "@/stores/tripStore";
import { Avatar, Select, Slider } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { DNARadar, TravelDNABars } from "@/components/traveler/TravelDNA";
import { DNALearning } from "@/components/traveler/DNALearning";
import { TelegramConnect } from "@/components/traveler/TelegramConnect";
import { DestinationArt } from "@/components/art/DestinationArt";
import { destinationMap } from "@/data/destinations";
import { cn, rupees } from "@/lib/format";
import type { DestinationId } from "@/types";
import { DnaIcon, Glyph } from "@/lib/icons";
import { useTranslation } from "@/lib/i18n";
import { LanguageToggle } from "@/components/ui/LanguageToggle";

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t: tr } = useTranslation();
  const t = useTravelerStore(useShallow((s) => ({ dna: s.dna, xp: s.xp, badges: s.badges, saved: s.savedPlaces, limit: s.autoApproveLimit, language: s.language })));
  const setAutoApprove = useTravelerStore((s) => s.setAutoApprove);
  const setLanguage = useTravelerStore((s) => s.setLanguage);
  const toggleSaved = useTravelerStore((s) => s.toggleSaved);
  const { trips, myTrips } = useTripStore(useShallow((s) => ({ trips: s.trips, myTrips: s.myTrips })));
  const stamps = [...new Set(myTrips.map((id) => trips[id]).filter((x) => x && x.status !== "draft").map((x) => x!.destinationId))];
  // Recommendations follow the most recent trip that isn't finished (else the latest one).
  const mine = myTrips.map((id) => trips[id]).filter((x) => !!x);
  const focus = mine.find((x) => x!.status !== "completed") ?? mine[0];
  const level = Math.floor(t.xp / 250) + 1;
  const into = t.xp % 250;

  return (
    <div className="grid gap-6 pb-10 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <Card variant="sticker" pad="lg" className="text-center">
          <Avatar name={user?.name ?? "Traveler"} tone={user?.avatarTone ?? "sky"} size={84} className="mx-auto" />
          <h1 className="mt-3 text-2xl font-extrabold">{user?.name}</h1>
          <p className="text-sm text-muted">{user?.email}</p>
          <div className="mt-4 rounded-2xl bg-canvas p-3 text-left">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">Level {level} explorer</span>
              <span className="text-muted">{t.xp} XP</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-gradient-to-r from-coral to-purple" style={{ width: `${(into / 250) * 100}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-muted">{250 - into} XP to level {level + 1}</p>
          </div>
        </Card>
        <Card pad="md">
          <SectionTitle title="Badges" kicker={`${t.badges.length}/${BADGES.length}`} />
          <div className="grid grid-cols-3 gap-2">
            {BADGES.map((b) => {
              const on = t.badges.includes(b.id);
              return (
                <div key={b.id} className={cn("rounded-2xl p-2.5 text-center", on ? "bg-sun-soft" : "bg-canvas opacity-50 grayscale")} title={b.hint}>
                  <Glyph emoji={b.emoji} size={26} className="mx-auto" />
                  <p className="text-[10px] font-bold leading-tight">{b.label}</p>
                </div>
              );
            })}
          </div>
        </Card>
        <Card pad="md">
          <SectionTitle title="Passport stamps" />
          {stamps.length ? (
            <div className="flex flex-wrap gap-2">
              {stamps.map((id) => (
                <span key={id} className="-rotate-3 rounded-xl border-2 border-dashed border-coral px-3 py-1.5 font-display text-xs font-extrabold uppercase text-coral-deep">
                  {destinationMap[id as DestinationId].name} ✓
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Book a trip to collect your first stamp.</p>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <section>
          <SectionTitle title="Your Travel DNA" action={<Link href="/quiz" className="text-sm font-semibold text-purple-deep hover:underline">Retake</Link>} />
          {t.dna ? (
            <Card pad="lg" className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
              <div className="mx-auto">
                <DNARadar dna={t.dna} />
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold">
                  <span className="inline-flex items-center gap-2"><DnaIcon name={t.dna.name} size={28} className="text-purple-deep" /> {t.dna.name}</span>
                </p>
                <p className="mt-1 text-sm text-ink-soft">{t.dna.summary}</p>
                <div className="mt-4">
                  <TravelDNABars dna={t.dna} animate={false} compact />
                </div>
              </div>
            </Card>
          ) : (
            <EmptyState compact title="No Travel DNA yet" body="Take the 60-second quiz to get trips that feel like you." action={<Button href="/quiz" icon={<SparkleIcon size={16} weight="fill" />}>Take the quiz</Button>} />
          )}
        </section>
        {t.dna && <DNALearning tripId={focus?.id} />}

        <section>
          <SectionTitle title="Saved places" />
          {t.saved.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {t.saved.map((id) => {
                const d = destinationMap[id as DestinationId];
                if (!d) return null;
                return (
                  <div key={id} className="group relative overflow-hidden rounded-[22px] bg-white shadow-clay-sm">
                    <Link href={`/discover/${id}`}>
                      <div className="h-24">
                        <DestinationArt kind={d.art} />
                      </div>
                      <p className="p-3 text-sm font-bold">{d.name}</p>
                    </Link>
                    <button onClick={() => toggleSaved(id)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90" aria-label={`Remove ${d.name}`}>
                      <HeartIcon size={16} weight="fill" className="text-coral" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted">Tap the heart on any destination to save it.</p>
          )}
        </section>

        <section>
          <SectionTitle title={tr("settings", "Settings")} />
          <Card pad="lg" className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 font-semibold">
                  <ShieldCheckIcon size={18} weight="duotone" className="text-purple" /> {tr("autoApproveLimit", "Auto-approve limit")}
                </p>
                <span className="font-display font-bold">{rupees(t.limit)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{tr("autoApproveDesc", "If something goes wrong on your trip, we fix it for you automatically when the extra cost is under this amount. Anything more, we ask you first.")}</p>
              <Slider className="mt-3" value={t.limit} onChange={setAutoApprove} min={0} max={5000} step={100} label="Auto-approve limit" />
            </div>
            <TelegramConnect />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <TranslateIcon size={18} weight="duotone" className="text-purple" /> {tr("language", "Language")} / ಭಾಷೆ
                </p>
                <p className="mt-0.5 text-xs text-muted">Switch between English and Kannada (ಕರ್ನಾಟಕ)</p>
              </div>
              <div className="flex items-center gap-2">
                <LanguageToggle />
                <Select value={t.language} onChange={(e) => setLanguage(e.target.value)} className="max-w-44" aria-label="Language">
                  {["English", "ಕನ್ನಡ (Kannada)", "हिन्दी (Hindi)", "मराठी (Marathi)", "தமிழ் (Tamil)", "తెలుగు (Telugu)"].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line pt-5">
              <Button variant="secondary" href="/notifications" icon={<BellIcon size={16} />}>
                {tr("notifications", "Notifications")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                icon={<SquaresFourIcon size={16} />}
              >
                {tr("switchAccount", "Switch account")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                icon={<SignOutIcon size={16} />}
              >
                {tr("signOut", "Sign out")}
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
