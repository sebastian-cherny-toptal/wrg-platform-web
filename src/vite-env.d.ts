/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_USE_API_FIXTURES?: string
  readonly VITE_TEST_USERNAME_ENABLED?: string
  readonly VITE_TEST_USERNAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
