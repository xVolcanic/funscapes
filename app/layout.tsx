import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Funscapes | Where Nairobi Comes to Play",
  description:
    "Discover Funscapes Two Rivers: outdoor rides, indoor adventures and family entertainment in Nairobi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
