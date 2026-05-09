/** URL du JSON public (build spectateur déployé en Pages forge). */
export const PUBLIC_STATE_URL = import.meta.env.VITE_PUBLIC_STATE_URL as
  | string
  | undefined

export const isSpectatorMode = Boolean(
  PUBLIC_STATE_URL && PUBLIC_STATE_URL.length > 0,
)

export const PUBLIC_POLL_INTERVAL_MS = Number(
  import.meta.env.VITE_PUBLIC_POLL_INTERVAL_MS ?? 15_000,
)
