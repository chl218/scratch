import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// One family (SPEC §5): condensed for display, normal width for reading.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: { default: "ReferenceMePlzQQ", template: "%s · ReferenceMePlzQQ" },
  description: "A small photography studio: portfolio, team, booking, and private pages for choosing references.",
};

// Applies a saved light/dark choice before the first paint, so the page doesn't flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
