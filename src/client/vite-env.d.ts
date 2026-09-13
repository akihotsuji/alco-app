/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_BUILD_ID?: string;
}

interface WindowEventMap {
  "vite:preloadError": Event;
}

interface Window {
  __alcoEarlyFetch?: {
    put(key: string, pending: Promise<Response>): void;
    take(key: string): Promise<Response> | undefined;
  };
  __alcoMarkBootReady?: () => void;
}
