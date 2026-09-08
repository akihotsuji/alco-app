import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { googleMapsSearchUrl, isSafeGoogleMapsHref, PLACE_NAME_MAX_LENGTH } from "@/shared/place.ts";

type PlaceFieldProps = {
  placeName: string;
  placeLat: number | null;
  placeLng: number | null;
  error?: string;
  onChangeName: (value: string) => void;
};

export function PlaceField({
  placeName,
  placeLat,
  placeLng,
  error,
  onChangeName,
}: PlaceFieldProps) {
  const href = googleMapsSearchUrl({
    placeName: placeName.trim() || null,
    placeLat,
    placeLng,
  });
  const safeHref = href && isSafeGoogleMapsHref(href) ? href : null;

  return (
    <section className="log-form-section">
      <FieldLabel htmlFor="log-place-name" optional>
        場所
      </FieldLabel>
      <Input
        id="log-place-name"
        value={placeName}
        maxLength={PLACE_NAME_MAX_LENGTH}
        placeholder="店名など"
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChangeName(event.target.value)}
      />
      {safeHref ? (
        <a className="place-maps-link" href={safeHref} target="_blank" rel="noreferrer">
          Google マップで開く
        </a>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
