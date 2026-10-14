"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  drawer?: boolean;
  /** Cannot be dismissed with Escape or a backdrop click. */
  locked?: boolean;
  children: ReactNode;
};

/** Native <dialog> shown with showModal(): focus trap, Escape and backdrop for free. */
export function Modal({ open, onClose, labelledBy, drawer, locked, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={drawer ? "drawer" : undefined}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={(e) => {
        if (locked) e.preventDefault();
      }}
      onClick={(e) => {
        if (!locked && e.target === ref.current) onClose();
      }}
    >
      {open ? children : null}
    </dialog>
  );
}
