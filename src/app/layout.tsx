import type { Metadata } from "next";
import SettingsBootstrap from "./SettingsBootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "MILA HMI",
  description: "In-car head-unit interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0, padding: 0 }}>
        <SettingsBootstrap />
        {children}
      </body>
    </html>
  );
}
