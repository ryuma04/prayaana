"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightIcon, CompassIcon, ChartPieSliceIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon, ShieldCheckIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/primitives";
import { homeForRole } from "@/stores/authStore";
import { getProfile } from "@/lib/api/profile";
import { playWelcome } from "@/lib/welcome";
import { login } from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/format";
import { validateEmail } from "@/lib/validation";
import type { Role } from "@/types";

const PORTALS: { role: Role; label: string; Icon: typeof CompassIcon; tone: string; blurb: string }[] = [
  { role: "traveler", label: "Traveler", Icon: CompassIcon, tone: "bg-sun", blurb: "Plan, book and manage your trips." },
  { role: "operator", label: "Tour operator", Icon: ChartPieSliceIcon, tone: "bg-sky", blurb: "Staff console for tours, vendors and payments." },
  { role: "super_admin", label: "Admin", Icon: ShieldCheckIcon, tone: "bg-coral", blurb: "Prayaana platform control: guides, operators and users." },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const verified = params.get("verified");
  const [portal, setPortal] = useState<Role>(params.get("role") === "operator" ? "operator" : params.get("role") === "super_admin" ? "super_admin" : "traveler");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (errors.email) {
      const err = validateEmail(val);
      setErrors((prev) => ({ ...prev, email: err || "" }));
    }
  };

  const handleEmailBlur = () => {
    if (email.trim()) {
      const err = validateEmail(email);
      if (err) {
        setErrors((prev) => ({ ...prev, email: err }));
      }
    }
  };

  const signIn = async (mail: string, pass: string) => {
    setErrors({});
    setLoading(mail.trim().toLowerCase());
    try {
      const { user } = await login(mail, pass, portal);
      let target = homeForRole[user.role];
      if (next && next.startsWith("/") && !next.startsWith("/login")) {
        const isOpsPath = next.startsWith("/ops");
        if (user.role === "operator" && isOpsPath) {
          target = next;
        } else if (user.role === "traveler" && !isOpsPath && !next.startsWith("/super-admin")) {
          target = next;
        } else if (user.role === "super_admin" && next.startsWith("/super-admin")) {
          target = next;
        }
      }
      // Only travelers without a Travel DNA yet are sent to the quiz.
      if (user.role === "traveler" && target === homeForRole.traveler) {
        const profile = await getProfile().catch(() => null);
        if (profile && !profile.dna) target = "/quiz";
      }
      playWelcome();
      router.push(target);
    } catch (e) {
      setLoading(null);
      if (e instanceof ApiError && e.code === "email_not_verified") {
        router.push(`/verify?email=${encodeURIComponent(mail.trim())}&from=login`);
        return;
      }
      setErrors(e instanceof ApiError && e.fields ? e.fields : { password: errorMessage(e) });
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const emailErr = validateEmail(email);
    if (emailErr) errs.email = emailErr;
    if (!password) errs.password = "Enter your password";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    void signIn(email, password);
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">{PORTALS.find((p) => p.role === portal)?.blurb}</p>
      <div className="mt-6 grid grid-cols-3 gap-1 rounded-full border-2 border-ink bg-white p-1" role="tablist" aria-label="Log in as">
        {PORTALS.map((p) => (
          <button
            key={p.role}
            type="button"
            role="tab"
            aria-selected={portal === p.role}
            onClick={() => {
              setPortal(p.role);
              setErrors({});
            }}
            className={cn("flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 py-2.5 text-xs font-bold transition sm:text-sm", portal === p.role ? cn(p.tone, "shadow-pop") : "text-muted hover:text-ink")}
          >
            <p.Icon size={18} weight="duotone" className="shrink-0" /> {p.label}
          </button>
        ))}
      </div>
      {verified && (
        <p
          role="status"
          className={cn(
            "mt-5 flex items-start gap-2 rounded-2xl border-2 border-ink px-3.5 py-2.5 text-sm font-semibold shadow-pop",
            verified === "ok" ? "bg-mint-soft" : "bg-pink-soft",
          )}
        >
          {verified === "ok" ? <CheckCircleIcon size={18} weight="fill" className="mt-0.5 shrink-0 text-success" /> : <WarningCircleIcon size={18} weight="fill" className="mt-0.5 shrink-0 text-danger" />}
          {verified === "ok" ? "Your email is confirmed. Log in to start planning." : "That link has expired. Log in and we'll send you a fresh code."}
        </p>
      )}
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email || undefined}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => handleEmailChange(e.target.value)} onBlur={handleEmailBlur} aria-invalid={!!errors.email} required />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password || undefined}>
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} required className="pr-12" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-ink/5" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
            </button>
          </div>
        </Field>
        <Button type="submit" full size="lg" loading={!!loading && loading === email.trim().toLowerCase()} disabled={!!loading} icon={<ArrowRightIcon size={18} weight="bold" />}>
          Log in
        </Button>
      </form>

      {portal === "traveler" ? (
        <p className="mt-8 text-center text-sm text-muted">
          New to Prayaana?{" "}
          <Link href="/signup" className="font-bold text-ink underline underline-offset-4">
            Create an account
          </Link>
        </p>
      ) : portal === "super_admin" ? (
        <p className="mt-8 text-center text-sm text-muted">The admin login is set on the server (SUPER_ADMIN_EMAIL). It can&apos;t be created here.</p>
      ) : (
        <p className="mt-8 text-center text-sm text-muted">Operator accounts are created by your company admin. Ask them for your staff login.</p>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
