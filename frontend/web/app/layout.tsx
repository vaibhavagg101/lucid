import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./navbar/navbar";
import { AuthProvider } from "./context/auth-context";

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
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <Navbar />
          <div>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
