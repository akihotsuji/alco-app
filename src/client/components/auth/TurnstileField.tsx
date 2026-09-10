import { useEffect, useRef } from "react";
import { TURNSTILE_SCRIPT_SRC } from "@/shared/turnstile.ts";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      language?: string;
      appearance?: "always";
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  const existing = (window as TurnstileWindow).turnstile;
  if (existing) {
    return Promise.resolve(existing);
  }
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", () => {
      const api = (window as TurnstileWindow).turnstile;
      if (!api) {
        reject(new Error("turnstile missing"));
        return;
      }
      resolve(api);
    });
    script.addEventListener("error", () => {
      scriptPromise = null;
      reject(new Error("turnstile script"));
    });
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function widgetTheme(): "light" | "dark" | "auto" {
  const theme = document.documentElement.getAttribute("data-theme");
  if (theme === "light" || theme === "dark") {
    return theme;
  }
  return "auto";
}

type TurnstileFieldProps = {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
  onLoadError?: () => void;
};

export function TurnstileField({ siteKey, onTokenChange, onLoadError }: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const onLoadErrorRef = useRef(onLoadError);
  onTokenChangeRef.current = onTokenChange;
  onLoadErrorRef.current = onLoadError;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let cancelled = false;
    let widgetId: string | null = null;
    let api: TurnstileApi | null = null;

    void loadTurnstile()
      .then((loaded) => {
        if (cancelled || !containerRef.current) {
          return;
        }
        api = loaded;
        widgetId = loaded.render(containerRef.current, {
          sitekey: siteKey,
          theme: widgetTheme(),
          language: "ja",
          appearance: "always",
          callback: (token) => {
            onTokenChangeRef.current(token);
          },
          "expired-callback": () => {
            onTokenChangeRef.current(null);
            if (widgetId) {
              loaded.reset(widgetId);
            }
          },
          "error-callback": () => {
            onTokenChangeRef.current(null);
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          onLoadErrorRef.current?.();
        }
      });

    return () => {
      cancelled = true;
      onTokenChangeRef.current(null);
      if (api && widgetId) {
        api.remove(widgetId);
      }
    };
  }, [siteKey]);

  return (
    <fieldset className="auth-turnstile">
      <legend className="sr-only">ボット対策の確認</legend>
      <div ref={containerRef} />
    </fieldset>
  );
}
