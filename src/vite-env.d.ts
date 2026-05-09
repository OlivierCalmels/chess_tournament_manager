/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_STATE_URL?: string
  readonly VITE_PUBLIC_POLL_INTERVAL_MS?: string
  readonly VITE_BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
