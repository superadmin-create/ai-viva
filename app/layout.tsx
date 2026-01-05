import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Viva",
  description: "AI-powered viva examination system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center">
              <Image
                src="/logo.png"
                alt="LeapUp Logo"
                width={120}
                height={36}
                priority
                className="h-auto"
              />
            </div>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}



