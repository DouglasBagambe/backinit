import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "BackInIt — Every moment matters",
    template: "%s · BackInIt",
  },
  description:
    "Discover live sport, follow scores and find your next match on BackInIt.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/brand/icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('backinit-theme')||'system';document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
