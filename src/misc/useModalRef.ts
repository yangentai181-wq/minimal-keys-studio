import { MutableRefObject, useEffect, useRef } from "react";
import { closeDialogWithMotion } from "./dialogMotion";

export function useModalRef(
  open: boolean,
  closeOnOutsideClick?: boolean,
  allowCancel?: boolean
): MutableRefObject<HTMLDialogElement | null> {
  const ref = useRef<HTMLDialogElement | null>(null);
  const pendingClose = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const closeWithMotion = () => {
      if (!dialog.open || pendingClose.current) return;
      pendingClose.current = closeDialogWithMotion(dialog);
    };

    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (allowCancel !== false) closeWithMotion();
    };

    if (open) {
      pendingClose.current?.();
      pendingClose.current = undefined;
      if (!dialog.open) {
        dialog.showModal();
      }
      dialog.setAttribute("data-motion-state", "enter");
      dialog.addEventListener("cancel", handleCancel);

      if (closeOnOutsideClick) {
        const handleClickOutside = (e: MouseEvent) => {
          const { top, left, width, height } = dialog.getBoundingClientRect();
          const clickedInDialog =
            top <= e.clientY &&
            e.clientY <= top + height &&
            left <= e.clientX &&
            e.clientX <= left + width;

          if (!clickedInDialog) {
            closeWithMotion();
          }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
          dialog.removeEventListener("cancel", handleCancel);
          pendingClose.current?.();
          pendingClose.current = undefined;
        };
      }
    } else {
      closeWithMotion();
    }

    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      pendingClose.current?.();
      pendingClose.current = undefined;
    };
  }, [open, closeOnOutsideClick, allowCancel]);

  return ref;
}
