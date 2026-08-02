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