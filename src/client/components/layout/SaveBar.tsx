import { Button } from "@/client/components/ui/button.tsx";

type SaveBarProps = {
  label?: string;
  pending?: boolean;
  disabled?: boolean;
  onSave: () => void;
};

export function SaveBar({
  label = "保存する",
  pending = false,
  disabled = false,
  onSave,
}: SaveBarProps) {
  return (
    <div className="save-bar">
      <Button type="button" onClick={onSave} disabled={disabled || pending}>
        {pending ? "保存中" : label}
      </Button>
    </div>
  );
}
