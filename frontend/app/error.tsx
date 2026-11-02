"use client";
import { useEffect } from "react";
import { ErrorState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="bg-dots flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md">
        <ErrorState title="Something broke on this screen" error={error} onRetry={reset} action={<Button size="sm" variant="secondary" href="/">Go home</Button>} />
      </div>
    </div>
  );
}
