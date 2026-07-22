import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Creator Studio — Premium AI Platform",
  description:
    "Your all-in-one AI platform for content creation, coding, and business. Chat with AI, generate prompts, create social media content, and more.",
  keywords: [
    "AI",
    "ChatGPT",
    "Telegram Bot",
    "Content Creation",
    "AI Prompts",
    "Video AI",
    "Image AI",
    "Coding AI",
    "Business AI",
  ],
  authors: [{ name: "AI Creator Studio" }],
  creator: "AI Creator Studio",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "AI Creator Studio",
    title: "AI Creator Studio — Premium AI Platform",
    description:
      "Your all-in-one AI platform for content creation, coding, and business.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Creator Studio",
    description:
      "Your all-in-one AI platform for content creation, coding, and business.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`min-h-screen bg-primary ${inter.variable} ${jetbrainsMono.variable} font-sans`}>{children}</body>
    </html>
  );
}
