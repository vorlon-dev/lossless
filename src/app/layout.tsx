import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Antra Flux — Hi-Res Lossless Streaming Platform",
  description:
    "Open, high-tech lossless streaming platform built on the Antra engine. Search, stream FLAC/ALAC in the browser, and serve hi-res audio endpoints for any music app. Deployable on Cloudflare for free.",
  keywords: [
    "lossless",
    "hi-res audio",
    "FLAC",
    "ALAC",
    "streaming platform",
    "Antra",
    "Cloudflare",
    "music API",
  ],
  authors: [{ name: "Antra Flux" }],
  openGraph: {
    title: "Antra Flux — Hi-Res Lossless Streaming Platform",
    description:
      "Search, stream lossless audio in the browser, and expose hi-res streaming endpoints for any music app.",
    siteName: "Antra Flux",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1416",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
