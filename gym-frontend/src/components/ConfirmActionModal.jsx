import { AlertTriangle, X } from "lucide-react";

function ConfirmActionModal({
  isOpen,
  title = "Confirm action",
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:p-6">
      <div
        role="presentation"
        className="absolute inset-0"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        className="relative my-auto max-h-[calc(100dvh-2rem)] w-[min(100%,24rem)] overflow-y-auto rounded-2xl border border-classic-gold/20 bg-[#111111] p-4 shadow-2xl shadow-black/60 sm:max-h-[calc(100dvh-3rem)] sm:p-5"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close confirmation"
          className="absolute right-3 top-3 rounded-full p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="rounded-xl bg-red-500/10 p-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 id="confirm-action-title" className="font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-lg bg-red-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 sm:w-auto"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ConfirmActionModal;