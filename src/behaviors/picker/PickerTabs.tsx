import { useRef, useState, type KeyboardEvent } from "react";
import type { GetBehaviorDetailsResponse } from "@zmkfirmware/zmk-studio-ts-client/behaviors";
import type { BehaviorBinding } from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { useOsMode } from "../../OsModeContext";
import { LettersTab } from "./LettersTab";
import { ActionsTab } from "./ActionsTab";
import { LayersTab } from "./LayersTab";
import { ModifiersTab } from "./ModifiersTab";
import { SystemTab } from "./SystemTab";
import { JapaneseTab } from "./JapaneseTab";
import type { TapKeyItem } from "./common-tap-keys";

type TabId = "actions" | "letters" | "layers" | "modifiers" | "japanese" | "system";

interface PickerTabsProps {
  keyPosition: number;
  behaviors: GetBehaviorDetailsResponse[];
  layers: { id: number; index: number; name: string }[];
  currentTapKey?: TapKeyItem;
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
  currentTapKey,
  onApplyBinding,
}: PickerTabsProps) {
  const { osMode } = useOsMode();
  const [activeTab, setActiveTab] = useState<TabId>("actions");
  const contentRef = useRef<HTMLDivElement>(null);

  function selectTab(tabId: TabId) {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    setActiveTab(tabId);
  }

  function handleContentKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.matches("input, select, textarea") || target.isContentEditable)
    ) {
      return;
    }

    const { currentTarget } = event;
    if (event.key === "Home") {
      event.preventDefault();
      currentTarget.scrollTop = 0;
    } else if (event.key === "PageDown") {
      event.preventDefault();
      currentTarget.scrollTop += currentTarget.clientHeight;
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      currentTarget.scrollTop += 40;
    }
  }

  return (
    <div data-testid="picker-tabs" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
      {/* Tab bar */}
      <div
        data-testid="picker-tab-bar"
        className="flex flex-wrap gap-0.5 rounded-lg bg-base-200 p-0.5"
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
        data-testid="picker-scroll-viewport"
        className="relative min-h-0 flex-1 overflow-hidden"
      >
        <div
          ref={contentRef}
          data-testid="picker-tab-content"
          role="region"
          aria-label="キー割り当て候補"
          tabIndex={0}
          onKeyDown={handleContentKeyDown}
          className="absolute inset-0 overflow-y-auto overscroll-contain pb-2.5 [scrollbar-gutter:stable]"
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
              <LayersTab
                behaviors={behaviors}
                layers={layers}
                osMode={osMode}
                currentTapKey={currentTapKey}
                onApplyBinding={onApplyBinding}
              />
            )}
            {activeTab === "modifiers" && (
              <ModifiersTab
                behaviors={behaviors}
                layers={layers}
                osMode={osMode}
                currentTapKey={currentTapKey}
                onApplyBinding={onApplyBinding}
              />
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
    </div>
  );
}
