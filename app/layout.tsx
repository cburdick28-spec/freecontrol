import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "freecontrol · a world that runs without you",
  description: "A planet that evolves, builds nations, and goes to war on its own, one century every hour. You get one move a day.",
};
export const viewport: Viewport = { themeColor: "#0b0f17" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
