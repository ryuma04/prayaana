"use client";
import { useState } from "react";
import { DownloadSimpleIcon, WifiSlashIcon, CheckCircleIcon, PrinterIcon } from "@phosphor-icons/react";
import type { Trip } from "@/types";
import { destinationMap } from "@/data/destinations";
import { stayMap, transportMap } from "@/data/stays";

import { Button } from "@/components/ui/Button";

import { addDays, formatDate } from "@/lib/format";
import { toast } from "@/stores/notificationStore";

const OFFLINE_KEY = "prayaana-offline-pass";

/** Offline Trip Pass — the essentials that must work with no network. */
export function TripPass({ trip }: { trip: Trip }) {
  const dest = destinationMap[trip.destinationId];
  const stay = stayMap[trip.stayId];
  const transport = transportMap[trip.transportId];
  const [saved, setSaved] = useState(() => {
    try {
      return typeof window !== "undefined" && JSON.parse(window.localStorage.getItem(OFFLINE_KEY) ?? "{}")?.id === trip.id;
    } catch {
      return false;
    }
  });

  const save = () => {
    try {
      window.localStorage.setItem(OFFLINE_KEY, JSON.stringify({ id: trip.id, code: trip.code, savedAt: new Date().toISOString(), trip }));
      setSaved(true);
      toast({ tone: "success", title: "Trip Pass saved offline", body: "Tickets, stay and SOS numbers now open without internet." });
    } catch {
      toast({ tone: "error", title: "Couldn't save offline", body: "Your browser storage is full or blocked." });
    }
  };

  return (
    <div className="overflow-hidden rounded-[30px] border-2 border-ink bg-ink text-white shadow-pop-lg">
      <div className="bg-speed relative bg-sun p-5 text-ink">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em]">Trip Pass</p>
            <p className="font-display text-2xl font-extrabold">{dest.name}</p>
            <p className="text-sm font-semibold">
              {formatDate(trip.prefs.startDate)} to {formatDate(addDays(trip.prefs.startDate, trip.prefs.nights))} · {trip.prefs.adults + trip.prefs.kids} travelers
            </p>
          </div>
        </div>
        <p className="mt-2 font-mono text-xs font-bold">{trip.code} · {trip.customerName}</p>
      </div>
      <div className="grid gap-3 p-5 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/50">Stay</p>
          <p className="font-semibold">{stay?.name}</p>
          <p className="text-xs text-white/60">{stay?.area}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/50">Getting there</p>
          <p className="font-semibold">{transport?.label}</p>
          <p className="text-xs text-white/60">Departs {transport?.departs}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-white/50">SOS</p>
          {dest.emergency.slice(0, 2).map((e) => (
            <p key={e.label} className="text-xs">
              {e.label}: <a href={`tel:${e.phone.replace(/\s/g, "")}`} className="font-semibold text-sun">{e.phone}</a>
            </p>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 p-4">
        <Button size="sm" variant={saved ? "success" : "outline"} className={saved ? "" : "bg-sun"} onClick={save} icon={saved ? <CheckCircleIcon size={16} weight="fill" /> : <DownloadSimpleIcon size={16} weight="bold" />}>
          {saved ? "Saved offline" : "Save offline"}
        </Button>
        <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => window.print()} icon={<PrinterIcon size={16} />}>
          Print
        </Button>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-white/60">
          <WifiSlashIcon size={13} /> Works without network
        </span>
      </div>
    </div>
  );
}
