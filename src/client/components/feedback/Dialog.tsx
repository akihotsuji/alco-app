type DialogProps = {
  open: boolean;
  title: string;
  body: string;
  primaryLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onPrimary: () => void;
  onClose: () => void;
};

export function Dialog({
  open,
  title,
  body,
  primaryLabel,
  destructive = false,
  pending = false,
  onPrimary,
  onClose,
}: DialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="app-dialog-root">
      {destructive ? (
        <div className="app-dialog-scrim" />
      ) : (
        <button type="button" className="app-dialog-scrim" aria-label="閉じる" onClick={onClose} />
      )}
      <div
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
      >
        <h2 id="app-dialog-title" className="app-dialog-title">
          {title}
        </h2>
        <p className="app-dialog-body">{body}</p>
        <button
          type="button"
          className={destructive ? "btn-danger" : "btn-primary"}
          onClick={onPrimary}
          disabled={pending}
        >
          {pending ? "処理中" : primaryLabel}
        </button>
        <button type="button" className="btn-text" onClick={onClose} disabled={pending}>
          キャンセル
        </button>
      </div>
    </div>
  );
}
