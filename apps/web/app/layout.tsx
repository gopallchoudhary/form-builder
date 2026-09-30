import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { GlobalProviders } from "~/providers/global";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Streamyst",
  description: "Media Forwarding",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
     * `suppressHydrationWarning`, not decoration: `next-themes` writes the theme class onto
     * this element from an inline script before React hydrates, so the server's markup and the
     * client's first render disagree by design. Without it React logs a mismatch on every load.
     *
     * The hardcoded `className="dark"` that used to sit here is what forced the dark theme —
     * it overrode whatever the creator had chosen, and a toggle could not have worked while it
     * was present. Dark is still the default, but it comes from the provider now.
     */
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <GlobalProviders>{children}</GlobalProviders>
      </body>
    </html>
  );
}
