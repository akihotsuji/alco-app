import { z } from "zod";
import { IDENTITY_TEXT_MAX_LENGTH, identityTextSchema } from "./identity.ts";

/**
 * 飲酒記録の場所。URL は保存せず表示時にだけ生成する。
 * 正本: spec/features/register-identity.md 4
 */

export const PLACE_NAME_MAX_LENGTH = IDENTITY_TEXT_MAX_LENGTH;

export const PLACE_MESSAGES = {
  name: `${PLACE_NAME_MAX_LENGTH}文字以内で入力してください`,
  pair: "位置は緯度と経度を揃えて指定してください",
  lat: "緯度は-90以上90以下で入力してください",
  lng: "経度は-180以上180以下で入力してください",
} as const;

export const placeNameSchema = identityTextSchema;
export const optionalPlaceName = placeNameSchema.nullable().optional();

export const placeLatSchema = z
  .number({ error: PLACE_MESSAGES.lat })
  .min(-90, { error: PLACE_MESSAGES.lat })
  .max(90, { error: PLACE_MESSAGES.lat });

export const placeLngSchema = z
  .number({ error: PLACE_MESSAGES.lng })
  .min(-180, { error: PLACE_MESSAGES.lng })
  .max(180, { error: PLACE_MESSAGES.lng });

export const optionalPlaceLat = placeLatSchema.nullable().optional();
export const optionalPlaceLng = placeLngSchema.nullable().optional();

export type PlaceCoords = {
  placeLat?: number | null;
  placeLng?: number | null;
};

export type PlaceInput = PlaceCoords & {
  placeName?: string | null;
};

export const PLACE_UI = {
  recorded: "現在地を記録しました",
  formMapsWithCoords: "この場所を地図で見る",
  formMapsNameOnly: "この場所を地図で探す",
  dayHeading: "その日いた場所",
  dayUnnamed: "地図で見る",
} as const;

export type DayPlaceLink = {
  key: string;
  label: string;
  href: string;
};

export function hasPlaceCoords(
  input: PlaceInput,
): input is PlaceInput & { placeLat: number; placeLng: number } {
  return typeof input.placeLat === "number" && typeof input.placeLng === "number";
}

export function placeMapsLinkLabel(input: PlaceInput): string {
  return hasPlaceCoords(input) ? PLACE_UI.formMapsWithCoords : PLACE_UI.formMapsNameOnly;
}

function roundCoord(value: number): string {
  return value.toFixed(4);
}

export function placeDedupeKey(input: PlaceInput): string {
  const name = input.placeName?.trim() ?? "";
  if (hasPlaceCoords(input)) {
    return `${name}|${roundCoord(input.placeLat)}|${roundCoord(input.placeLng)}`;
  }
  return `name:${name}`;
}

/** 日別の「その日いた場所」。自前生成かつ安全な URL だけ返す */
export function placesForDay(items: readonly PlaceInput[]): DayPlaceLink[] {
  const seen = new Set<string>();
  const places: DayPlaceLink[] = [];
  for (const item of items) {
    const href = googleMapsSearchUrl(item);
    if (!href || !isSafeGoogleMapsHref(href)) {
      continue;
    }
    const key = placeDedupeKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const name = item.placeName?.trim() ?? "";
    places.push({
      key,
      label: name || PLACE_UI.dayUnnamed,
      href,
    });
  }
  return places;
}

export function placeCoordsArePaired(value: PlaceCoords): boolean {
  const hasLat = value.placeLat !== undefined && value.placeLat !== null;
  const hasLng = value.placeLng !== undefined && value.placeLng !== null;
  const latOmitted = value.placeLat === undefined;
  const lngOmitted = value.placeLng === undefined;
  if (latOmitted && lngOmitted) {
    return true;
  }
  if (value.placeLat === null && value.placeLng === null) {
    return true;
  }
  return hasLat && hasLng;
}

export function addPlacePairIssue(context: z.RefinementCtx): void {
  context.addIssue({ code: "custom", path: ["placeLat"], message: PLACE_MESSAGES.pair });
  context.addIssue({ code: "custom", path: ["placeLng"], message: PLACE_MESSAGES.pair });
}

const MAPS_HOSTS = new Set(["www.google.com", "maps.google.com"]);

export function googleMapsSearchUrl(input: {
  placeName?: string | null;
  placeLat?: number | null;
  placeLng?: number | null;
}): string | null {
  const lat = input.placeLat;
  const lng = input.placeLng;
  const query =
    lat !== null && lat !== undefined && lng !== null && lng !== undefined
      ? `${lat},${lng}`
      : (input.placeName?.trim() ?? "");
  if (query.length === 0) {
    return null;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** 自前生成 URL だけを描く。javascript: や任意ホストは拒否 */
export function isSafeGoogleMapsHref(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "https:" && MAPS_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}
