"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, homeForRole } from "@/stores/authStore";
import { useAppReady } from "@/components/providers/StoreHydrator";
import { PageLoader } from "@/components/ui/States";
import type { Role } from "@/types";

export function AuthGate({ roles, children, allowGuest }: { roles: Role[]; children: ReactNode; allowGuest?: boolean }) {
  const ready = useAppReady((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const pathname = usePathname();

  const roleKey = roles.join(",");

  useEffect(() => {
    if (ready && !user && !allowGuest) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (ready && user && !roles.includes(user.role)) {
      router.replace(homeForRole[user.role]);
    }
  }, [ready, user, roleKey, allowGuest, router, pathname]);

  if (!ready) return <PageLoader label="Packing your bags…" />;
  if (!user) return allowGuest ? <>{children}</> : <PageLoader label="Taking you to sign in…" />;
  if (!roles.includes(user.role)) return <PageLoader label={`Taking you to your ${user.role} console…`} />;
  return <>{children}</>;
}
