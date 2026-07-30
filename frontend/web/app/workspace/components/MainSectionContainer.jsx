function MainSectionContainer({ children }) {
    return (
        <main
            className="
                w-full
                min-h-[calc(100vh-4rem)]
                bg-background
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