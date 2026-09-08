import { Plus } from "lucide-react";
import { Link } from "react-router";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import type { AddFab as AddFabDef } from "@/client/lib/app-routes.ts";

type AddFabProps = {
  fab: AddFabDef;
};

/** セラー一覧とノート一覧の右下「＋」（00-common 1.4）。親指が届く位置。primary にはしない */
export function AddFab({ fab }: AddFabProps) {
  const guide = useFirstRunGuide();
  const cellar = fab.to.startsWith("/cellar");
  const intercept = cellar
    ? guide.interceptCellarAdd
      ? guide.onCellarAdd
      : undefined
    : guide.interceptNotesCreate
      ? guide.onNotesCreate
      : undefined;
  const target = cellar ? "cellar-add" : "notes-create";

  return (
    <IconButton label={fab.label} size="icon-lg" className="add-fab" asChild>
      <Link
        to={fab.to}
        data-guide-target={intercept ? target : undefined}
        onClick={(event) => {
          if (intercept) {
            event.preventDefault();
            intercept();
          }
        }}
      >
        <Plus size={24} />
      </Link>
    </IconButton>
  );
}
