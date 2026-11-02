"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { EnvelopeSimpleIcon, ArrowRightIcon, PlayCircleIcon, ShieldCheckIcon, LightningIcon } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { HeroStory } from "@/components/landing/HeroStory";
import { Burst } from "@/components/landing/Burst";
import {
  AgentShowcase,
  CTA,
  DestinationStrip,
  FeatureGrid,
  Footer,
  HowItWorks,
  ImpactPreview,
  JourneySection,
  Personalization,
  TrustSection,
  TwoSides,
} from "@/components/landing/Sections";
import { useAuthStore, homeForRole } from "@/stores/authStore";
import { useAppReady } from "@/components/providers/StoreHydrator";
import { useTranslation } from "@/lib/i18n";
import { LanguageToggle } from "@/components/ui/LanguageToggle";

export default function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const ready = useAppReady((s) => s.ready);
  const { t } = useTranslation();
  return (
    <div className="bg-dots min-h-dvh overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-ink/5 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-semibold text-ink-soft md:flex" aria-label="Landing">
            <a href="#how" className="hover:text-ink">{t("navHowItWorks", "How it works")}</a>
            <a href="#features" className="hover:text-ink">{t("navFeatures", "Features")}</a>
            <a href="#operators" className="hover:text-ink">{t("navForOperators", "For operators")}</a>
            <Link href="/discover" className="hover:text-ink">{t("navDestinations", "Destinations")}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle variant="compact" />
            {ready && user ? (
              <>
                <button onClick={() => logout()} className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-ink/5">
                  {t("logOut", "Log out")}
                </button>
                <Button size="sm" href={homeForRole[user.role]} icon={<ArrowRightIcon size={14} weight="bold" />}>
                  {t("openApp", "Open app")}
                </Button>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-ink/5 sm:px-4">
                  {t("logIn", "Log in")}
                </Link>
                <Button size="sm" href="/signup">
                  {t("getStarted", "Get started")}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-10 pt-12 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-xs font-bold shadow-pop"
            >
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white">🌿 KARNATAKA</span>
              {t("heroBadge", "Exclusively Karnataka · 16 Curated Destinations")}
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
              className="mt-6 text-balance text-[2.6rem] font-extrabold leading-[1.02] text-ink sm:text-6xl lg:text-[4.1rem]"
            >
              {t("heroTitle", "Plan your own trip.")}
            </motion.h1>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" href="/signup" icon={<ArrowRightIcon size={18} weight="bold" />}>
                {t("startPlanning", "Start planning")}
              </Button>
              <Button size="lg" variant="outline" href="/discover" icon={<PlayCircleIcon size={20} weight="fill" />}>
                {t("navDiscover", "Explore destinations")}
              </Button>
            </motion.div>
            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-soft">
              <li className="inline-flex items-center gap-1.5"><LightningIcon size={16} weight="fill" className="text-sun-deep" /> Trip in under a minute</li>
              <li className="inline-flex items-center gap-1.5"><EnvelopeSimpleIcon size={16} weight="fill" className="text-success" /> Tickets by email</li>
              <li className="inline-flex items-center gap-1.5"><ShieldCheckIcon size={16} weight="fill" className="text-purple" /> Nothing half-updated</li>
            </motion.ul>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 0.6 }} className="relative">
            <div className="absolute -left-4 -top-6 z-10 hidden lg:block">
              <Burst text="ZAP!" color="#fad47f" size={84} rotate={-16} />
            </div>
            <HeroStory />
          </motion.div>
        </section>

        <DestinationStrip />
        <HowItWorks />
        <Personalization />
        <ImpactPreview />
        <AgentShowcase />
        <TwoSides />
        <FeatureGrid />
        <JourneySection />
        <TrustSection />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
