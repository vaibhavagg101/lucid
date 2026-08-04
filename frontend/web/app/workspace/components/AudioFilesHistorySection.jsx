import FilesContainer from './FilesContainer';
import EmptyState from './EmptyState';
import { useRouter } from 'next/navigation';
function AudioFilesHistorySection({
    files,
    loading,
    error,
    onRename,
}) {
    const router = useRouter();

    return (
        <section className="mt-10 w-full">
            <h2 className="mb-4 text-xl font-semibold text-on-surface">
                Your Audio Files
            </h2>

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
                    {files.map((file) => (
                        <FilesContainer key={file.id}>
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="wrap-break-word text-sm font-medium text-on-surface">
                                        {file.filename}
                                    </p>

                                    <span className="mt-2 inline-block rounded-full bg-surface-variant px-3 py-1 text-xs font-medium text-on-surface-variant">
                                        {file.filetype}
                                    </span>
                                    
                                    {file.key && (
                                        <span className="mt-2 inline-block rounded-full bg-surface-variant px-3 py-1 text-xs font-medium text-on-surface-variant">
                                            {file.key}
                                        </span>
                                    )}
        
                                    {file.channels && (
                                        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-variant px-3 py-1 text-xs font-medium text-on-surface-variant">
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

                                    <span className="mt-2 inline-block rounded-full bg-surface-variant px-3 py-1 text-xs font-medium text-on-surface-variant">
                                        {file.frame_rate} Hz
                                    </span>

                                    <span className="mt-2 inline-block rounded-full bg-surface-variant px-3 py-1 text-xs font-medium text-on-surface-variant">
                                        {file.sample_width * 8} bits
                                    </span>
                                </div>

                                <div className="flex items-center gap-3 sm:shrink-0">
                                    <button
                                        onClick={() => router.push(`/workspace/audio/${file.id}`)}
                                        className="
                                            rounded-lg
                                            border
                                            border-outline/30
                                            px-4
                                            py-2
                                            text-sm
                                            font-medium
                                            text-on-surface
                                        "
                                    >
                                        View
                                    </button>

                                    <button
                                        onClick={() => onRename(file.id)}
                                        className="
                                            rounded-lg
                                            border
                                            border-outline/30
                                            px-4
                                            py-2
                                            text-sm
                                            font-medium
                                            text-on-surface
                                        "
                                    >
                                        Rename
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