import { createPortal } from 'react-dom';

// In-app replacement for window.confirm, which silently returns false once a user disables page prompts.
function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }) {
    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-100 flex items-center justify-center bg-on-background/30 backdrop-blur-sm"
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="w-[90%] max-w-sm rounded-2xl bg-surface p-6 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
                <p className="mt-2 text-sm text-on-surface-variant">{message}</p>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="cursor-pointer rounded-lg border border-outline/30 px-4 py-2 text-sm font-medium text-on-surface"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="cursor-pointer rounded-lg border border-error bg-error px-4 py-2 text-sm font-medium text-on-error transition-colors hover:bg-error/90"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default ConfirmDialog;
