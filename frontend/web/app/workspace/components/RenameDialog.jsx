'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const FILE_NAME_REGEX = /^[a-zA-Z0-9.\-_()]+( [a-zA-Z0-9.\-_()]+)*$/;
const INVALID_NAME_MESSAGE = 'Invalid name. Please use 1-100 characters. Only letters, numbers, spaces, dots, dashes, underscores and parantheses are allowed.';

// In-app replacement for window.prompt, which silently returns null once a user disables page prompts.
function RenameDialog({ open, initialValue, onCancel, onRename }) {
    const [name, setName] = useState(initialValue ?? '');
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setName(initialValue ?? '');
            setError(null);
            setSaving(false);
        }
    }, [open, initialValue]);

    if (!open) return null;

    async function handleSubmit(event) {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed || trimmed.length > 100 || !FILE_NAME_REGEX.test(trimmed)) {
            setError(INVALID_NAME_MESSAGE);
            return;
        }

        setSaving(true);
        try {
            await onRename(trimmed);
        } catch (err) {
            setError('Failed to rename audio file.');
            setSaving(false);
        }
    }

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
                <h2 className="text-lg font-semibold text-on-surface">Rename audio file</h2>

                <form onSubmit={handleSubmit}>
                    <input
                        autoFocus
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Enter new name"
                        className="mt-4 w-full rounded-lg border border-outline/30 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                    />

                    {error && <p className="mt-2 text-sm text-error">{error}</p>}

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="cursor-pointer rounded-lg border border-outline/30 px-4 py-2 text-sm font-medium text-on-surface"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}

export default RenameDialog;
