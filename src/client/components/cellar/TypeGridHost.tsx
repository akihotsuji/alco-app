import { lazy, Suspense } from "react";
import { useTypeGrid } from "@/client/components/layout/type-grid-context.tsx";

const TypeGridOverlay = lazy(async () => {
  const { TypeGridOverlay: Overlay } = await import(
    "@/client/components/cellar/TypeGridOverlay.tsx"
  );
  return { default: Overlay };
});

export function TypeGridHost() {
  const { open } = useTypeGrid();
  if (!open) {
    return null;
  }
  return (
    <Suspense
      fallback={
        <div className="type-grid" role="status">
          <span className="visually-hidden">読み込み中</span>
        </div>
      }
    >
      <TypeGridOverlay />
    </Suspense>
  );
}
