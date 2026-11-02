"use client";
import { SuperAdminShell } from "@/components/shell/SuperAdminShell";
import { AuthGate } from "@/components/shell/AuthGate";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate roles={["super_admin"]}>
      <SuperAdminShell>{children}</SuperAdminShell>
    </AuthGate>
  );
}
