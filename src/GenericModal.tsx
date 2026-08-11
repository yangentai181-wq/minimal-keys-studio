import React from "react";

export interface GenericModalProps {
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}

export const GenericModal = React.forwardRef(
  (
    { onClose, children, className = "" }: GenericModalProps,
    ref: React.Ref<HTMLDialogElement>,
  ) => {
    return (
      <dialog
        ref={ref}
        onClose={onClose}
        data-motion-kind="dialog"
        className={`rounded-2xl border border-base-300 bg-base-100 p-5 text-base-content shadow-xl backdrop:bg-base-200 ${className}`}
      >
        {children}
      </dialog>
    );
  },
);
