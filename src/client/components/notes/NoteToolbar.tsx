import { Chip } from "@/client/components/ui/Chip.tsx";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { DRINK_TYPE_LABELS, DRINK_TYPES, type DrinkType } from "@/shared/constants.ts";

type NoteToolbarProps = {
  qInput: string;
  setQInput: (value: string) => void;
  searchOpen: boolean;
  setSearchOpen: (value: boolean) => void;
  typeOpen: boolean;
  setTypeOpen: (value: boolean) => void;
  drinkType: DrinkType | undefined;
  clearDrinkType: () => void;
  selectDrinkType: (type: DrinkType) => void;
  ratingChipOn: boolean;
  toggleRatingMin: () => void;
};

export function NoteToolbar({
  qInput,
  setQInput,
  setSearchOpen,
  typeOpen,
  setTypeOpen,
  drinkType,
  clearDrinkType,
  selectDrinkType,
  ratingChipOn,
  toggleRatingMin,
}: NoteToolbarProps) {
  return (
    <>
      <div className="cellar-toolbar note-toolbar">
        <Input
          className="cellar-search-field"
          aria-label="銘柄・メモで検索"
          value={qInput}
          maxLength={100}
          placeholder="銘柄・メモで検索"
          onChange={(event) => {
            setSearchOpen(true);
            setQInput(event.target.value);
          }}
        />
        {drinkType ? (
          <Chip selected onSelect={clearDrinkType}>
            {DRINK_TYPE_LABELS[drinkType]} ×
          </Chip>
        ) : (
          <Chip selected={typeOpen} onSelect={() => setTypeOpen(true)}>
            種類 ▼
          </Chip>
        )}
        <Chip selected={ratingChipOn} onSelect={toggleRatingMin}>
          ★4 以上
        </Chip>
      </div>
      <DialogRoot open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent className="cellar-type-dialog">
          <DialogTitle>種類</DialogTitle>
          <DialogDescription className="visually-hidden">1 種類で絞り込みます</DialogDescription>
          <div className="chip-row chip-row-wrap">
            {DRINK_TYPES.map((type) => (
              <Chip key={type} selected={drinkType === type} onSelect={() => selectDrinkType(type)}>
                {DRINK_TYPE_LABELS[type]}
              </Chip>
            ))}
          </div>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
