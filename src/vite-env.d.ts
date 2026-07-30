/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_ENABLE_LEGACY_API?: string
  readonly VITE_LEGACY_API_BASE_URL?: string
  readonly VITE_USE_API_FIXTURES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
