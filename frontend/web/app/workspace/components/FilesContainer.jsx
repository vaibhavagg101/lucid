function FilesContainer({ children }) {
    return (
        <div
            className="
                w-full
                rounded-3xl
                border
                border-outline/30
                glassmorphism-suface
                shadow-xs
                px-6
                py-4
            "
        >
            {children}
        </div>
    );
}

export default FilesContainer;