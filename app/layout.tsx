import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chibubu AI Lightroom Assistant",
  description: "Public Lightroom recipe assistant with an admin dataset builder."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
