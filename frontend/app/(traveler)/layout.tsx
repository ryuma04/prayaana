"use client";
import { usePathname } from "next/navigation";
import { TravelerShell } from "@/components/shell/TravelerShell";
import { AuthGate } from "@/components/shell/AuthGate";

export default function TravelerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const guestOk = pathname.startsWith("/discover");
  return (
    <AuthGate roles={["traveler"]} allowGuest={guestOk}>
      <TravelerShell>{children}</TravelerShell>
    </AuthGate>
  );
}
