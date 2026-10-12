import type { Metadata, Viewport } from "next";
import { Playfair_Display, Jost } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lnjewellers.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LN Jewellers — Handcrafted 22K Gold Jewelry, Made in Jaipur",
    template: "%s · LN Jewellers",
  },
  description:
    "LN Jewellers crafts heirloom-quality 22K & 18K gold jewellery by hand in Jaipur — solitaires, temple chokers, jhumkas, bridal sets and one-of-one artisan pieces. BIS hallmarked, insured shipping, WhatsApp concierge.",
  keywords: [
    "gold jewelry", "handmade jewelry", "22K gold", "handcrafted", "bridal gold set",
    "temple jewellery", "Jaipur jewellers", "BIS hallmarked", "luxury jewellery",
  ],
  authors: [{ name: "LN Jewellers" }],
  openGraph: {
    title: "LN Jewellers — Handcrafted Luxury Gold Jewelry",
    description:
      "Heirloom-quality 22K & 18K gold jewellery, handmade in Jaipur. BIS hallmarked. Insured shipping across India. Order via WhatsApp concierge.",
    url: siteUrl,
    siteName: "LN Jewellers",
    type: "website",
    images: [{ url: "/images/products/ring-solitaire.png", width: 1024, height: 1024, alt: "LN Jewellers signature solitaire ring" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LN Jewellers — Handcrafted Luxury Gold Jewelry",
    description: "Heirloom-quality 22K & 18K gold jewellery, handmade in Jaipur.",
    images: ["/images/products/ring-solitaire.png"],
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/images/brand/atelier.png", type: "image/png" }],
    apple: [{ url: "/images/brand/atelier.png", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "LN Jewellers",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${playfair.variable} ${jost.variable} font-sans antialiased`}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#0A0A0A",
              color: "#FAF7F0",
              border: "1px solid rgba(212,175,55,0.35)",
              borderRadius: "10px",
            },
          }}
        />
      </body>
    </html>
  );
}
