function MainSectionContainer({ children }) {
    return (
        <main
            className="
                w-full
                min-h-[calc(100vh-4rem)]
                bg-background
                dark:bg-linear-to-b
                dark:from-primary-variant
                dark:to-black
                px-4
                py-6
                md:px-8
                md:py-8
                lg:px-12
                lg:py-10
            "
        >
            {children}
        </main>
    );
}

export default MainSectionContainer;