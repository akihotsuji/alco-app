export type GeoPosition = {
  lat: number;
  lng: number;
};

export type GeolocationPermission = "granted" | "denied" | "prompt" | "unknown";

export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.geolocation);
}

export function recordLocationCaption(
  supported: boolean,
  permission: GeolocationPermission,
): string {
  if (!supported) {
    return "この端末では使えません";
  }
  if (permission === "denied") {
    return "端末の設定で位置情報を許可してください";
  }
  return "新規の記録で現在地を残します";
}

export async function queryGeolocationPermission(): Promise<GeolocationPermission> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return "unknown";
    }
    const status = await navigator.permissions.query({ name: "geolocation" });
    if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
      return status.state;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

/** 失敗・拒否・非対応は null。座標はログに出さない */
export function requestCurrentPosition(): Promise<GeoPosition | null> {
  if (!isGeolocationSupported()) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  });
}
