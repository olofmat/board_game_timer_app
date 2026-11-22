/**
 * Keeps the installed app on the newest deployed version.
 *
 * The service worker serves the app from its cache, and the browser only
 * looks for a new one when the page is loaded from scratch. An app on the
 * home screen is usually resumed rather than reloaded, so on its own it
 * could keep running an old version for days. So this asks for an update
 * whenever the app comes back to the foreground (and hourly while it stays
 * open), and once a new version has taken over, reloads into it at a safe
 * moment: right away on the Home or Summary screen, otherwise as soon as
 * one of those is shown. A running Game or a half-filled Setup is never
 * reloaded under the user's fingers.
 */
import { registerSW } from "virtual:pwa-register";

const HOURLY = 60 * 60 * 1000;

let updateReady = false;
let atSafeScreen = false;

function reloadIfSafe() {
  if (updateReady && atSafeScreen) window.location.reload();
}

/** Tell the updater whether the screen now showing can be reloaded without losing anything. */
export function setSafeToReload(safe: boolean): void {
  atSafeScreen = safe;
  reloadIfSafe();
}

export function startUpdates(): void {
  registerSW({
    immediate: true,
    onNeedReload() {
      updateReady = true;
      reloadIfSafe();
    },
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      const check = async () => {
        if (registration.installing || !navigator.onLine) return;
        try {
          // Bypass the HTTP cache so a fresh deploy is seen straight away.
          const response = await fetch(swUrl, { cache: "no-store", headers: { "cache-control": "no-cache" } });
          if (response.ok) await registration.update();
        } catch {
          // Offline or the server is unreachable: try again next time.
        }
      };
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void check();
      });
      setInterval(() => void check(), HOURLY);
    },
  });
}
