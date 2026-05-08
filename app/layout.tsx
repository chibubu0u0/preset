import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eric Tone Dataset Uploader",
  description: "Upload before/after photos, analyze tone style with AI, and save to Notion."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
