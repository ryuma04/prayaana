"use client";
import { OpsShell } from "@/components/shell/OpsShell";
import { AuthGate } from "@/components/shell/AuthGate";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate roles={["operator"]}>
      <OpsShell>{children}</OpsShell>
    </AuthGate>
  );
}
