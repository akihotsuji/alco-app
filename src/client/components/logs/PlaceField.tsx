import { MapPin } from "lucide-react";
import { FieldError, fieldDescribedBy } from "@/client/components/form/FieldError.tsx";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import {
  googleMapsSearchUrl,
  hasPlaceCoords,
  isSafeGoogleMapsHref,
  PLACE_NAME_MAX_LENGTH,
  PLACE_UI,
  placeMapsLinkLabel,
} from "@/shared/place.ts";

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
  const place = {
    placeName: placeName.trim() || null,
    placeLat,
    placeLng,
  };
  const href = googleMapsSearchUrl(place);
  const safeHref = href && isSafeGoogleMapsHref(href) ? href : null;
  const recorded = hasPlaceCoords(place);

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
        aria-describedby={fieldDescribedBy("log-place-name", error)}
        onChange={(event) => onChangeName(event.target.value)}
      />
      {recorded ? <p className="place-recorded">{PLACE_UI.recorded}</p> : null}
      {safeHref ? (
        <a className="place-maps-link" href={safeHref} target="_blank" rel="noreferrer">
          <MapPin size={16} aria-hidden />
          {placeMapsLinkLabel(place)}
        </a>
      ) : null}
      <FieldError id="log-place-name" error={error} />
    </section>
  );
}
