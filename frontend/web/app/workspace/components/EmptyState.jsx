function EmptyState() {
    return (
        <div className="flex w-full flex-col items-center justify-center px-4 py-12 text-center md:py-16">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-background">
                <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary"
                >
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                </svg>
            </div>

            <h3 className="text-lg font-semibold text-on-surface">
                No audio files yet
            </h3>

            <p className="mt-2 max-w-md text-sm text-on-surface-variant">
                Create your first audio project to start uploading, recording and processing audio files with Lucid.
            </p>
        </div>
    );
}

export default EmptyState;