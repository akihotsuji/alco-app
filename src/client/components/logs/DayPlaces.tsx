import { MapPin } from "lucide-react";
import { isSafeGoogleMapsHref, PLACE_UI, type PlaceInput, placesForDay } from "@/shared/place.ts";

type DayPlacesProps = {
  items: readonly PlaceInput[];
};

export function DayPlaces({ items }: DayPlacesProps) {
  const places = placesForDay(items).filter((place) => isSafeGoogleMapsHref(place.href));
  if (places.length === 0) {
    return null;
  }

  const [only] = places;
  if (places.length === 1 && only) {
    return (
      <a className="log-day-place-link" href={only.href} target="_blank" rel="noreferrer">
        <MapPin size={20} aria-hidden />
        {PLACE_UI.dayHeading}
      </a>
    );
  }

  return (
    <section className="log-day-places" aria-labelledby="log-day-places-heading">
      <h2 id="log-day-places-heading" className="log-day-places-heading">
        {PLACE_UI.dayHeading}
      </h2>
      <ul className="log-day-places-list">
        {places.map((place) => (
          <li key={place.key}>
            <a className="log-day-place-link" href={place.href} target="_blank" rel="noreferrer">
              <MapPin size={20} aria-hidden />
              {place.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
