import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "BackInIt — Every moment matters",
    template: "%s · BackInIt",
  },
  description:
    "Your home for scores, match stories and the sports you love. Explore the BackInIt demo.",
  robots: { index: false, follow: false },
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
