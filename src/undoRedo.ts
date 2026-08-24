import { createContext, useCallback, useMemo, useState } from "react";

export type UndoCallback = () => Promise<void | null>;

export type DoCallback = () => Promise<UndoCallback | null>;

export function useUndoRedo(): [
  (dc: DoCallback) => Promise<boolean>,
  () => Promise<void>,
  () => Promise<void>,
  boolean,
  boolean,
  () => void
] {
  const [locked, setLocked] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<Array<[DoCallback, UndoCallback]>>(
    []
  );
  const [redoStack, setRedoStack] = useState<Array<DoCallback>>([]);

  const canUndo = useMemo(
    () => !locked && undoStack.length > 0,
    [locked, undoStack]
  );
  const canRedo = useMemo(
    () => !locked && redoStack.length > 0,
    [locked, redoStack]
  );

  const doIt = async (doCb: DoCallback, preserveRedo?: boolean): Promise<boolean> => {
    setLocked(true);
    try {
      const undo = await doCb();
      if (!undo) return false;

      setUndoStack([[doCb, undo], ...undoStack]);
      if (!preserveRedo) {
        setRedoStack([]);
      }
      return true;
    } finally {
      setLocked(false);
    }
  };

  const undo = async () => {
    if (locked) {
      throw new Error("undo invoked when existing operation in progress");
    }

    if (undoStack.length === 0) {
      throw new Error("undo invoked with no operations to undo");
    }

    setLocked(true);
    const [doCb, undoCb] = undoStack[0];
    try {
      const undone = await undoCb();
      if (undone === null) return;
      setUndoStack(undoStack.slice(1));
      setRedoStack([doCb, ...redoStack]);
    } finally {
      setLocked(false);
    }
  };

  const redo = async () => {
    if (locked) {
      throw new Error("redo invoked when existing operation in progress");
    }

    if (redoStack.length === 0) {
      throw new Error("redo invoked with no operations to redo");
    }

    const doCb = redoStack[0];
    const redone = await doIt(doCb, true);
    if (redone) setRedoStack(redoStack.slice(1));
  };

  const reset = useCallback(() => {
    setRedoStack([]);
    setUndoStack([]);
  }, []);

  return [doIt, undo, redo, canUndo, canRedo, reset];
}

export const UndoRedoContext = createContext<
  ((dc: DoCallback) => Promise<boolean>) | null
>(null);
