function MainContainer({ children }) {
    return (
        <div
            className="
                w-full
                h-full
                mx-auto
                bg-surface
                rounded-2xl
                px-4
                py-6
                sm:px-6
                sm:py-8
                md:rounded-4xl
                md:px-10
                md:py-10
                lg:px-12
                lg:py-12
                shadow-sm
            "
        >
            {children}
        </div>
    );
}

export default MainContainer;