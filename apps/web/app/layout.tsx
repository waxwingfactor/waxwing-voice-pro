import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waxwing Voice Pro",
  description: "AI leasing voice agent operations dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
