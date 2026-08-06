import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import Navbar from "./navbar/navbar";
import { AuthProvider } from "./context/auth-context";
import AuthGate from "./components/AuthGate";

const montserrat = Montserrat({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Home | LUCID",
  description: "Audio deconstruction and music analysis web app for musicians.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased`}
    >
      <body className={`${montserrat.className} min-h-full flex flex-col h-dvh`}>
        <AuthProvider>
          <div className="fixed top-0 w-full h-1.5 z-50 bg-primary"></div>
          <div className="fixed bottom-0 w-full h-2 z-50 bg-primary/75 md:hidden"></div>
          <Navbar />
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
