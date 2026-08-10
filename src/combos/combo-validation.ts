import type { ComboConfig } from "../proto/combos";

export type ComboValidationResult =
  | { ok: true; normalized: ComboConfig }
  | { ok: false; message: string };

const INVALID_KEYS_MESSAGE = "2〜4個の異なるキーを選んでください";
const NEGATIVE_POSITION_MESSAGE = "キー位置は0以上にしてください";
const MISSING_BEHAVIOR_MESSAGE = "動作を選んでください";
const INVALID_TIMEOUT_MESSAGE = "タイムアウトは1〜1000msにしてください";
const DUPLICATE_COMBO_MESSAGE = "同じキーの組み合わせが同じレイヤー条件にあります";

export function validateComboDraft(
  draft: ComboConfig,
  existing: ComboConfig[],
): ComboValidationResult {
  const keyPositions = [...draft.keyPositions].sort((a, b) => a - b);

  if (
    keyPositions.length < 2 ||
    keyPositions.length > 4 ||
    new Set(keyPositions).size !== keyPositions.length
  ) {
    return { ok: false, message: INVALID_KEYS_MESSAGE };
  }

  if (keyPositions.some((position) => position < 0)) {
    return { ok: false, message: NEGATIVE_POSITION_MESSAGE };
  }

  if (!draft.binding) {
    return { ok: false, message: MISSING_BEHAVIOR_MESSAGE };
  }

  if (draft.timeoutMs < 1 || draft.timeoutMs > 1000) {
    return { ok: false, message: INVALID_TIMEOUT_MESSAGE };
  }

  const hasLayerConflict = existing.some((combo) =>
    combo.comboId !== draft.comboId &&
    hasSameKeys(keyPositions, combo.keyPositions) &&
    layerMasksOverlap(draft.layerMask, combo.layerMask),
  );

  if (hasLayerConflict) {
    return { ok: false, message: DUPLICATE_COMBO_MESSAGE };
  }

  return { ok: true, normalized: { ...draft, keyPositions } };
}

function hasSameKeys(sortedKeys: number[], keys: number[]): boolean {
  const sortedExistingKeys = [...keys].sort((a, b) => a - b);

  return sortedKeys.length === sortedExistingKeys.length &&
    sortedKeys.every((key, index) => key === sortedExistingKeys[index]);
}

function layerMasksOverlap(first: number, second: number): boolean {
  return first === 0 || second === 0 || (first & second) !== 0;
}
