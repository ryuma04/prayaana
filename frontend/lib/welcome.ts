"use client";

/** Plays the welcome chime each time a traveler signs in or signs up (called only from those actions). */
export function playWelcome() {
  try {
    const audio = new Audio("/audio/welcome.mp3");
    audio.volume = 0.6;
    void audio.play().catch(() => undefined); // the browser may block sound; that's fine
  } catch {
    /* audio unavailable */
  }
}
