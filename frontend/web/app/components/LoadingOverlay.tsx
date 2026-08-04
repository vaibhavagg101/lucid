export default function LoadingOverlay() {
    return (
        <div className="main flex h-[calc(100vh-4rem)] w-full flex-col items-center justify-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-outline/30 border-t-primary" />
            <p className="text-sm text-on-surface-variant">Loading...</p>
        </div>
    );
}
