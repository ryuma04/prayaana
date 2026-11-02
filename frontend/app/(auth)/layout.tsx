import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Zippy } from "@/components/art/Zippy";
import { DestinationArt } from "@/components/art/DestinationArt";
import { CarArt, JourneySequence } from "@/components/art/TravelVehicles";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-dots grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden border-r-2 border-ink bg-lavender lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Logo />
        <div className="relative z-10">
          <h2 className="max-w-md text-4xl font-extrabold leading-tight">Plan your own trip. We handle the changes.</h2>
          {/* Traveler journey progression: Man walking -> Car -> Plane in sequence */}
          <JourneySequence />
        </div>
        <div className="relative h-72 xl:h-80 w-full pt-2">
          {/* Enlarged mountain destination card */}
          <div className="absolute bottom-0 left-0 h-56 w-[350px] xl:h-64 xl:w-[410px] -rotate-2 overflow-hidden rounded-[32px] border-2 border-ink shadow-pop-lg transition hover:scale-[1.01]">
            <DestinationArt kind="mountain" />
          </div>

          {/* Enlarged beach destination card */}
          <div className="absolute bottom-6 left-52 xl:left-64 h-44 w-64 xl:h-52 xl:w-72 rotate-5 overflow-hidden rounded-[28px] border-2 border-ink shadow-pop-lg transition hover:scale-[1.01]">
            <DestinationArt kind="beach" />
          </div>

          {/* Travel car in foreground */}
          <div className="absolute -bottom-2 left-24 xl:left-32 z-30 transition-transform hover:-translate-y-1">
            <CarArt size={130} />
          </div>

          {/* Zippy Mascot */}
          <div className="absolute -top-6 right-4 xl:right-8 z-20 animate-float">
            <Zippy mood="wink" size={110} />
          </div>
        </div>
      </aside>
      <main id="main" className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between lg:justify-end">
          <span className="lg:hidden">
            <Logo />
          </span>
          <Link href="/" className="text-sm font-semibold text-muted hover:text-ink">
            ← Back to home
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">{children}</div>
      </main>
    </div>
  );
}
