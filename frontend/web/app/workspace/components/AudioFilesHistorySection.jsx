import { useMemo, useState } from 'react';
import FilesContainer from './FilesContainer';
import EmptyState from './EmptyState';
import FingerprintThumbnail from './FingerprintThumbnail';
import { useRouter } from 'next/navigation';

const SORT_OPTIONS = [
    { key: 'date', label: 'Newest first' },
    { key: 'name', label: 'Name (A-Z)' },
];

function formatUploadedAt(uploadedAt) {
    const date = uploadedAt?.toDate?.();
    if (!date) return null;
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function AudioFilesHistorySection({
    files,
    loading,
    error,
    onRename,
    onDelete,
}) {
    const router = useRouter();
    const [sortBy, setSortBy] = useState('date');

    const sortedFiles = useMemo(() => {
        const filesCopy = [...files];
        if (sortBy === 'name') {
            filesCopy.sort((a, b) => a.filename.localeCompare(b.filename));
        } else {
            filesCopy.sort((a, b) => {
                const aTime = a.uploadedAt?.toDate?.()?.getTime() ?? 0;
                const bTime = b.uploadedAt?.toDate?.()?.getTime() ?? 0;
                return bTime - aTime;
            });
        }
        return filesCopy;
    }, [files, sortBy]);

    return (
        <section className="mt-10 w-full">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-on-surface">
                    Your Audio Files
                </h2>

                {!loading && !error && files.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-on-surface-variant">Sort by:</span>
                        {SORT_OPTIONS.map((option) => (
                            <button
                                key={option.key}
                                onClick={() => setSortBy(option.key)}
                                className={`
                                    cursor-pointer
                                    rounded-full
                                    border
                                    px-3
                                    py-1
                                    text-xs
                                    font-medium
                                    transition-colors
                                    ${sortBy === option.key
                                        ? 'border-primary bg-primary text-on-primary'
                                        : 'border-outline/30 text-on-surface-variant'
                                    }
                                `}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {loading ? (
                <FilesContainer>
                    <p className="text-sm text-on-surface-variant">
                        Loading your audio files...
                    </p>
                </FilesContainer>
            ) : error ? (
                <FilesContainer>
                    <p className="text-sm text-error">
                        {error}
                    </p>
                </FilesContainer>
            ) : files.length === 0 ? (
                <FilesContainer>
                    <EmptyState />
                </FilesContainer>
            ) : (
                <div className="flex flex-col gap-4">
                    {sortedFiles.map((file) => (
                        <FilesContainer key={file.id}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    {file.fingerprint_image_path && (
                                        <FingerprintThumbnail
                                            filepath={file.fingerprint_image_path}
                                            alt={`Audio fingerprint for ${file.filename}`}
                                        />
                                    )}

                                    <div className="min-w-0">
                                        <p className="wrap-break-word text-md py-2 font-medium leading-snug text-on-surface">
                                            {file.filename}
                                        </p>

                                        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                                            <span className="inline-flex items-center rounded-full bg-surface-variant px-2.5 py-1 text-xs font-medium text-on-surface-variant sm:px-3">
                                                {file.filetype}
                                            </span>

                                            {formatUploadedAt(file.uploadedAt) && (
                                                <span className="inline-flex items-center rounded-full bg-surface-variant px-2.5 py-1 text-xs font-medium text-on-surface-variant sm:px-3">
                                                    {formatUploadedAt(file.uploadedAt)}
                                                </span>
                                            )}

                                            {file.key && (
                                                <span className="inline-flex items-center rounded-full bg-surface-variant px-2.5 py-1 text-xs font-medium text-on-surface-variant sm:px-3">
                                                    {file.key}
                                                </span>
                                            )}

                                            {file.channels && (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-variant px-2.5 py-1 text-xs font-medium text-on-surface-variant sm:px-3">
                                                    {file.channels === 2 && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="8" cy="12" r="4" />
                                                            <circle cx="16" cy="12" r="4" />
                                                        </svg>
                                                    )}
                                                    {file.channels === 1 && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="4" />
                                                        </svg>
                                                    )}
                                                    {file.channels === 2 ? 'Stereo' : file.channels === 1 ? 'Mono' : `${file.channels} Channels`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-1 grid grid-cols-3 gap-2 border-t border-outline/20 pt-3 sm:mt-0 sm:flex sm:w-auto sm:shrink-0 sm:items-center sm:gap-3 sm:border-0 sm:pt-0">
                                    <button
                                        onClick={() => router.push(`/workspace/audio/${file.id}`)}
                                        className="
                                            flex
                                            w-full
                                            cursor-pointer
                                            items-center
                                            justify-center
                                            rounded-lg
                                            border
                                            border-outline/30
                                            px-3
                                            py-2
                                            text-sm
                                            font-medium
                                            text-on-surface
                                            transition-colors
                                            hover:bg-surface-variant
                                            dark:hover:bg-white/10
                                            dark:hover:border-white/20
                                            sm:w-auto
                                            sm:px-4
                                        "
                                    >
                                        View
                                    </button>

                                    <button
                                        onClick={() => onRename(file.id)}
                                        className="
                                            flex
                                            w-full
                                            cursor-pointer
                                            items-center
                                            justify-center
                                            rounded-lg
                                            border
                                            border-outline/30
                                            px-3
                                            py-2
                                            text-sm
                                            font-medium
                                            text-on-surface
                                            transition-colors
                                            hover:bg-surface-variant
                                            dark:hover:bg-white/10
                                            dark:hover:border-white/20
                                            sm:w-auto
                                            sm:px-4
                                        "
                                    >
                                        Rename
                                    </button>

                                    <button
                                        onClick={() => onDelete(file.id)}
                                        className="
                                            flex
                                            w-full
                                            cursor-pointer
                                            items-center
                                            justify-center
                                            rounded-lg
                                            border
                                            border-error
                                            px-3
                                            py-2
                                            text-sm
                                            font-medium
                                            text-error
                                            transition-colors
                                            hover:bg-error
                                            hover:text-on-error
                                            dark:hover:bg-error/20
                                            dark:hover:text-error
                                            sm:w-auto
                                            sm:px-4
                                        "
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </FilesContainer>
                    ))}
                </div>
            )}
        </section>
    );
}

export default AudioFilesHistorySection;