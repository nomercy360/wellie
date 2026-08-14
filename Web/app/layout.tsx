import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const description = "An adaptive training and nutrition coach built around real life.";
  return {
    metadataBase: base,
    title: { default: "Wellie", template: "%s · Wellie" },
    description,
    applicationName: "Wellie",
    icons: { icon: "/icon.png", apple: "/icon.png" },
    openGraph: { title: "Wellie", description, type: "website", images: [{ url: new URL("/og.png", base), width: 1536, height: 861, alt: "Wellie — a plan that adjusts to real life" }] },
    twitter: { card: "summary_large_image", title: "Wellie", description, images: [new URL("/og.png", base)] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f3ed",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
