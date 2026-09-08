import { lazy, Suspense } from "react";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";

const PhotoEdit = lazy(async () => {
  const { PhotoEdit: Page } = await import("@/client/components/photo/PhotoEdit.tsx");
  return { default: Page };
});

export function PhotoEditHost() {
  const { open } = usePhotoEdit();
  if (!open) {
    return null;
  }
  return (
    <Suspense
      fallback={
        <div className="photo-edit" role="status">
          <span className="visually-hidden">読み込み中</span>
        </div>
      }
    >
      <PhotoEdit />
    </Suspense>
  );
}
