import {
  BatteryMedium,
  Bluetooth,
  Cable,
  Check,
  ChevronDown,
  CircleDot,
  Edit3,
  Eye,
  Gauge,
  Keyboard,
  Layers,
  MousePointer2,
  RotateCw,
  Save,
  SlidersHorizontal,
  Usb,
} from "lucide-react";

const layers = [
  { id: 0, name: "基本入力", state: "待機" },
  { id: 1, name: "ナビゲーション", state: "入力中" },
  { id: 2, name: "記号入力", state: "固定" },
  { id: 3, name: "数字入力", state: "待機" },
  { id: 4, name: "オートマウス", state: "自動" },
];

const keyRows = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", ";"],
  ["Z", "X", "C", "V", "B", "N", "M", "読点", "句点", "スラッシュ"],
  ["Command", "Lower", "Space", "Enter", "Raise", "Backspace", "Symbol", "Nav"],
];

const monitorEvents = [
  { label: "現在レイヤー", value: "記号入力", tone: "accent" },
  { label: "最新キー", value: "R4 / C8 スラッシュ", tone: "primary" },
  { label: "トラックボール", value: "dx +12 / dy -4", tone: "neutral" },
];

const fitChecks = [
  "リアルタイムモニター",
  "右手USBで接続中",
  "Studio RPC未確認",
  "オートマウス使用中",
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function StatusPill({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-8 max-w-full min-w-0 items-center gap-2 rounded-lg border px-3 text-xs font-bold",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-base-300 bg-white text-base-content/60",
      )}
      title={typeof children === "string" ? children : undefined}
    >
      {active && (
        <CircleDot className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0 truncate whitespace-nowrap">{children}</span>
    </span>
  );
}

function Keycap({
  label,
  active,
  selected,
}: {
  label: string;
  active?: boolean;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      className={cx(
        "keycap relative flex h-14 min-w-0 items-center justify-center rounded-lg border text-sm font-bold shadow-sm transition",
        selected
          ? "border-accent bg-orange-50 text-accent ring-2 ring-accent/20"
          : active
            ? "border-primary bg-primary text-primary-content"
            : "border-base-300 bg-white text-base-content hover:border-primary/50",
      )}
    >
      <span className="truncate px-1">{label}</span>
    </button>
  );
}

function KeyboardCanvas() {
  return (
    <section className="min-h-0 rounded-lg border border-base-300 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-accent">
            unified keyboard surface
          </p>
          <h2 className="text-lg font-bold text-base-content">
            エディタとモニタを同じ盤面で扱う
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill active>
            <Eye className="h-4 w-4" aria-hidden="true" />
            Monitor live
          </StatusPill>
          <StatusPill>
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            Edit selected
          </StatusPill>
        </div>
      </div>

      <div className="rounded-lg border border-base-300 bg-base-200 p-4">
        <div className="grid gap-2">
          {keyRows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={cx(
                "grid gap-2",
                rowIndex === 3
                  ? "grid-cols-8"
                  : "grid-cols-10",
              )}
            >
              {row.map((label) => (
                <Keycap
                  key={`${rowIndex}-${label}`}
                  label={label}
                  active={label === "NAV" || label === "SYM"}
                  selected={label === "スラッシュ"}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {monitorEvents.map((event) => (
          <div
            key={event.label}
            className="min-w-0 rounded-lg border border-base-300 bg-white px-4 py-3 shadow-sm"
          >
            <p className="truncate whitespace-nowrap text-xs text-base-content/50">
              {event.label}
            </p>
            <p
              className={cx(
                "mt-1 truncate whitespace-nowrap text-sm font-bold",
                event.tone === "accent"
                  ? "text-accent"
                  : event.tone === "primary"
                    ? "text-primary"
                    : "text-base-content",
              )}
            >
              {event.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LayerRail() {
  return (
    <aside className="rounded-lg border border-base-300 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="truncate whitespace-nowrap text-sm font-bold text-base-content">
          レイヤーモニター
        </h2>
      </div>
      <div className="space-y-2">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={cx(
              "flex items-center justify-between rounded-lg border px-3 py-2",
              layer.name === "記号入力"
                ? "border-primary/30 bg-primary/10"
                : "border-base-300 bg-white",
            )}
          >
            <div className="min-w-0">
              <p className="truncate whitespace-nowrap text-sm font-bold text-base-content">
                L{layer.id} {layer.name}
              </p>
              <p className="truncate whitespace-nowrap text-xs text-base-content/50">
                {layer.state}
              </p>
            </div>
            {layer.name === "記号入力" && (
              <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

function EditorPanel() {
  return (
    <aside className="rounded-lg border border-base-300 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate whitespace-nowrap text-xs font-bold uppercase text-accent">
            選択中のキー
          </p>
          <h2 className="truncate whitespace-nowrap text-base font-bold text-base-content">
            R3 / C9 スラッシュ
          </h2>
        </div>
        <span className="shrink-0 rounded-lg bg-orange-50 px-3 py-1 text-xs font-bold text-accent">
          記号
        </span>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="truncate whitespace-nowrap text-xs font-bold text-base-content/60">
            タップ時の割り当て
          </span>
          <button
            type="button"
            className="mt-1 flex h-12 w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-base-300 bg-white px-3 text-left text-sm font-bold text-base-content"
          >
            <span className="min-w-0 truncate whitespace-nowrap">
              KC_SLASH / スラッシュ
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-base-content/40" />
          </button>
        </label>
        <label className="block">
          <span className="truncate whitespace-nowrap text-xs font-bold text-base-content/60">
            ホールド時の動作
          </span>
          <button
            type="button"
            className="mt-1 flex h-12 w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-base-300 bg-white px-3 text-left text-sm font-bold text-base-content"
          >
            <span className="min-w-0 truncate whitespace-nowrap">
              レイヤー一時切替
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-base-content/40" />
          </button>
        </label>
      </div>

      <div className="mt-4 rounded-lg border border-base-300 bg-base-200 p-3">
        <p className="truncate whitespace-nowrap text-xs font-bold text-base-content/60">
          ライブ読み取り
        </p>
        <p className="mt-1 overflow-hidden text-sm leading-6 text-base-content">
          Raw HIDで現在レイヤーに追従。Studio RPCが使える時だけ編集を保存。
        </p>
      </div>
    </aside>
  );
}

function DeviceCard({
  icon,
  title,
  detail,
  active,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  active?: boolean;
}) {
  return (
    <div
      className={cx(
        "min-w-0 rounded-lg border px-4 py-3 shadow-sm",
        active ? "border-primary/30 bg-primary/10" : "border-base-300 bg-white",
      )}
    >
      <div
        className={cx(
          "flex min-w-0 items-center gap-2 text-sm font-bold",
          active ? "text-primary" : "text-base-content",
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 truncate whitespace-nowrap">{title}</span>
      </div>
      <p className="mt-1 truncate whitespace-nowrap text-xs text-base-content/60">
        {detail}
      </p>
    </div>
  );
}

function DeviceStrip() {
  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <DeviceCard
        active
        icon={<Usb className="h-4 w-4" aria-hidden="true" />}
        title="右手USBで接続中"
        detail="Raw HIDリアルタイム監視中"
      />
      <DeviceCard
        icon={<Cable className="h-4 w-4 text-accent" aria-hidden="true" />}
        title="Studio RPC未確認"
        detail="編集保存にはプローブが必要"
      />
      <DeviceCard
        icon={<Bluetooth className="h-4 w-4 text-primary" aria-hidden="true" />}
        title="BLEは補助接続"
        detail="USBが主導線"
      />
      <DeviceCard
        icon={<BatteryMedium className="h-4 w-4 text-success" aria-hidden="true" />}
        title="バッテリー表示"
        detail="右82% / 左76%"
      />
    </div>
  );
}

function TextFitStrip() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {fitChecks.map((label) => (
        <div
          key={label}
          className="flex h-10 min-w-0 items-center rounded-lg border border-base-300 bg-white px-3 text-xs font-bold text-base-content shadow-sm"
          title={label}
        >
          <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function UnifiedStudioPreview() {
  return (
    <div className="min-h-dvh bg-base-200 text-base-content">
      <header className="border-b border-base-300 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 lg:px-6">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}minimal-keys-logo.png`}
              alt="minimal-keys"
              className="h-11 w-11 rounded-lg"
            />
            <div>
              <p className="truncate whitespace-nowrap text-xs font-bold uppercase text-accent">
                minimal-keys studio
              </p>
              <h1 className="truncate whitespace-nowrap text-xl font-bold tracking-normal text-base-content">
                エディタ / モニタ統合
              </h1>
            </div>
          </div>
          <div className="flex rounded-lg border border-base-300 bg-base-200 p-1">
            <button
              type="button"
              className="flex h-10 min-w-0 items-center gap-2 rounded-md bg-white px-3 text-sm font-bold text-base-content shadow-sm"
            >
              <Eye className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate whitespace-nowrap">モニタ</span>
            </button>
            <button
              type="button"
              className="flex h-10 min-w-0 items-center gap-2 rounded-md px-3 text-sm font-bold text-base-content/60"
            >
              <Edit3 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate whitespace-nowrap">エディタ</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 pb-28 lg:grid-cols-[240px_minmax(0,1fr)_320px] lg:px-6 lg:pb-6">
        <div className="space-y-4 lg:col-span-3">
          <DeviceStrip />
          <TextFitStrip />
        </div>
        <LayerRail />
        <KeyboardCanvas />
        <EditorPanel />
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-base-300 bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "キー", icon: Keyboard, active: true },
            { label: "マウス", icon: MousePointer2 },
            { label: "回転", icon: RotateCw },
            { label: "設定", icon: SlidersHorizontal },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={cx(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs font-bold",
                  item.active
                    ? "bg-primary text-primary-content"
                    : "bg-base-200 text-base-content/60",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="max-w-full truncate whitespace-nowrap px-1">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="fixed bottom-24 right-4 hidden rounded-lg border border-base-300 bg-white px-4 py-3 shadow-sm lg:block">
        <div className="flex items-center gap-3">
          <Gauge className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <p className="truncate whitespace-nowrap text-xs font-bold text-base-content">
              監視 60 fps
            </p>
            <p className="truncate whitespace-nowrap text-xs text-base-content/50">
              Raw HID stream
            </p>
          </div>
          <button
            type="button"
            className="ml-2 flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-bold text-primary-content"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
