"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/primitives";
import { signup } from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/format";
import { validateEmail } from "@/lib/validation";
import { useQuizStore } from "@/stores/quizStore";
import { clearSession } from "@/lib/session";
import { playWelcome } from "@/lib/welcome";

const LEVELS = [
  { label: "Too short", bar: "bg-danger" },
  { label: "Weak", bar: "bg-coral" },
  { label: "Okay", bar: "bg-sun" },
  { label: "Strong", bar: "bg-mint-deep" },
];

/** Mirrors the server rules: 8–72 characters with letters and numbers; longer and mixed is stronger. */
function strength(pw: string) {
  if (pw.length < 8) return 0;
  let score = /[a-z]/i.test(pw) && /\d/.test(pw) ? 1 : 0;
  if (pw.length >= 12) score++;
  if (/[^a-z0-9]/i.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) score++;
  return Math.max(1, score);
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const level = strength(password);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Tell us your name";
    const emailErr = validateEmail(email);
    if (emailErr) errs.email = emailErr;
    if (password.length < 8) errs.password = "Use at least 8 characters";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      clearSession();
      useQuizStore.getState().reset();
      const res = await signup({ name: name.trim(), email: email.trim(), password });
      if (res.session) {
        useQuizStore.getState().reset();
        playWelcome();
        router.push("/quiz");
        return;
      }
      router.push(`/verify?email=${encodeURIComponent(res.email)}${res.emailSent ? "" : "&sent=0"}`);
    } catch (err) {
      setErrors(err instanceof ApiError && err.fields ? err.fields : { email: errorMessage(err) });
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Let&apos;s get you travelling</h1>
      <p className="mt-2 text-sm text-muted">Create a free traveler account and start planning in a minute.</p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <Field label="Your name" htmlFor="name" error={errors.name}>
          <Input id="name" autoComplete="name" placeholder="Rahul Mehta" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => handleEmailChange(e.target.value)} onBlur={handleEmailBlur} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} hint={errors.password ? undefined : "8+ characters with letters and numbers"}>
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} className="pr-12" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-ink/5" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}
            </button>
          </div>
          {password && (
            <div className="mt-2 flex items-center gap-2" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3].map((i) => (
                  <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= level ? LEVELS[level].bar : "bg-ink/10")} />
                ))}
              </div>
              <span className="w-16 text-right text-xs font-semibold text-muted">{LEVELS[level].label}</span>
            </div>
          )}
        </Field>
        <Button type="submit" full size="lg" loading={loading} icon={<ArrowRightIcon size={18} weight="bold" />}>
          Create account
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
