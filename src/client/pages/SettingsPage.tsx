import { ChevronRight } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { endSession } from "@/client/auth/end-session.ts";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { ListSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useFirstRunGuide } from "@/client/components/guide/first-run-guide-context.tsx";
import { GuideFanMenu } from "@/client/components/guide/GuideFanMenu.tsx";
import { DisplayNameRow } from "@/client/components/settings/DisplayNameRow.tsx";
import { HapticPrefRow } from "@/client/components/settings/HapticPrefRow.tsx";
import { RecordLocationPrefRow } from "@/client/components/settings/RecordLocationPrefRow.tsx";
import { ReduceMotionPrefRow } from "@/client/components/settings/ReduceMotionPrefRow.tsx";
import { ThemePrefRow } from "@/client/components/settings/ThemePrefRow.tsx";
import { Switch } from "@/client/components/ui/switch.tsx";
import { useMe } from "@/client/hooks/use-me.ts";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { needsGuideFanReveal } from "@/client/lib/guide-spotlight-layout.ts";
import {
  getCellarRecognizePref,
  getComposeMascotPref,
  setCellarRecognizePref,
  setComposeMascotPref,
} from "@/client/lib/preferences.ts";
import { APP_VERSION } from "@/shared/constants.ts";
import { legalHref } from "@/shared/legal.ts";
import { PWA_NAME } from "@/shared/pwa.ts";

export function SettingsPage() {
  const me = useMe();
  const guide = useFirstRunGuide();
  const reduceMotion = useReducedMotion();
  const fanAnchorRef = useRef<HTMLDivElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [composeMascot, setComposeMascot] = useState(getComposeMascotPref);
  const [recognize, setRecognize] = useState(getCellarRecognizePref);

  useLayoutEffect(() => {
    if (!guide.pickerOpen) {
      return;
    }
    const anchor = fanAnchorRef.current;
    if (!anchor) {
      return;
    }
    const content = document.querySelector(".app-content");
    const visible = (content ?? document.documentElement).getBoundingClientRect();
    const box = anchor.getBoundingClientRect();
    if (!needsGuideFanReveal({ top: box.top, bottom: box.bottom }, visible)) {
      return;
    }
    anchor.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [guide.pickerOpen, reduceMotion]);

  return (
    <div className="settings-page">
      <section className="settings-section">
        <h2 className="settings-heading">アカウント</h2>
        {me.isPending ? <ListSkeleton count={2} /> : null}
        {me.isError ? <QueryError onRetry={() => me.refetch()} retrying={me.isFetching} /> : null}
        {me.data ? (
          <div className="settings-group">
            <DisplayNameRow name={me.data.name} />
            <div className="settings-row settings-row-readonly">
              <span>メール</span>
              <span className="settings-value">{me.data.email}</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="settings-section">
        <h2 className="settings-heading">写真</h2>
        <div className="settings-group">
          <div className="settings-row settings-row-stack">
            <span className="settings-row-main">
              <span>新しい写真にキャラクターを入れる</span>
              <Switch
                label="新しい写真にキャラクターを入れる"
                checked={composeMascot}
                onChange={(value) => {
                  setComposeMascot(value);
                  setComposeMascotPref(value);
                }}
              />
            </span>
            <span className="settings-caption">
              これから追加する写真に適用されます。記録とノートの写真が対象です。
            </span>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-heading">セラー</h2>
        <div className="settings-group">
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
            <span className="settings-caption">写真から銘柄などを自動入力します</span>
          </div>
          <div className="settings-ai-note">
            <p className="settings-caption">
              自動入力では、写真を外部のAIサービスに送信して解析します。オフにしても、写真の切り抜きや手入力は使えます。記録・ノートの自動入力はこの設定の対象外です。
            </p>
            <Link className="settings-ai-link" to={legalHref("/privacy", "settings")}>
              送信する情報・送信先について
            </Link>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-heading">記録</h2>
        <div className="settings-group">
          <RecordLocationPrefRow />
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-heading">表示</h2>
        <div className="settings-group">
          <ThemePrefRow />
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-heading">操作</h2>
        <div className="settings-group">
          <HapticPrefRow />
          <ReduceMotionPrefRow />
          <div ref={fanAnchorRef} className="guide-fan-anchor">
            <button type="button" className="settings-row" onClick={guide.openPicker}>
              使い方を見る
            </button>
            <GuideFanMenu onSelect={guide.startTour} />
          </div>
        </div>
        <button
          type="button"
          className="settings-row settings-logout"
          onClick={() => setConfirmOpen(true)}
        >
          ログアウト
        </button>
      </section>

      <section className="settings-section">
        <h2 className="settings-heading">このアプリ</h2>
        <div className="settings-group">
          <Link className="settings-row" to={legalHref("/terms", "settings")}>
            <span>利用規約</span>
            <ChevronRight size={20} className="settings-chevron" aria-hidden />
          </Link>
          <Link className="settings-row" to={legalHref("/privacy", "settings")}>
            <span>プライバシーポリシー</span>
            <ChevronRight size={20} className="settings-chevron" aria-hidden />
          </Link>
        </div>
      </section>

      <p className="settings-note">
        {PWA_NAME} {APP_VERSION}
      </p>

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
