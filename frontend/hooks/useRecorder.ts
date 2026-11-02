"use client";
import { useRef, useState } from "react";

/** Records a short voice note from the microphone. */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const media = useRef<{ rec: MediaRecorder; chunks: Blob[] } | null>(null);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start();
      media.current = { rec, chunks };
      setRecording(true);
    } catch {
      setError("Microphone is blocked. Allow it in your browser settings.");
    }
  };

  const stop = () =>
    new Promise<Blob | null>((resolve) => {
      const m = media.current;
      if (!m) return resolve(null);
      m.rec.onstop = () => {
        m.rec.stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(m.chunks, { type: m.rec.mimeType || "audio/webm" }));
      };
      m.rec.stop();
      media.current = null;
      setRecording(false);
    });

  return { recording, error, start, stop };
}
