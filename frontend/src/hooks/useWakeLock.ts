import { useEffect, useState } from "react";

/** Asks the browser to keep the screen on while `active` is true. */
export function useWakeLock(active: boolean) {
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active || !supported) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      if (lock && !lock.released) return;
      try {
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) {
          l.release().catch(() => {});
          return;
        }
        lock = l;
        setHeld(true);
        l.addEventListener("release", () => setHeld(false));
      } catch {
        setHeld(false);
      }
    }

    acquire();
    // The browser drops the lock whenever the page is hidden; take it again.
    const onVisible = () => {
      if (!document.hidden) acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [active, supported]);

  return { supported, held };
}