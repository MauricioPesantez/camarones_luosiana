import type { Metadata } from "next";
import "./globals.css";

import { UIProvider } from "@/presentation/components/ui";
import { SessionBar } from "@/presentation/components/containers/SessionBar";

export const metadata: Metadata = {
  title: "Camarones Louisiana",
  description: "Sistema de órdenes y caja para Camarones Louisiana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <UIProvider>
          <SessionBar />
          {children}
        </UIProvider>
      </body>
    </html>
  );
}
