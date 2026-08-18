function FilesContainer({ children }) {
    return (
        <div
            className="
                w-full
                rounded-3xl
                border
                border-outline/30
                glassmorphism-suface
                dark:bg-white/5
                dark:border
                dark:border-white/15
                shadow-xs
                px-4
                py-4
                sm:px-6
            "
        >
            {children}
        </div>
    );
}

export default FilesContainer;