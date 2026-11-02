import Link from "next/link";
import { Zippy } from "@/components/art/Zippy";

export default function NotFound() {
  return (
    <div className="bg-dots flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Zippy mood="worried" size={140} />
      <p className="mt-6 font-display text-6xl font-extrabold">404</p>
      <h1 className="mt-2 text-2xl font-extrabold">This page took a wrong turn</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">Even our Trip Fixer Agent couldn&apos;t find it. Let&apos;s get you back on the route.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-full border-2 border-pill bg-pill px-5 py-2.5 text-sm font-semibold text-white shadow-[3px_3px_0_#7b5cf0]">
          Home
        </Link>
        <Link href="/discover" className="rounded-full border-2 border-ink bg-white px-5 py-2.5 text-sm font-semibold shadow-pop">
          Discover trips
        </Link>
      </div>
    </div>
  );
}
