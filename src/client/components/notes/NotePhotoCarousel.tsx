import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import type { PhotoMeta } from "@/shared/photos.ts";

export function NotePhotoCarousel({ photos }: { photos: readonly PhotoMeta[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerIndexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setIndex(0);
  }, [photos]);

  useEffect(() => {
    if (!viewerOpen) {
      return;
    }
    const container = viewerRef.current;
    if (!container) {
      return;
    }
    container.scrollLeft = viewerIndexRef.current * container.clientWidth;
  }, [viewerOpen]);

  if (photos.length === 0) {
    return null;
  }

  function syncIndex(container: HTMLDivElement | null) {
    if (!container || container.clientWidth === 0) {
      return;
    }
    const next = Math.round(container.scrollLeft / container.clientWidth);
    setIndex(Math.min(photos.length - 1, Math.max(0, next)));
  }

  function scrollToIndex(container: HTMLDivElement | null, nextIndex: number) {
    if (!container) {
      return;
    }
    container.scrollTo({
      left: nextIndex * container.clientWidth,
      behavior: reduceMotion ? "auto" : "smooth",
    });
    setIndex(nextIndex);
  }

  return (
    <>
      <div className="note-photo-carousel">
        <div
          ref={scrollerRef}
          className="note-photo-carousel-scroller"
          onScroll={(event) => syncIndex(event.currentTarget)}
        >
          {photos.map((photo, photoIndex) => (
            <button
              key={photo.id}
              type="button"
              className="note-photo-carousel-slide"
              onClick={() => {
                viewerIndexRef.current = photoIndex;
                setIndex(photoIndex);
                setViewerOpen(true);
              }}
            >
              <img
                src={photoContentUrl(photo.id)}
                alt=""
                loading={photoIndex === 0 ? "eager" : "lazy"}
              />
            </button>
          ))}
        </div>
        {photos.length > 1 ? (
          <div className="note-photo-dots" aria-hidden>
            {photos.map((photo, photoIndex) => (
              <button
                key={photo.id}
                type="button"
                className={photoIndex === index ? "note-photo-dot is-on" : "note-photo-dot"}
                tabIndex={-1}
                onClick={() => scrollToIndex(scrollerRef.current, photoIndex)}
              />
            ))}
          </div>
        ) : null}
      </div>
      {viewerOpen ? (
        <div
          className="note-photo-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="写真"
          onClick={() => setViewerOpen(false)}
        >
          <div
            ref={viewerRef}
            className="note-photo-viewer-scroller"
            onScroll={(event) => syncIndex(event.currentTarget)}
            onClick={(event) => event.stopPropagation()}
          >
            {photos.map((photo, photoIndex) => (
              <div key={photo.id} className="note-photo-viewer-slide">
                <img
                  src={photoContentUrl(photo.id)}
                  alt=""
                  loading={photoIndex === index ? "eager" : "lazy"}
                />
              </div>
            ))}
          </div>
          <button type="button" className="note-photo-viewer-close" onClick={() => setViewerOpen(false)}>
            閉じる
          </button>
        </div>
      ) : null}
    </>
  );
}
