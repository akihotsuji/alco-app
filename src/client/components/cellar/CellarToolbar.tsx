import { Chip } from "@/client/components/ui/Chip.tsx";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import type { CellarListView } from "@/shared/constants.ts";
import {
  CELLAR_LIST_VIEW_LABELS,
  CELLAR_LIST_VIEWS,
  DRINK_TYPE_LABELS,
  DRINK_TYPES,
  type DrinkType,
} from "@/shared/constants.ts";

type CellarToolbarProps = {
  listView: CellarListView;
  onListViewChange: (view: CellarListView) => void;
  hideViewToggle?: boolean;
  hideTypeFilter?: boolean;
  qInput: string;
  setQInput: (value: string) => void;
  searchOpen: boolean;
  setSearchOpen: (value: boolean) => void;
  typeOpen: boolean;
  setTypeOpen: (value: boolean) => void;
  drinkType: DrinkType | undefined;
  clearDrinkType: () => void;
  selectDrinkType: (type: DrinkType) => void;
};

export function CellarToolbar({
  listView,
  onListViewChange,
  hideViewToggle = false,
  hideTypeFilter = false,
  qInput,
  setQInput,
  setSearchOpen,
  typeOpen,
  setTypeOpen,
  drinkType,
  clearDrinkType,
  selectDrinkType,
}: CellarToolbarProps) {
  return (
    <>
      <div className="cellar-toolbar">
        {hideViewToggle ? null : (
          <fieldset className="cellar-view-toggle">
            <legend className="visually-hidden">表示切替</legend>
            {CELLAR_LIST_VIEWS.map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={listView === view}
                className={
                  listView === view
                    ? "cellar-view-toggle-option is-on"
                    : "cellar-view-toggle-option"
                }
                onClick={() => onListViewChange(view)}
              >
                {CELLAR_LIST_VIEW_LABELS[view]}
              </button>
            ))}
          </fieldset>
        )}
        <Input
          className="cellar-search-field"
          aria-label="品名・生産者・品種で検索"
          value={qInput}
          maxLength={100}
          placeholder="品名・生産者・品種"
          onChange={(event) => {
            setSearchOpen(true);
            setQInput(event.target.value);
          }}
        />
        {hideTypeFilter ? null : drinkType ? (
          <Chip selected onSelect={clearDrinkType}>
            {DRINK_TYPE_LABELS[drinkType]} ×
          </Chip>
        ) : (
          <Chip selected={typeOpen} onSelect={() => setTypeOpen(true)}>
            種類 ▼
          </Chip>
        )}
      </div>
      {hideTypeFilter ? null : (
        <DialogRoot open={typeOpen} onOpenChange={setTypeOpen}>
          <DialogContent className="cellar-type-dialog">
            <DialogTitle>種類</DialogTitle>
            <DialogDescription className="visually-hidden">1 種類で絞り込みます</DialogDescription>
            <div className="chip-row chip-row-wrap">
              {DRINK_TYPES.map((type) => (
                <Chip
                  key={type}
                  selected={drinkType === type}
                  onSelect={() => selectDrinkType(type)}
                >
                  {DRINK_TYPE_LABELS[type]}
                </Chip>
              ))}
            </div>
          </DialogContent>
        </DialogRoot>
      )}
    </>
  );
}
