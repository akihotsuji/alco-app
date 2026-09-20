import { Link } from "react-router";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import type { AddFab as AddFabDef } from "@/client/lib/app-routes.ts";
import { prefetchPath, prefetchRouteChunk } from "@/client/lib/route-chunks.ts";

type AddFabProps = {
  fab: AddFabDef;
};

/** セラー一覧とノート一覧の右下追加（00-common 1.4）。ピル＋文言。primary にはしない */
export function AddFab({ fab }: AddFabProps) {
  const guide = useFirstRunGuide();
  const intercept = guide.interceptCellarAdd ? guide.onCellarAdd : undefined;
  const target = "cellar-add";

  return (
    <Link
      className="add-fab"
      to={fab.to}
      aria-label={fab.label}
      data-guide-target={intercept ? target : undefined}
      onPointerEnter={() => {
        prefetchPath(fab.to);
        prefetchRouteChunk("photoEdit");
      }}
      onFocus={() => {
        prefetchPath(fab.to);
        prefetchRouteChunk("photoEdit");
      }}
      onClick={(event) => {
        if (intercept) {
          event.preventDefault();
          intercept();
        }
      }}
    >
      {fab.label}
    </Link>
  );
}
