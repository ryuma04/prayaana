"use client";
import { AccountsView } from "@/components/admin/AdminKit";

export default function SuperAdminOperatorsPage() {
  return <AccountsView role="operator" title="Operators" sub="operator staff logins" />;
}
