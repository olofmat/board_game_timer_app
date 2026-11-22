import { APP_VERSION } from "./changelog";

/**
 * Short commit id of this build, so two builds of one version can be told
 * apart. The deploy workflow sets VITE_BUILD_COMMIT; local builds show "dev".
 */
export const BUILD_COMMIT: string = import.meta.env.VITE_BUILD_COMMIT?.slice(0, 7) || "dev";

/** The version as shown to users, e.g. "v1.2.0 · 3f2a9c1". */
export const VERSION_LABEL = `v${APP_VERSION} · ${BUILD_COMMIT}`;
