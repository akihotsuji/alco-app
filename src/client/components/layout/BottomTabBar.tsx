import { GlassWater, House, NotebookPen, Settings, Wine } from "lucide-react";
import type { ReactNode } from "react";
import { TABS, type TabDef, type TabId } from "@/client/lib/app-routes.ts";

type BottomTabBarProps = {
  activeTab: TabId | null;
  onSelect: (tab: TabDef) => void;
};

const ICONS: Record<TabId, ReactNode> = {
  home: <House size={20} aria-hidden />,
  cellar: <Wine size={20} aria-hidden />,
  log: <GlassWater size={26} aria-hidden />,
  notes: <NotebookPen size={20} aria-hidden />,
  settings: <Settings size={20} aria-hidden />,
};

export function BottomTabBar({ activeTab, onSelect }: BottomTabBarProps) {
  return (
    <nav className="tab-bar" aria-label="メイン">
      {TABS.map((tab) => {
        const current = tab.id === activeTab;
        if (tab.id === "log") {
          return (
            <button
              key={tab.id}
              type="button"
              className={current ? "tab-center is-current" : "tab-center"}
              aria-current={current ? "page" : undefined}
              aria-label={tab.label}
              onClick={() => onSelect(tab)}
            >
              <span className="tab-center-btn">{ICONS.log}</span>
              <span className="tab-label tab-center-label">{tab.label}</span>
            </button>
          );
        }
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
