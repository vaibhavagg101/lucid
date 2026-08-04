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
          <Navbar />
          {/* <div className="h-[calc(100dvh-4rem)]"> */}
          <AuthGate>{children}</AuthGate>
          {/* </div> */}
        </AuthProvider>
      </body>
    </html>
  );
}
