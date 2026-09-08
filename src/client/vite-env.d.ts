/// <reference types="vite/client" />

interface Window {
  __alcoEarlyFetch?: {
    put(key: string, pending: Promise<Response>): void;
    take(key: string): Promise<Response> | undefined;
  };
}
