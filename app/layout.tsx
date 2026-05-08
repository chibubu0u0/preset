import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eric Tone Dataset Builder",
  description: "Upload tone pairs, generate Lightroom recipes, and classify style families."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
