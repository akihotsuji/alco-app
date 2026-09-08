import { House, NotebookPen, Plus, Settings, Wine } from "lucide-react";
import type { ReactNode } from "react";
import { TABS, type TabDef, type TabId } from "@/client/lib/app-routes.ts";

type BottomTabBarProps = {
  activeTab: TabId | null;
  onSelect: (tab: TabDef) => void;
  /** 初回ガイドの記録 1/3。中央タブ円をスポットライトする */
  guideTarget?: string;
};

const ICONS: Record<TabId, ReactNode> = {
  home: <House size={20} aria-hidden />,
  cellar: <Wine size={20} aria-hidden />,
  log: <Plus size={26} aria-hidden />,
  notes: <NotebookPen size={20} aria-hidden />,
  settings: <Settings size={20} aria-hidden />,
};

export function BottomTabBar({ activeTab, onSelect, guideTarget }: BottomTabBarProps) {
  return (
    <nav className="tab-bar" aria-label="メイン">
      {TABS.map((tab) => {
        if (tab.root === null) {
          // 中央タブは「記録」作成ボタンで着地画面を持たないため、現在地ハイライトも aria-current も付けない
          return (
            <button
              key={tab.id}
              type="button"
              className="tab-center"
              aria-label="お酒を記録"
              onClick={() => onSelect(tab)}
            >
              <span className="tab-center-btn" data-guide-target={guideTarget}>
                {ICONS[tab.id]}
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
          >
            {ICONS[tab.id]}
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
