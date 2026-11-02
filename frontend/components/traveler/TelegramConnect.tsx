"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { TelegramLogoIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { errorMessage } from "@/lib/api/client";
import { connectTelegram, disconnectTelegram, getTelegramStatus, linkTelegramChat, sendTelegramTest, type TelegramStatus } from "@/lib/api/telegram";
import { toast } from "@/stores/notificationStore";

/**
 * Telegram account linking (Profile → Settings). Booking confirmations and
 * travel-document PDFs are delivered to the linked chat after payment.
 */
export function TelegramConnect() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [manualChatId, setManualChatId] = useState("5481196704");
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const s = await getTelegramStatus();
      if (alive.current) setStatus(s);
    } catch {
      /* keep the last known state */
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  const connect = async () => {
    setBusy(true);
    try {
      const { link } = await connectTelegram();
      window.open(link, "_blank", "noopener");
      toast({ tone: "info", title: "Press START in Telegram, then come back here" });
      // The bot stores the chat via /start; poll until the link completes.
      for (let i = 0; i < 12 && alive.current; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const s = await getTelegramStatus();
        if (s.connected) {
          if (alive.current) setStatus(s);
          toast({ tone: "success", title: "Telegram connected" });
          break;
        }
      }
    } catch (e) {
      toast({ tone: "error", title: errorMessage(e, "Couldn't start the Telegram connection.") });
    } finally {
      if (alive.current) setBusy(false);
      void refresh();
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      setStatus(await disconnectTelegram());
      toast({ tone: "success", title: "Telegram disconnected" });
    } catch (e) {
      toast({ tone: "error", title: errorMessage(e, "Couldn't disconnect Telegram.") });
    } finally {
      setBusy(false);
    }
  };

  const linkManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = manualChatId.trim();
    if (!id) return;
    setBusy(true);
    try {
      const s = await linkTelegramChat(id);
      setStatus(s);
      setManualChatId("");
      toast({ tone: "success", title: "Telegram connected successfully!" });
    } catch (e) {
      toast({ tone: "error", title: errorMessage(e, "Couldn't link Telegram Chat ID.") });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      await sendTelegramTest();
      toast({ tone: "success", title: "Test message sent — check Telegram" });
    } catch (e) {
      toast({ tone: "error", title: errorMessage(e, "Couldn't send the test message.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <TelegramLogoIcon size={18} weight="fill" className="text-purple" /> Telegram
          </p>
          <p className="text-xs text-muted">
            {status?.connected
              ? `Status: Connected ✓${status.chatId ? ` (ID: ${status.chatId})` : ""}${status.username ? ` · @${status.username}` : ""}`
              : "Status: Not connected · booking confirmations and travel documents"}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {status?.connected ? (
            <>
              <Button variant="secondary" size="sm" onClick={test} disabled={busy}>
                Send test message
              </Button>
              <Button variant="outline" size="sm" onClick={disconnect} disabled={busy}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={connect} loading={busy} disabled={busy || status?.available === false}>
              Connect via Telegram App
            </Button>
          )}
        </div>
      </div>

      {!status?.connected && (
        <form onSubmit={linkManual} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-canvas p-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">Or enter your Telegram Chat ID / Number directly:</p>
            <p className="text-[11px] text-muted">
              Open <b>@{status?.botUsername || "PrayaanaBot"}</b> on Telegram and tap START or send /id to get your Chat ID.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={manualChatId}
              onChange={(e) => setManualChatId(e.target.value)}
              placeholder="5481196704"
              className="h-8 w-36 rounded-md border border-line bg-white px-2.5 text-xs outline-none focus:ring-1 focus:ring-purple"
              disabled={busy}
            />
            <Button type="submit" size="sm" variant="secondary" disabled={!manualChatId.trim() || busy} loading={busy}>
              Link Chat ID
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
