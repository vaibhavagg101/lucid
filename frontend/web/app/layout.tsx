import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import Navbar from "./navbar/navbar";
import { AuthProvider } from "./context/auth-context";
import AuthGate from "./components/AuthGate";

const montserrat = Montserrat({ subsets: ["latin"] });

const description =
  "Audio deconstruction and music analysis web app for musicians.";

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://lucid.vaibhavaggarwal.dev"
);

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: "Home | LUCID",
  description,
  applicationName: "LUCID",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "LUCID",
    url: siteUrl,
    title: "LUCID",
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LUCID",
    description,
  },
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
