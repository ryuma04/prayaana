"use client";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { motion } from "motion/react";
import {
  SunHorizonIcon,
  MapTrifoldIcon,
  WarningOctagonIcon,
  StorefrontIcon,
  TicketIcon,
  WalletIcon,
  SignOutIcon,
  ArrowSquareOutIcon,
  SquaresFourIcon,
  SparkleIcon,
  FlaskIcon,
} from "@phosphor-icons/react";
import { Logo } from "@/components/brand/Logo";
import { NotificationBell } from "./NotificationBell";
import { Avatar } from "@/components/ui/primitives";
import { useAuthStore } from "@/stores/authStore";
import { useIncidentStore } from "@/stores/incidentStore";
import { useOperatorStore } from "@/stores/operatorStore";
import { useAgentStore } from "@/stores/agentStore";
import { useOperatorName } from "@/hooks/queries";
import { cn } from "@/lib/format";

type Section = {
  href: string;
  label: string;
  Icon: typeof SunHorizonIcon;
  /** Pages that belong to this section (shown as sub-tabs). */
  pages: { href: string; label: string }[];
  badge?: number;
  live?: boolean;
};

/**
 * The operator console uses the same look as the traveler app: one top bar with a pill
 * menu of five sections, sub-tabs for related pages, and a bottom bar on phones.
 */
export function OpsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const company = useOperatorName();
  const openIncidents = useIncidentStore((s) => s.incidents.filter((i) => i.status !== "resolved").length);

  const agentLive = useAgentStore((s) => Object.values(s.runs).some((r) => r.status === "running" || r.status === "waiting"));

  // One flat bar: everything an operator runs day to day. Problems has sub-tabs for the Trip
  // Fixer and alerts; the AI assistant sits next to the notifications.
  const sections: Section[] = [
    { href: "/ops", label: "Today", Icon: SunHorizonIcon, pages: [] },
    { href: "/ops/tours", label: "Trips", Icon: MapTrifoldIcon, pages: [] },
    { href: "/ops/bookings", label: "Bookings", Icon: TicketIcon, pages: [] },
    {
      href: "/ops/incidents",
      label: "Problems",
      Icon: WarningOctagonIcon,
      badge: openIncidents,
      live: agentLive,
      pages: [
        { href: "/ops/incidents", label: "Problems" },
        { href: "/ops/agent", label: "Trip Fixer" },
        { href: "/ops/alerts", label: "Alerts" },
      ],
    },
    { href: "/ops/what-if", label: "What if", Icon: FlaskIcon, pages: [] },
    { href: "/ops/vendors", label: "Partners", Icon: StorefrontIcon, pages: [] },
    { href: "/ops/payments", label: "Money", Icon: WalletIcon, pages: [] },
  ];
  // The phone bar keeps the five most used.
  const mobile = sections.filter((x) => ["/ops", "/ops/tours", "/ops/bookings", "/ops/incidents", "/ops/payments"].includes(x.href));

  const inPage = (href: string) => (href === "/ops" ? pathname === "/ops" : pathname === href || pathname.startsWith(href + "/"));
  const active = sections.find((s) => (s.pages.length ? s.pages.some((p) => inPage(p.href)) : inPage(s.href))) ?? sections[0];

  return (
    <div className="bg-dots min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-ink/5 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 shrink-0 items-center gap-3">
            <Logo href="/ops" tag="Ops" />
            <span className="hidden truncate text-xs font-semibold text-muted xl:block">{company}</span>
          </div>
          <nav className="hidden items-center gap-1 rounded-full bg-white p-1 shadow-clay-sm md:flex" aria-label="Operator">
            {sections.map(({ href, label, Icon, badge, live }) => {
              const on = active.href === href;
              return (
                <Link key={href} href={href} aria-current={on ? "page" : undefined} className={cn("relative inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors", on ? "text-white" : "text-ink-soft hover:text-ink")}>
                  {on && <motion.span layoutId="ops-nav" className="absolute inset-0 rounded-full bg-pill" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                  <Icon size={18} weight={on ? "fill" : "regular"} className="relative" />
                  <span className="relative hidden lg:inline">{label}</span>
                  {live && <span className="relative h-2 w-2 animate-pulse rounded-full bg-purple" aria-label="Agent working" />}
                  {!!badge && <span className={cn("relative rounded-full px-1.5 text-[10px] font-bold", on ? "bg-white text-ink" : "bg-coral text-white")}>{badge}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle variant="compact" />
            <Link
              href="/ops/assistant"
              aria-label="Ask the ops assistant"
              title="Ask the ops assistant"
              className={cn("grid h-11 w-11 place-items-center rounded-full shadow-clay-sm transition active:scale-95", inPage("/ops/assistant") ? "bg-pill text-white" : "bg-white text-purple-deep hover:-translate-y-0.5")}
            >
              <SparkleIcon size={20} weight="fill" />
            </Link>
            <NotificationBell audience="operator" allHref="/ops/incidents" />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="rounded-full transition active:scale-95" aria-label="Account menu">
                <Avatar name={user?.name ?? "Operator"} tone="lavender" size={44} />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className="z-[70] min-w-56 rounded-3xl border-2 border-ink bg-white p-1.5 shadow-pop-lg">
                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold">{user?.name}</p>
                    <p className="text-xs text-muted">{company}</p>
                  </div>
                  <MenuItem onSelect={() => router.push("/discover")} icon={<ArrowSquareOutIcon size={16} />}>
                    Open traveler app
                  </MenuItem>
                  <MenuItem
                    onSelect={() => {
                      logout();
                      router.push("/login");
                    }}
                    icon={<SquaresFourIcon size={16} />}
                  >
                    Switch account
                  </MenuItem>
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <MenuItem
                    onSelect={() => {
                      logout();
                      router.push("/");
                    }}
                    icon={<SignOutIcon size={16} />}
                  >
                    Sign out
                  </MenuItem>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
        {active.pages.length > 1 && (
          <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6">
            <nav className="scrollbar-none flex gap-2 overflow-x-auto" aria-label={`${active.label} pages`}>
              {active.pages.map((p) => {
                const on = inPage(p.href);
                return (
                  <Link key={p.href} href={p.href} aria-current={on ? "page" : undefined} className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition", on ? "bg-ink text-white" : "bg-white text-ink-soft shadow-clay-sm hover:text-ink")}>
                    {p.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 md:pb-16 md:pt-6">
        {children}
      </main>
      <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[28px] border-2 border-ink bg-white/95 px-2 py-1.5 shadow-pop backdrop-blur md:hidden" aria-label="Operator">
        <ul className="flex items-center justify-around">
          {mobile.map(({ href, label, Icon, badge }) => {
            const on = active.href === href;
            return (
              <li key={href}>
                <Link href={href} className="relative flex min-w-14 flex-col items-center gap-0.5 rounded-2xl px-2 py-1" aria-current={on ? "page" : undefined}>
                  <span className={cn("grid h-9 w-12 place-items-center rounded-full transition-colors", on ? "bg-pill text-white" : "text-ink-soft")}>
                    <Icon size={20} weight={on ? "fill" : "regular"} />
                  </span>
                  <span className={cn("text-[10px] font-semibold", on ? "text-ink" : "text-muted")}>{label}</span>
                  {!!badge && <span className="absolute right-1 top-0 rounded-full bg-coral px-1.5 text-[9px] font-bold text-white">{badge}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function MenuItem({ children, onSelect, icon }: { children: ReactNode; onSelect: () => void; icon: ReactNode }) {
  return (
    <DropdownMenu.Item onSelect={onSelect} className="flex cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium outline-none data-[highlighted]:bg-lavender-soft">
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}
