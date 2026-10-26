import type { Metadata, Viewport } from "next";
import { Playfair_Display, Jost } from "next/font/google";
import { Toaster } from "sonner";
import { db } from "@/lib/db";
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

const FALLBACK_DESCRIPTION =
  "LN Jewellers crafts heirloom-quality 22K & 18K gold jewellery by hand in Jaipur — solitaires, temple chokers, jhumkas, bridal sets and one-of-one artisan pieces. BIS hallmarked, insured shipping, WhatsApp concierge.";

/**
 * Store-owner editable metadata (Admin → Store Settings → SEO & Meta).
 * Reads the settings row on each request; falls back to the built-in copy
 * whenever the DB is unreachable or fields are left empty.
 */
export async function generateMetadata(): Promise<Metadata> {
  let seo: { brandName: string; seoTitle: string; seoDescription: string; ogImageUrl: string } | null = null;
  try {
    seo = await db.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { brandName: true, seoTitle: true, seoDescription: true, ogImageUrl: true },
    });
  } catch {
    seo = null; // build-time / DB hiccup — static defaults
  }

  const brand = seo?.brandName || "LN Jewellers";
  const title = (seo?.seoTitle || "").trim() || `${brand} — Handcrafted 22K Gold Jewelry, Made in Jaipur`;
  const description = (seo?.seoDescription || "").trim() || FALLBACK_DESCRIPTION;
  const ogImage = (seo?.ogImageUrl || "").trim() || "/images/products/ring-solitaire.png";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s · ${brand}`,
    },
    description,
    keywords: [
      "gold jewelry", "handmade jewelry", "22K gold", "handcrafted", "bridal gold set",
      "temple jewellery", "Jaipur jewellers", "BIS hallmarked", "luxury jewellery",
    ],
    authors: [{ name: brand }],
    openGraph: {
      title,
      description,
      url: siteUrl,
      siteName: brand,
      type: "website",
      images: [{ url: ogImage, width: 1024, height: 1024, alt: `${brand} signature solitaire ring` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/images/brand/atelier.png", type: "image/png" }],
      apple: [{ url: "/images/brand/atelier.png", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      title: brand,
      statusBarStyle: "black-translucent",
    },
  };
}

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
