/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_USE_API_FIXTURES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
