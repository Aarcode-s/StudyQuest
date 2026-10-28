type LockableOrientation = ScreenOrientation & {
  lock?: (o: string) => Promise<void>;
};

/**
 * Dock mode: fullscreen and sideways. Browsers only allow this from a tap,
 * so call it straight from the button's click handler. Where the phone or
 * browser refuses (for example iPhone), the dock still works upright.
 */
export async function enterDock(): Promise<void> {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    /* fullscreen not allowed here */
  }
  try {
    await (screen.orientation as LockableOrientation)?.lock?.("landscape");
  } catch {
    /* orientation lock not supported */
  }
}

export async function exitDock(): Promise<void> {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* ignore */
  }
}
