/**
 * Keep the screen awake with the Screen Wake Lock API, re-acquiring the
 * lock whenever the page becomes visible again (browsers drop it when the
 * page is hidden). Returns a function that releases it for good. Does
 * nothing where the API is unsupported or refused.
 */
export function keepScreenAwake(): () => void {
  let active = true;
  let sentinel: WakeLockSentinel | null = null;
  let pending = false;

  async function request() {
    const held = sentinel !== null && !sentinel.released;
    if (!active || held || pending || document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
    pending = true;
    try {
      const lock = await navigator.wakeLock.request("screen");
      if (active) sentinel = lock;
      else void lock.release();
    } catch {
      // Refused (e.g. battery saver): the screen may lock, the Game still works.
    } finally {
      pending = false;
    }
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") void request();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  void request();

  return () => {
    active = false;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    void sentinel?.release();
    sentinel = null;
  };
}
