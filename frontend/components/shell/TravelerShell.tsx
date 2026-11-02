"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { motion } from "motion/react";
import {
  CompassIcon,
  MapTrifoldIcon,
  SuitcaseRollingIcon,
  UserCircleIcon,
  NavigationArrowIcon,
  SignOutIcon,
  SquaresFourIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { Logo } from "@/components/brand/Logo";
import { NotificationBell } from "./NotificationBell";
import { FeedbackPrompt } from "@/components/traveler/FeedbackPrompt";
import { Avatar } from "@/components/ui/primitives";
import { useAuthStore } from "@/stores/authStore";
import { useActiveTrip } from "@/stores/tripStore";
import { cn } from "@/lib/format";

const FOCUS_ROUTES = ["/onboarding", "/quiz", "/plan/generate", "/booking-success"];

export function TravelerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const active = useActiveTrip();
  const focus = FOCUS_ROUTES.some((r) => pathname.startsWith(r));
  const live = active?.status === "live";

  const nav = [
    { href: "/discover", label: "Discover", Icon: CompassIcon, match: (p: string) => p.startsWith("/discover") },
    { href: "/plan", label: "Plan", Icon: MapTrifoldIcon, match: (p: string) => p.startsWith("/plan") || p.startsWith("/compare") || p.startsWith("/checkout") },
    live
      ? { href: "/my-trip/live", label: "Live", Icon: NavigationArrowIcon, match: (p: string) => p.startsWith("/my-trip/live") || p.startsWith("/my-trip/adapt") }
      : { href: "/my-trip", label: "My Trip", Icon: SuitcaseRollingIcon, match: (p: string) => p.startsWith("/my-trip") || p.startsWith("/prepare") || p.startsWith("/review") },
    ...(live ? [{ href: "/my-trip", label: "Trip", Icon: SuitcaseRollingIcon, match: (p: string) => p === "/my-trip" || /^\/my-trip\/trp/.test(p) || p.startsWith("/prepare") }] : []),
    { href: "/profile", label: "Profile", Icon: UserCircleIcon, match: (p: string) => p.startsWith("/profile") || p.startsWith("/notifications") },
  ];

  return (
    <div className="bg-dots min-h-dvh">
      {!focus && (
        <header className="sticky top-0 z-40 border-b border-ink/5 bg-canvas/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <Logo href="/discover" />
            <nav className="hidden items-center gap-1 rounded-full bg-white p-1 shadow-clay-sm md:flex" aria-label="Main">
              {nav.map(({ href, label, Icon, match }) => {
                const on = match(pathname);
                return (
                  <Link key={href + label} href={href} className={cn("relative inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors", on ? "text-white" : "text-ink-soft hover:text-ink")} aria-current={on ? "page" : undefined}>
                    {on && <motion.span layoutId="trav-nav" className="absolute inset-0 rounded-full bg-pill" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                    <Icon size={18} weight={on ? "fill" : "regular"} className="relative" />
                    <span className="relative">{label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-2">
              {live && (
                <Link href="/my-trip/live" className="hidden items-center gap-1.5 rounded-full border-2 border-ink bg-mint px-3 py-1.5 text-xs font-bold shadow-pop sm:inline-flex">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  Trip live
                </Link>
              )}
              <NotificationBell audience="traveler" allHref="/notifications" />
              <button
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 text-sm font-semibold shadow-pop transition hover:bg-pink-soft active:scale-95"
              >
                <SignOutIcon size={16} weight="bold" />
                <span className="hidden sm:inline">Log out</span>
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger className="rounded-full transition active:scale-95" aria-label="Account menu">
                  <Avatar name={user?.name ?? "Guest"} tone={user?.avatarTone ?? "sky"} size={44} />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={8} className="z-[70] min-w-52 rounded-3xl border-2 border-ink bg-white p-1.5 shadow-pop-lg">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold">{user?.name}</p>
                      <p className="text-xs text-muted">{user?.email}</p>
                    </div>
                    <MenuItem onSelect={() => router.push("/profile")} icon={<UserCircleIcon size={16} />}>Profile & Travel DNA</MenuItem>
                    <MenuItem onSelect={() => router.push("/quiz")} icon={<SparkleIcon size={16} />}>Retake quiz</MenuItem>
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
        </header>
      )}
      <main id="main" className={cn("mx-auto max-w-6xl px-4 sm:px-6", focus ? "pb-10" : "pb-28 pt-4 md:pb-16 md:pt-6")}>
        {children}
      </main>
      {!pathname.startsWith("/review") && <FeedbackPrompt />}
      {!focus && (
        <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[28px] border-2 border-ink bg-white/95 px-2 py-1.5 shadow-pop backdrop-blur md:hidden" aria-label="Main">
          <ul className="flex items-center justify-around">
            {nav.map(({ href, label, Icon, match }) => {
              const on = match(pathname);
              return (
                <li key={href + label}>
                  <Link href={href} className="flex min-w-14 flex-col items-center gap-0.5 rounded-2xl px-2 py-1" aria-current={on ? "page" : undefined}>
                    <span className={cn("grid h-9 w-12 place-items-center rounded-full transition-colors", on ? "bg-pill text-white" : "text-ink-soft")}>
                      <Icon size={20} weight={on ? "fill" : "regular"} />
                    </span>
                    <span className={cn("text-[10px] font-semibold", on ? "text-ink" : "text-muted")}>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
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
