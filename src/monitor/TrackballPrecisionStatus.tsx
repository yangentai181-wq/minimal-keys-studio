import { Gauge } from "lucide-react";

import { useTrackballPrecision } from "../trackball/TrackballPrecisionContext";

export function TrackballPrecisionStatus() {
  const { availability, confirmed } = useTrackballPrecision();

  if (availability !== "available" || !confirmed) return null;

  const mode = confirmed.precisionActive ? "精密" : "通常";

  return (
    <section
      aria-labelledby="trackball-precision-status-title"
      className="rounded-xl border border-base-300 bg-base-100 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="trackball-precision-status-title" className="flex items-center gap-1.5 text-sm font-semibold text-base-content">
          <Gauge className="h-4 w-4" aria-hidden="true" />
          トラックボール精密モード
        </h2>
        <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary">
          {mode}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-base-content/60">通常 CPI</dt>
          <dd className="mt-0.5 font-mono font-semibold text-base-content">{confirmed.normalCpi}</dd>
        </div>
        <div>
          <dt className="text-base-content/60">精密 CPI</dt>
          <dd className="mt-0.5 font-mono font-semibold text-base-content">{confirmed.precisionCpi}</dd>
        </div>
        <div>
          <dt className="text-base-content/60">現在の CPI</dt>
          <dd className="mt-0.5 font-mono font-semibold text-base-content">{confirmed.currentCpi}</dd>
        </div>
      </dl>
    </section>
  );
}
