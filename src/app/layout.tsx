import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SettingsBootstrap from "./SettingsBootstrap";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "optional" });

export const metadata: Metadata = {
  title: "MILA HMI",
  description: "In-car head-unit interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body style={{ margin: 0, padding: 0 }}>
        <SettingsBootstrap />
        {children}
      </body>
    </html>
  );
}
