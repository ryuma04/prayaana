"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { motion } from "motion/react";
import { SquaresFourIcon, IdentificationBadgeIcon, BuildingsIcon, UsersThreeIcon, SignOutIcon, type Icon } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/primitives";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/format";

const sections: { href: string; label: string; Icon: Icon }[] = [
  { href: "/super-admin", label: "Dashboard", Icon: SquaresFourIcon },
  { href: "/super-admin/guides", label: "Guides", Icon: IdentificationBadgeIcon },
  { href: "/super-admin/operators", label: "Operators", Icon: BuildingsIcon },
  { href: "/super-admin/users", label: "Users", Icon: UsersThreeIcon },
];

/** The Super Admin console: the operator console's top bar and phone bar with four sections. */
export function SuperAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isOn = (href: string) => (href === "/super-admin" ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  return (
    <div className="bg-dots min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-ink/5 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 shrink-0 items-center gap-3">
            <Logo href="/super-admin" tag="Admin" />
            <span className="hidden truncate text-xs font-semibold text-muted xl:block">Platform control</span>
          </div>
          <nav className="hidden items-center gap-1 rounded-full bg-white p-1 shadow-clay-sm md:flex" aria-label="Super Admin">
            {sections.map(({ href, label, Icon }) => {
              const on = isOn(href);
              return (
                <Link key={href} href={href} aria-current={on ? "page" : undefined} className={cn("relative inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors", on ? "text-white" : "text-ink-soft hover:text-ink")}>
                  {on && <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-full bg-pill" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                  <Icon size={18} weight={on ? "fill" : "regular"} className="relative" />
                  <span className="relative">{label}</span>
                </Link>
              );
            })}
          </nav>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="rounded-full transition active:scale-95" aria-label="Account menu">
              <Avatar name={user?.name ?? "Super Admin"} tone="coral" size={44} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={8} className="z-[70] min-w-56 rounded-3xl border-2 border-ink bg-white p-1.5 shadow-pop-lg">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold">{user?.name}</p>
                  <p className="text-xs text-muted">{user?.email}</p>
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
                <DropdownMenu.Item
                  onSelect={() => {
                    logout();
                    router.push("/login");
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium outline-none data-[highlighted]:bg-lavender-soft"
                >
                  <SignOutIcon size={16} />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 md:pb-16 md:pt-6">
        {children}
      </main>
      <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[28px] border-2 border-ink bg-white/95 px-2 py-1.5 shadow-pop backdrop-blur md:hidden" aria-label="Super Admin">
        <ul className="flex items-center justify-around">
          {sections.map(({ href, label, Icon }) => {
            const on = isOn(href);
            return (
              <li key={href}>
                <Link href={href} className="relative flex min-w-14 flex-col items-center gap-0.5 rounded-2xl px-2 py-1" aria-current={on ? "page" : undefined}>
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
    </div>
  );
}
