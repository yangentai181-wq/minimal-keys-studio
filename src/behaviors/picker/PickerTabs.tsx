import { useRef, useState } from "react";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { useOsMode } from "../../OsModeContext";
import { LettersTab } from "./LettersTab";
import { ActionsTab } from "./ActionsTab";
import { LayersTab } from "./LayersTab";
import { ModifiersTab } from "./ModifiersTab";
import { SystemTab } from "./SystemTab";
import { JapaneseTab } from "./JapaneseTab";

type TabId = "actions" | "letters" | "layers" | "modifiers" | "japanese" | "system";

interface PickerTabsProps {
  keyPosition: number;
  behaviors: GetBehaviorDetailsResponse[];
  layers: { id: number; index: number; name: string }[];
  onApplyBinding: (binding: BehaviorBinding) => void;
}

const tabs: { id: TabId; label: string }[] = [
  { id: "actions", label: "ショートカット" },
  { id: "letters", label: "文字・記号" },
  { id: "layers", label: "レイヤー" },
  { id: "modifiers", label: "修飾キー" },
  { id: "japanese", label: "日本語" },
  { id: "system", label: "システム" },
];

export function PickerTabs({
  keyPosition,
  behaviors,
  layers,
  onApplyBinding,
}: PickerTabsProps) {
  const { osMode } = useOsMode();
  const [activeTab, setActiveTab] = useState<TabId>("actions");
  const contentRef = useRef<HTMLDivElement>(null);

  function selectTab(tabId: TabId) {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    setActiveTab(tabId);
  }

  return (
    <div data-testid="picker-tabs" className="flex min-h-0 flex-1 flex-col gap-1.5">
      {/* Tab bar */}
      <div
        data-testid="picker-tab-bar"
        className="flex gap-0.5 overflow-x-auto rounded-lg bg-base-200 p-0.5"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-sm transition-all ${
              activeTab === tab.id
                ? "bg-white text-primary font-medium shadow-sm"
                : "text-base-content/50 hover:text-base-content"
            }`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        ref={contentRef}
        data-testid="picker-tab-content"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
      >
        <div key={activeTab} data-motion-state="enter" data-motion-view={activeTab}>
          {activeTab === "actions" && (
            <ActionsTab
              keyPosition={keyPosition}
              behaviors={behaviors}
              layers={layers}
              osMode={osMode}
              onApplyBinding={onApplyBinding}
            />
          )}
          {activeTab === "letters" && (
            <LettersTab behaviors={behaviors} onApplyBinding={onApplyBinding} />
          )}
          {activeTab === "layers" && (
            <LayersTab behaviors={behaviors} layers={layers} onApplyBinding={onApplyBinding} />
          )}
          {activeTab === "modifiers" && (
            <ModifiersTab behaviors={behaviors} layers={layers} osMode={osMode} onApplyBinding={onApplyBinding} />
          )}
          {activeTab === "japanese" && (
            <JapaneseTab behaviors={behaviors} osMode={osMode} onApplyBinding={onApplyBinding} />
          )}
          {activeTab === "system" && (
            <SystemTab behaviors={behaviors} onApplyBinding={onApplyBinding} />
          )}
        </div>
      </div>
    </div>
  );
}
