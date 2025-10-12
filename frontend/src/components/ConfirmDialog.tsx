// src/components/ConfirmDialog.tsx
import { ReactNode, useEffect } from "react";

type Props = {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title = "Confirm",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="mt-2 text-sm text-gray-600">{message}</div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelText}
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Processing…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
