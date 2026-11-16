/**
 * FlowPro configuration values, by name.
 *
 * Two sources are merged, runtime over build time:
 *
 * - Build time: `VITE_FLOWPRO_*` variables that Vite inlines from `.env` files.
 *   This is what local development and the test runners use.
 * - Runtime: `window.__FLOWPRO_CONFIG__`, set by `/config.js` before the app
 *   loads. The container image serves that file from environment variables, so
 *   one published image can be configured per deployment without a rebuild.
 *
 * Empty runtime values are ignored, so an unset container variable falls back
 * to the build-time value or the app default.
 */
export type FlowProEnv = Record<string, string | undefined>

type RuntimeConfigHost = { __FLOWPRO_CONFIG__?: FlowProEnv }

export function getFlowProEnv(): FlowProEnv {
  const buildEnv = (import.meta as ImportMeta & { env?: FlowProEnv }).env ?? {}
  const runtimeEnv = (globalThis as RuntimeConfigHost).__FLOWPRO_CONFIG__ ?? {}

  const merged: FlowProEnv = { ...buildEnv }
  for (const [key, value] of Object.entries(runtimeEnv)) {
    if (typeof value === 'string' && value !== '') merged[key] = value
  }

  return merged
}
