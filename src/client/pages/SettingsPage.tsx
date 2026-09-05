import { useState } from "react";
import { endSession } from "@/client/auth/end-session.ts";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { ListSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useMe } from "@/client/hooks/use-me.ts";
import {
  getCellarRecognizePref,
  getColorCorrectionPref,
  getComposeMascotPref,
  setCellarRecognizePref,
  setColorCorrectionPref,
  setComposeMascotPref,
} from "@/client/lib/preferences.ts";
import { APP_VERSION } from "@/shared/constants.ts";

export function SettingsPage() {
  const me = useMe();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [composeMascot, setComposeMascot] = useState(getComposeMascotPref);
  const [colorCorrection, setColorCorrection] = useState(getColorCorrectionPref);
  const [recognize, setRecognize] = useState(getCellarRecognizePref);

  return (
    <div className="settings-page">
      <section className="settings-section">
        <h2 className="settings-heading">アカウント</h2>
        {me.isPending ? <ListSkeleton count={2} /> : null}
        {me.isError ? <QueryError onRetry={() => me.refetch()} retrying={me.isFetching} /> : null}
        {me.data ? (
          <>
            <div className="settings-row">
              <span>表示名</span>
              <span className="settings-value">{me.data.name || "未設定"}</span>
            </div>
            <div className="settings-row">
              <span>メール</span>
              <span className="settings-value">{me.data.email}</span>
            </div>
          </>
        ) : null}
      </section>

      <section className="settings-section">
        <h2 className="settings-heading">写真</h2>
        <div className="settings-row">
          <span>写真にキャラを入れる（既定）</span>
          <Switch
            label="写真にキャラを入れる（既定）"
            checked={composeMascot}
            onChange={(value) => {
              setComposeMascot(value);
              setComposeMascotPref(value);
            }}
          />
        </div>
        <div className="settings-row">
          <span>色補正を掛ける（既定）</span>
          <Switch
            label="色補正を掛ける（既定）"
            checked={colorCorrection}
            onChange={(value) => {
              setColorCorrection(value);
              setColorCorrectionPref(value);
            }}
          />
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-heading">セラー</h2>
        <div className="settings-row settings-row-stack">
          <span className="settings-row-main">
            <span>ラベルを自動で読み取る</span>
            <Switch
              label="ラベルを自動で読み取る"
              checked={recognize}
              onChange={(value) => {
                setRecognize(value);
                setCellarRecognizePref(value);
              }}
            />
          </span>
          <span className="settings-caption">写真を Cloudflare の AI に送ります</span>
        </div>
        <button
          type="button"
          className="settings-row settings-logout"
          onClick={() => setConfirmOpen(true)}
        >
          ログアウト
        </button>
      </section>

      <p className="settings-note">テーマは端末の外観設定に追従します</p>
      <p className="settings-note">alco-app {APP_VERSION}</p>

      <Dialog
        open={confirmOpen}
        title="ログアウト"
        body="ログアウトしますか"
        primaryLabel="ログアウト"
        destructive
        onPrimary={() => {
          setConfirmOpen(false);
          void endSession();
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      className={checked ? "switch is-on" : "switch"}
      onClick={() => onChange(!checked)}
    />
  );
}
