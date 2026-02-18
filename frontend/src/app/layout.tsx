import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { ConditionalAppShell } from "@/components/layout/ConditionalAppShell";

export const metadata: Metadata = {
  title: "HF Copy Trader",
  description: "High-Frequency Copy Trading Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <Providers>
          <ConditionalAppShell>
            {children}
          </ConditionalAppShell>
        </Providers>
      </body>
    </html>
  );
}
