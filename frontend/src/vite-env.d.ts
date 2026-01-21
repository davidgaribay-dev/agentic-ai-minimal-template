/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PORT: string;
  readonly VITE_API_URL: string;
  readonly VITE_ENABLE_TEST_IDS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
