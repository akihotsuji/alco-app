import { Plus } from "lucide-react";
import { Link } from "react-router";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import type { AddFab as AddFabDef } from "@/client/lib/app-routes.ts";

type AddFabProps = {
  fab: AddFabDef;
};

/** セラー一覧とノート一覧の右下「＋」（00-common 1.4）。親指が届く位置。primary にはしない */
export function AddFab({ fab }: AddFabProps) {
  return (
    <IconButton label={fab.label} size="icon-lg" className="add-fab" asChild>
      <Link to={fab.to}>
        <Plus size={24} />
      </Link>
    </IconButton>
  );
}
