import { House, Plus, Settings, Users, Wine } from "lucide-react";
import type { ReactNode } from "react";
import { TABS, type TabDef, type TabId } from "@/client/lib/app-routes.ts";
import { prefetchTabPointerProps } from "@/client/lib/route-chunks.ts";

type BottomTabBarProps = {
  activeTab: TabId | null;
  onSelect: (tab: TabDef) => void;
  /** 初回ガイドの記録 1/3。中央タブ円をスポットライトする */
  guideTarget?: string;
  /** bottle-detail。中央タブの浮きを抑え他タブに近づける */
  quietCenter?: boolean;
};

const ICONS: Record<TabId, ReactNode> = {
  home: <House size={20} aria-hidden />,
  cellar: <Wine size={20} aria-hidden />,
  log: <Plus size={26} aria-hidden />,
  friends: <Users size={20} aria-hidden />,
  settings: <Settings size={20} aria-hidden />,
};

export function BottomTabBar({
  activeTab,
  onSelect,
  guideTarget,
  quietCenter = false,
}: BottomTabBarProps) {
  return (
    <nav className={quietCenter ? "tab-bar is-quiet-center" : "tab-bar"} aria-label="メイン">
      {TABS.map((tab) => {
        if (tab.root === null) {
          // 中央タブは「記録」作成ボタンで着地画面を持たないため、現在地ハイライトも aria-current も付けない
          return (
            <button
              key={tab.id}
              type="button"
              className="tab-center"
              aria-label={tab.label}
              onClick={() => onSelect(tab)}
              {...prefetchTabPointerProps(tab.id)}
            >
              <span className="tab-center-btn" data-guide-target={guideTarget}>
                {quietCenter ? <Plus size={20} aria-hidden /> : ICONS[tab.id]}
              </span>
              <span className="tab-label tab-center-label">{tab.label}</span>
            </button>
          );
        }
        const current = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            className={current ? "tab-item is-current" : "tab-item"}
            aria-current={current ? "page" : undefined}
            onClick={() => onSelect(tab)}
            {...prefetchTabPointerProps(tab.id)}
          >
            {ICONS[tab.id]}
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
