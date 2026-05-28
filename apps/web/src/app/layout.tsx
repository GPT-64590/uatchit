import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: { default: "uatchit", template: "%s — uatchit" },
  description: "Right-click any web page. Watch it forever.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_MARKETING_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000"
  ),
  openGraph: {
    title: "uatchit",
    description: "Right-click any web page. Watch it forever.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "uatchit",
    description: "Right-click any web page. Watch it forever.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="bg-bg-1 text-text antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
