"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRightIcon, EnvelopeSimpleOpenIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { resendCode, verifyEmail } from "@/lib/api/auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { useAuthStore } from "@/stores/authStore";
import { useQuizStore } from "@/stores/quizStore";
import { cn } from "@/lib/format";
import { playWelcome } from "@/lib/welcome";

const LENGTH = 6;
const COOLDOWN = 60;

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const pendingEmail = useAuthStore((s) => s.pendingEmail);
  const email = params.get("email") ?? pendingEmail ?? "";
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fromLogin = params.get("from") === "login";
  const notSent = params.get("sent") === "0";
  const [wait, setWait] = useState(fromLogin ? 0 : COOLDOWN);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, [email]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async (code: string) => {
    if (code.length !== LENGTH || loading) return;
    setLoading(true);
    setError(null);
    try {
      await verifyEmail(email, code);
      useQuizStore.getState().reset();
      playWelcome();
      router.push("/quiz");
    } catch (e) {
      setLoading(false);
      setError(errorMessage(e));
      if (e instanceof ApiError && e.code === "too_many_attempts") setWait(0);
      setDigits(Array(LENGTH).fill(""));
      inputs.current[0]?.focus();
    }
  };

  const fill = (from: number, text: string) => {
    const clean = text.replace(/\D/g, "").slice(0, LENGTH - from);
    if (!clean) return;
    const next = [...digits];
    clean.split("").forEach((d, i) => (next[from + i] = d));
    setDigits(next);
    inputs.current[Math.min(from + clean.length, LENGTH - 1)]?.focus();
    if (next.every(Boolean)) void submit(next.join(""));
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      const next = [...digits];
      next[i - 1] = "";
      setDigits(next);
      inputs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const resend = async () => {
    setError(null);
    try {
      await resendCode(email);
      setNotice("A new code is on its way. Check your inbox (and spam).");
      setWait(COOLDOWN);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (!email) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-extrabold">Which email should we confirm?</h1>
        <p className="mt-2 text-sm text-muted">Start from sign up or log in and we&apos;ll send you a code.</p>
        <Button className="mt-6" href="/signup">Create an account</Button>
      </div>
    );
  }

  return (
    <div>
      <motion.span initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} className="grid h-16 w-16 place-items-center rounded-[22px] border-2 border-ink bg-sun shadow-pop">
        <EnvelopeSimpleOpenIcon size={30} weight="duotone" />
      </motion.span>
      <h1 className="mt-5 text-3xl font-extrabold">Check your email</h1>
      <p className="mt-2 text-sm text-muted">
        {fromLogin ? "Your account isn't confirmed yet. Enter the 6-digit code we sent to " : "We sent a 6-digit code to "}
        <b className="text-ink">{email}</b>. {fromLogin ? "Lost it? Tap resend below." : "Enter it below, or tap the button in the email."}
      </p>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(digits.join(""));
        }}
      >
        <fieldset className="flex justify-between gap-2" aria-label="Verification code" disabled={loading}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              maxLength={LENGTH}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                if (v.length > 1) return fill(i, v);
                const next = [...digits];
                next[i] = v;
                setDigits(next);
                if (v && i < LENGTH - 1) inputs.current[i + 1]?.focus();
                if (next.every(Boolean)) void submit(next.join(""));
              }}
              onPaste={(e) => {
                e.preventDefault();
                fill(i, e.clipboardData.getData("text"));
              }}
              onKeyDown={(e) => onKey(i, e)}
              className={cn(
                "h-14 w-full min-w-0 rounded-2xl border-2 bg-white text-center font-display text-2xl font-extrabold outline-none transition focus:-translate-y-0.5 focus:shadow-pop sm:h-16",
                error ? "border-danger" : "border-ink",
              )}
            />
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {notice && !error && <p className="mt-3 text-sm font-medium text-success">{notice}</p>}
        <Button type="submit" full size="lg" className="mt-6" loading={loading} disabled={digits.some((d) => !d)} icon={<ArrowRightIcon size={18} weight="bold" />}>
          Verify and continue
        </Button>
      </form>

      {notSent && !notice && (
        <p className="mt-5 rounded-2xl bg-warning-soft px-3.5 py-2.5 text-xs font-semibold text-warning">We couldn&apos;t send the email just now. Tap resend in a minute.</p>
      )}


      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" onClick={() => void resend()} disabled={wait > 0} className="font-bold text-ink underline underline-offset-4 disabled:cursor-not-allowed disabled:text-muted disabled:no-underline">
          {wait > 0 ? `Resend code in ${wait}s` : "Resend code"}
        </button>
        <Link href="/signup" className="text-muted hover:text-ink">
          Wrong email?
        </Link>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}
