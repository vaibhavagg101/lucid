export default function WelcomeSection({ userName, onCreateAudio }) {
    return (
        <div className="w-full flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
                <h1 className="text-2xl font-bold text-on-surface">
                    Welcome back, {userName}!
                </h1>

                <p className="mt-2 text-base text-on-surface-variant">
                    Manage and view your audio files.
                </p>
            </div>

            <button
                onClick={onCreateAudio}
                className="
                    w-full
                    rounded-xl
                    bg-primary
                    px-6
                    py-3
                    text-sm
                    font-medium
                    text-on-primary
                    transition-colors
                    hover:bg-primary-variant
                    cursor-pointer
                    md:w-auto
                "
            >
                + Create New Audio
            </button>
        </div>
    );
}