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