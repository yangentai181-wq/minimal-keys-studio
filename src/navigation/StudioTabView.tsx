/* eslint-disable react-refresh/only-export-components */
import { type ReactNode } from "react";
import {
  BatteryMedium,
  Bluetooth,
  Combine,
  Grid3x3,
  MousePointer2,
  RotateCw,
  SlidersHorizontal,
  Timer,
} from "lucide-react";
import type { StudioTabId } from "./StudioSessionNavigation";
import { useSlidingTabIndicator } from "./useSlidingTabIndicator";

export interface TabDef {
  id: StudioTabId;
  label: string;
  icon: ReactNode;
}

export interface TabGroup {
  tabs: TabDef[];
}

export const TAB_GROUPS: TabGroup[] = [
  {
    tabs: [
      {
        id: "keymap",
        label: "キーマップ",
        icon: <Grid3x3 className="h-4 w-4" />,
      },
      {
        id: "holdtap",
        label: "長押し設定",
        icon: <Timer className="h-4 w-4" />,
      },
      {
        id: "encoder",
        label: "エンコーダー",
        icon: <RotateCw className="h-4 w-4" />,
      },
      {
        id: "combo",
        label: "コンボ",
        icon: <Combine className="h-4 w-4" />,
      },
    ],
  },
  {
    tabs: [
      {
        id: "trackball",
        label: "トラックボール",
        icon: <MousePointer2 className="h-4 w-4" />,
      },
      {
        id: "bluetooth",
        label: "Bluetooth",
        icon: <Bluetooth className="h-4 w-4" />,
      },
      {
        id: "battery",
        label: "バッテリー",
        icon: <BatteryMedium className="h-4 w-4" />,
      },
      {
        id: "settings",
        label: "設定",
        icon: <SlidersHorizontal className="h-4 w-4" />,
      },
    ],
  },
];

export interface StudioTabViewProps {
  activeTab: StudioTabId;
  onSelectTab(tab: StudioTabId): void;
  renderTab(tab: StudioTabId): ReactNode;
}

export function StudioTabView({
  activeTab,
  onSelectTab,
  renderTab,
}: StudioTabViewProps): ReactNode {
  const { containerRef, registerItem, indicatorStyle } = useSlidingTabIndicator(activeTab);

  return (
    <>
      <nav
        ref={containerRef}
        className="relative flex items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-1"
      >
        <div
          aria-hidden="true"
          data-testid="studio-tab-indicator"
          className="motion-tab-indicator pointer-events-none absolute rounded-md bg-primary/10"
          style={indicatorStyle ?? undefined}
        />
        {TAB_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} className="flex items-center gap-0.5">
            {groupIndex > 0 && <div className="mx-2 h-6 w-px bg-gray-300" />}
            {group.tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                ref={registerItem(tab.id)}
                className={`relative z-10 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-all ${
                  activeTab === tab.id
                    ? "font-medium text-primary"
                    : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
                }`}
                onClick={() => onSelectTab(tab.id)}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div
        key={activeTab}
        data-testid="studio-tab-content"
        data-motion-view={activeTab}
        data-motion-state="enter"
        className="h-full min-h-0 overflow-hidden"
      >
        {renderTab(activeTab)}
      </div>
    </>
  );
}
