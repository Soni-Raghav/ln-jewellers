"use client";

/**
 * SettingsManager — the store owner's full-control panel (round 14).
 * Every storefront behaviour that used to live in code is now editable here:
 * brand & contact, social/Google/WhatsApp connectivity, homepage hero copy,
 * announcement bar, section visibility, commerce maths, engraving,
 * appointments, long-form content, FAQ, testimonials, Instagram gallery and SEO.
 *
 * Organised as tabs; ONE "Save all changes" action persists everything via
 * PATCH /api/admin/settings (server validates + clamps every field).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  Globe,
  Home,
  Info,
  Instagram,
  KeyRound,
  LayoutGrid,
  Loader2,
  MessageSquareQuote,
  MessageCircle,
  Plus,
  ScrollText,
  Star,
  Store,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { StoreSettingsDTO } from "@/lib/types";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PRODUCT_IMAGE_LIBRARY, api, errMsg, isAuthError } from "./api";

type FaqRow = { q: string; a: string };
type TestimonialRow = { name: string; location: string; text: string; rating: string };

const DEFAULT_SETTINGS: StoreSettingsDTO = {
  brandName: "LN Jewellers",
  tagline: "Handcrafted Luxury Jewelry",
  whatsappNumber: "",
  email: "",
  phone: "",
  address: "",
  businessHours: "",
  instagramUrl: "",
  facebookUrl: "",
  pinterestUrl: "",
  youtubeUrl: "",
  shippingFee: 199,
  freeShippingAbove: 50000,
  taxRatePercent: 3,
  giftWrapFee: 500,
  engravingEnabled: true,
  engravingFee: 1500,
  engravingFeeScript: 2500,
  engravingFeeSans: 1800,
  appointmentVisitCapacity: 2,
  appointmentVideoCapacity: 2,
  aboutStory: "",
  missionVision: "",
  shippingPolicy: "",
  returnsPolicy: "",
  privacyPolicy: "",
  termsPolicy: "",
  faq: [],
  instagramGallery: [],
  testimonials: [],
  razorpayEnabled: false,
  // round 14 — connectivity
  googleReviewUrl: "",
  googleMapsUrl: "",
  googleRating: "",
  googleReviewCount: 0,
  whatsappFloatEnabled: true,
  whatsappDefaultMessage: "",
  instagramFeedEnabled: true,
  // round 15 — WhatsApp Cloud API
  waCloudPhoneId: "",
  waCloudTokenMasked: "",
  waCloudConnected: false,
  waAutoConfirm: true,
  // round 14 — homepage hero + announcement
  heroEyebrow: "",
  heroTitle: "",
  heroHighlight: "",
  heroSubtitle: "",
  heroCtaLabel: "",
  announcementEnabled: false,
  announcementText: "",
  // round 14 — homepage section toggles
  showCollectionsSection: true,
  showCategoriesSection: true,
  showNewArrivals: true,
  showBestSellers: true,
  showTrending: true,
  showHandmade: true,
  showTestimonials: true,
  showNewsletter: true,
  // round 14 — SEO
  seoTitle: "",
  seoDescription: "",
  ogImageUrl: "",
  updatedAt: new Date(0).toISOString(),
};

const HERO_HINT = "Leave empty to keep the built-in copy.";

function ToggleRow({
  checked,
  onChange,
  title,
  description,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-[#F0EAD9] bg-[#FBF9F4] px-4 py-3">
      <Switch checked={checked} onCheckedChange={onChange} aria-label={ariaLabel} />
      <div className="min-w-0 flex-1 text-right">
        <p className="text-sm font-medium text-[#1C1A16]">{title}</p>
        <p className="text-xs text-[#8A8375]">{description}</p>
      </div>
    </div>
  );
}

export default function SettingsManager() {
  const [form, setForm] = useState<StoreSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [faqRows, setFaqRows] = useState<FaqRow[]>([]);
  const [testimonialRows, setTestimonialRows] = useState<TestimonialRow[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  const baselineRef = useRef<string>("");
  // The Cloud API token is deliberately NOT part of the form DTO — the server
  // only ever returns a masked preview. This field holds a freshly typed token
  // and is included in the save payload only when non-empty.
  const [newWaToken, setNewWaToken] = useState("");
  const [clearWaToken, setClearWaToken] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ settings: StoreSettingsDTO | null }>("/api/admin/settings");
      const s = res.settings ?? DEFAULT_SETTINGS;
      setForm({ ...DEFAULT_SETTINGS, ...s });
      setFaqRows(s.faq.map((f) => ({ ...f })));
      setTestimonialRows(s.testimonials.map((t) => ({ ...t, rating: String(t.rating) })));
      setGallery([...s.instagramGallery]);
      baselineRef.current = "";
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof StoreSettingsDTO>(key: K, value: StoreSettingsDTO[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  // "Unsaved changes" indicator — cheap snapshot comparison.
  const dirty =
    !!form &&
    baselineRef.current !==
      JSON.stringify({ form, faqRows, testimonialRows, gallery }) &&
    baselineRef.current !== "";

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        shippingFee: Math.max(0, Number(form.shippingFee) || 0),
        freeShippingAbove: Math.max(0, Number(form.freeShippingAbove) || 0),
        taxRatePercent: Math.min(28, Math.max(0, Number(form.taxRatePercent) || 0)),
        giftWrapFee: Math.max(0, Number(form.giftWrapFee) || 0),
        engravingEnabled: form.engravingEnabled,
        engravingFee: Math.max(0, Number(form.engravingFee) || 0),
        engravingFeeScript: Math.max(0, Number(form.engravingFeeScript) || 0),
        engravingFeeSans: Math.max(0, Number(form.engravingFeeSans) || 0),
        appointmentVisitCapacity: Math.min(10, Math.max(1, Math.round(Number(form.appointmentVisitCapacity) || 2))),
        appointmentVideoCapacity: Math.min(10, Math.max(1, Math.round(Number(form.appointmentVideoCapacity) || 2))),
        googleReviewCount: Math.min(100000, Math.max(0, Math.round(Number(form.googleReviewCount) || 0))),
        whatsappFloatEnabled: form.whatsappFloatEnabled,
        instagramFeedEnabled: form.instagramFeedEnabled,
        announcementEnabled: form.announcementEnabled,
        showCollectionsSection: form.showCollectionsSection,
        showCategoriesSection: form.showCategoriesSection,
        showNewArrivals: form.showNewArrivals,
        showBestSellers: form.showBestSellers,
        showTrending: form.showTrending,
        showHandmade: form.showHandmade,
        showTestimonials: form.showTestimonials,
        showNewsletter: form.showNewsletter,
        faq: faqRows.filter((r) => r.q.trim() || r.a.trim()),
        testimonials: testimonialRows
          .filter((r) => r.name.trim() || r.text.trim())
          .map((r) => ({
            name: r.name.trim(),
            location: r.location.trim(),
            text: r.text.trim(),
            rating: Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))),
          })),
        instagramGallery: gallery.filter(Boolean),
        // Cloud API token rides along only when the admin typed a new one or
        // explicitly asked to clear the stored one.
        ...(newWaToken.trim() ? { waCloudToken: newWaToken.trim() } : {}),
        ...(clearWaToken ? { waCloudToken: "" } : {}),
      };
      const res = await api<{ success: boolean; settings: StoreSettingsDTO }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success("Store settings saved — the storefront updates instantly.");
      setNewWaToken("");
      setClearWaToken(false);
      const s = res.settings;
      // Push the fresh settings into the global store so the navbar
      // announcement, WhatsApp float and other shell-level UI react live
      // (HomeView refetches on its own, but the shell does not remount).
      useApp.getState().setSettings({ ...DEFAULT_SETTINGS, ...s });
      setForm({ ...DEFAULT_SETTINGS, ...s });
      setFaqRows(s.faq.map((f) => ({ ...f })));
      setTestimonialRows(s.testimonials.map((t) => ({ ...t, rating: String(t.rating) })));
      setGallery([...s.instagramGallery]);
      baselineRef.current = "";
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  // Baseline for the dirty indicator — set after the first render with data.
  useEffect(() => {
    if (form && baselineRef.current === "") {
      baselineRef.current = JSON.stringify({ form, faqRows, testimonialRows, gallery });
    }
  }, [form, faqRows, testimonialRows, gallery]);

  if (loading && !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56 bg-[#EFEAE0]" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg border border-[#EAE2D3] bg-[#EFEAE0]" />
          ))}
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <Card className="border-[#EAE2D3] bg-white">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Info className="size-8 text-[#D4AF37]" aria-hidden />
          <p className="text-sm text-[#6B655A]">Could not load settings. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const saveButton = (label = "Save all changes") => (
    <Button onClick={() => void handleSave()} disabled={saving} className="bg-[#171717] text-white hover:bg-[#2A2824]">
      {saving ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Saving…
        </>
      ) : (
        label
      )}
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* ---------- Toolbar ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-[#1C1A16]">Store settings</h2>
          <p className="text-sm text-[#8A8375]">
            Full control, zero code — brand, connectivity, homepage, commerce and content.
            {dirty ? <span className="ml-2 inline-flex items-center gap-1.5 font-medium text-[#B45309]"><span className="size-1.5 rounded-full bg-[#D4AF37]" />Unsaved changes</span> : null}
          </p>
        </div>
        {saveButton()}
      </div>

      <Tabs defaultValue="brand">
        <TabsList className="mb-5 flex h-auto w-full flex-wrap items-center gap-1 overflow-x-auto rounded-lg border border-[#EAE2D3] bg-[#FBF9F4] p-1">
          <TabsTrigger value="brand" className="gap-1.5 px-3 py-1.5 text-xs"><Store className="size-3.5" aria-hidden />Brand &amp; Contact</TabsTrigger>
          <TabsTrigger value="connect" className="gap-1.5 px-3 py-1.5 text-xs"><Instagram className="size-3.5" aria-hidden />Social &amp; Reviews</TabsTrigger>
          <TabsTrigger value="homepage" className="gap-1.5 px-3 py-1.5 text-xs"><Home className="size-3.5" aria-hidden />Homepage</TabsTrigger>
          <TabsTrigger value="commerce" className="gap-1.5 px-3 py-1.5 text-xs"><Coins className="size-3.5" aria-hidden />Commerce &amp; Fees</TabsTrigger>
          <TabsTrigger value="content" className="gap-1.5 px-3 py-1.5 text-xs"><ScrollText className="size-3.5" aria-hidden />Content</TabsTrigger>
          <TabsTrigger value="faq" className="gap-1.5 px-3 py-1.5 text-xs">FAQ</TabsTrigger>
          <TabsTrigger value="testimonials" className="gap-1.5 px-3 py-1.5 text-xs"><MessageSquareQuote className="size-3.5" aria-hidden />Testimonials</TabsTrigger>
          <TabsTrigger value="instagram" className="gap-1.5 px-3 py-1.5 text-xs"><Instagram className="size-3.5" aria-hidden />Gallery</TabsTrigger>
          <TabsTrigger value="seo" className="gap-1.5 px-3 py-1.5 text-xs"><Globe className="size-3.5" aria-hidden />SEO &amp; Meta</TabsTrigger>
        </TabsList>

        {/* ================= BRAND & CONTACT ================= */}
        <TabsContent value="brand" className="mt-0 space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-[#EAE2D3] bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                  <Store className="size-4 text-[#D4AF37]" aria-hidden />
                  Brand
                </CardTitle>
                <CardDescription>Identity shown across the storefront.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">Brand name</Label>
                  <Input value={form.brandName} onChange={(e) => set("brandName", e.target.value)} className="border-[#E0D9C8] bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">Tagline</Label>
                  <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} className="border-[#E0D9C8] bg-white" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#EAE2D3] bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                  <Info className="size-4 text-[#D4AF37]" aria-hidden />
                  Contact
                </CardTitle>
                <CardDescription>Displayed in the footer and WhatsApp flows.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="border-[#E0D9C8] bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">Phone</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="border-[#E0D9C8] bg-white" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-[#5A544A]">WhatsApp number</Label>
                  <Input
                    value={form.whatsappNumber}
                    onChange={(e) => set("whatsappNumber", e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="919876543210"
                    className="border-[#E0D9C8] bg-white font-mono"
                  />
                  <p className="text-[11px] text-[#B0A88F]">Country code + number, digits only — e.g. 919876543210 for +91 98765 43210.</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-[#5A544A]">Address</Label>
                  <Textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} className="border-[#E0D9C8] bg-white" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-[#5A544A]">Business hours</Label>
                  <Input value={form.businessHours} onChange={(e) => set("businessHours", e.target.value)} className="border-[#E0D9C8] bg-white" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================= SOCIAL & REVIEWS ================= */}
        <TabsContent value="connect" className="mt-0 space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-[#EAE2D3] bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                  <Instagram className="size-4 text-[#D4AF37]" aria-hidden />
                  Social profiles
                </CardTitle>
                <CardDescription>Full URLs, left blank to hide the icon.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">Instagram</Label>
                  <Input value={form.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} className="border-[#E0D9C8] bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">Facebook</Label>
                  <Input value={form.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} className="border-[#E0D9C8] bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">Pinterest</Label>
                  <Input value={form.pinterestUrl} onChange={(e) => set("pinterestUrl", e.target.value)} className="border-[#E0D9C8] bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">YouTube</Label>
                  <Input value={form.youtubeUrl} onChange={(e) => set("youtubeUrl", e.target.value)} className="border-[#E0D9C8] bg-white" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#EAE2D3] bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                  <Star className="size-4 text-[#D4AF37]" aria-hidden />
                  Google reviews &amp; maps
                </CardTitle>
                <CardDescription>Social proof from your Google Business profile.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-[#5A544A]">Google review link</Label>
                  <Input
                    value={form.googleReviewUrl}
                    onChange={(e) => set("googleReviewUrl", e.target.value)}
                    placeholder="https://g.page/r/your-business/review"
                    className="border-[#E0D9C8] bg-white"
                  />
                  <p className="text-[11px] text-[#B0A88F]">Where the &ldquo;Review us on Google&rdquo; buttons send customers (footer + homepage badge).</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-[#5A544A]">Google Maps link</Label>
                  <Input
                    value={form.googleMapsUrl}
                    onChange={(e) => set("googleMapsUrl", e.target.value)}
                    placeholder="https://maps.app.goo.gl/…"
                    className="border-[#E0D9C8] bg-white"
                  />
                  <p className="text-[11px] text-[#B0A88F]">Makes the footer address clickable so clients can navigate to the atelier.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">Google rating</Label>
                  <Input
                    value={form.googleRating}
                    onChange={(e) => set("googleRating", e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="4.9"
                    maxLength={4}
                    className="border-[#E0D9C8] bg-white"
                  />
                  <p className="text-[11px] text-[#B0A88F]">Leave empty to hide the badge.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">Number of reviews</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100000"
                    value={form.googleReviewCount}
                    onChange={(e) => set("googleReviewCount", Number(e.target.value))}
                    className="border-[#E0D9C8] bg-white"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#EAE2D3] bg-white xl:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                  <MessageCircle className="size-4 text-[#D4AF37]" aria-hidden />
                  WhatsApp concierge
                </CardTitle>
                <CardDescription>How the floating button and general enquiries greet customers.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#5A544A]">Custom greeting message</Label>
                    <Textarea
                      rows={3}
                      value={form.whatsappDefaultMessage}
                      onChange={(e) => set("whatsappDefaultMessage", e.target.value)}
                      placeholder="Hello LN Jewellers! ◆ I'd love to know more about your handcrafted jewelry collections."
                      className="border-[#E0D9C8] bg-white"
                    />
                    <p className="text-[11px] text-[#B0A88F]">Pre-fills the customer&rsquo;s WhatsApp text when they tap the floating button. {HERO_HINT}</p>
                  </div>
                  <ToggleRow
                    checked={form.whatsappFloatEnabled}
                    onChange={(v) => set("whatsappFloatEnabled", v)}
                    title="Floating WhatsApp button"
                    description={form.whatsappFloatEnabled ? "Visible on every storefront page." : "Hidden — customers still reach you via product & checkout buttons."}
                    ariaLabel="Toggle floating WhatsApp button"
                  />
                </div>
                <div className="space-y-4">
                  <ToggleRow
                    checked={form.instagramFeedEnabled}
                    onChange={(v) => set("instagramFeedEnabled", v)}
                    title="Instagram gallery section"
                    description={form.instagramFeedEnabled ? "Shown on the homepage (needs gallery images below)." : "Hidden from the homepage."}
                    ariaLabel="Toggle Instagram gallery section"
                  />
                  <div className="rounded-md border border-dashed border-[#D4AF37]/40 bg-[#FBF9F4] p-4 text-xs leading-relaxed text-[#8A8375]">
                    <p className="mb-1 font-medium text-[#1C1A16]">Tip — getting the Google review link</p>
                    In your Google Business Profile choose &ldquo;Ask for reviews&rdquo; and paste the link here. The rating + count are shown next to it; update them after new reviews arrive.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#EAE2D3] bg-white xl:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                  <Zap className="size-4 text-[#D4AF37]" aria-hidden />
                  WhatsApp Cloud API — send in one click
                </CardTitle>
                <CardDescription>
                  Lets the atelier deliver order confirmations &amp; status updates straight from the admin panel — no WhatsApp app opens, nothing to press. Customers get messages from your own number.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-md border px-4 py-3",
                      form.waCloudConnected ? "border-[#25D366]/40 bg-[#25D366]/5" : "border-amber-300 bg-amber-50"
                    )}
                  >
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium", form.waCloudConnected ? "text-[#0e6e3a]" : "text-amber-800")}>
                        {form.waCloudConnected ? "Connected — one-click delivery is on" : "Not connected — messages open WhatsApp instead"}
                      </p>
                      {form.waCloudTokenMasked && (
                        <p className="mt-0.5 truncate font-mono text-[11px] text-[#8A8375]">Token {form.waCloudTokenMasked}</p>
                      )}
                    </div>
                    {form.waCloudConnected && <Zap className="size-5 shrink-0 text-[#25D366]" aria-hidden />}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#5A544A]">Phone number ID</Label>
                    <Input
                      value={form.waCloudPhoneId}
                      onChange={(e) => set("waCloudPhoneId", e.target.value.replace(/\D/g, ""))}
                      placeholder="123456789012345"
                      maxLength={40}
                      className="border-[#E0D9C8] bg-white font-mono"
                    />
                    <p className="text-[11px] text-[#B0A88F]">From Meta for Developers → WhatsApp → API Setup. Digits only.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs text-[#5A544A]">
                      <KeyRound className="size-3" aria-hidden /> Access token {form.waCloudTokenMasked && <span className="font-mono text-[10px] text-[#B0A88F]">(stored: {form.waCloudTokenMasked})</span>}
                    </Label>
                    <Input
                      type="password"
                      value={newWaToken}
                      onChange={(e) => {
                        setNewWaToken(e.target.value.trim());
                        setClearWaToken(false);
                      }}
                      placeholder={form.waCloudTokenMasked ? "Paste a new token to replace it" : "Paste your permanent access token"}
                      autoComplete="off"
                      className="border-[#E0D9C8] bg-white font-mono"
                    />
                    <p className="text-[11px] text-[#B0A88F]">Stored securely on the server — it is never shown or sent to the browser again. Create one in Meta for Developers → WhatsApp → API Setup.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <ToggleRow
                    checked={form.waAutoConfirm}
                    onChange={(v) => set("waAutoConfirm", v)}
                    title="Auto-send order confirmation"
                    description={form.waAutoConfirm ? "Every new order instantly gets an \u201corder received\u201d receipt on the customer's WhatsApp." : "Off — you send the first message yourself from the Orders panel."}
                    ariaLabel="Toggle automatic WhatsApp order confirmation"
                  />
                  {form.waCloudTokenMasked && (
                    <ToggleRow
                      checked={clearWaToken}
                      onChange={(v) => {
                        setClearWaToken(v);
                        if (v) setNewWaToken("");
                      }}
                      title="Remove the stored token"
                      description={clearWaToken ? "The token will be deleted when you press Save all changes." : "Disconnect the Cloud API — sending falls back to opening WhatsApp."}
                      ariaLabel="Toggle clearing the stored WhatsApp token"
                    />
                  )}
                  <div className="rounded-md border border-dashed border-[#D4AF37]/40 bg-[#FBF9F4] p-4 text-xs leading-relaxed text-[#8A8375]">
                    <p className="mb-1 font-medium text-[#1C1A16]">How to connect (free to set up)</p>
                    1. Create a free app at <span className="font-medium text-[#7A5E14]">developers.facebook.com</span> and add the WhatsApp product.
                    <br />2. Copy the <span className="font-medium text-[#7A5E14]">Phone number ID</span> and a <span className="font-medium text-[#7A5E14]">permanent access token</span> from API Setup.
                    <br />3. Paste both here and save. Utility messages cost a small per-conversation fee (in India, conversations opened by you are billed by Meta; replies within 24h of a customer message are free).
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================= HOMEPAGE ================= */}
        <TabsContent value="homepage" className="mt-0 space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-[#EAE2D3] bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                  <Home className="size-4 text-[#D4AF37]" aria-hidden />
                  Hero copy
                </CardTitle>
                <CardDescription>The first words every visitor reads.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">Eyebrow (small line above the title)</Label>
                  <Input value={form.heroEyebrow} onChange={(e) => set("heroEyebrow", e.target.value)} placeholder="Handcrafted in Jaipur · Since 2016" className="border-[#E0D9C8] bg-white" />
                  <p className="text-[11px] text-[#B0A88F]">{HERO_HINT}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#5A544A]">Title</Label>
                    <Input value={form.heroTitle} onChange={(e) => set("heroTitle", e.target.value)} placeholder="Heirlooms for the" className="border-[#E0D9C8] bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#5A544A]">Golden italic word</Label>
                    <Input value={form.heroHighlight} onChange={(e) => set("heroHighlight", e.target.value)} placeholder="Modern Muse" className="border-[#E0D9C8] bg-white" />
                    <p className="text-[11px] text-[#B0A88F]">Renders in italic gold on its own line. {HERO_HINT}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">Subtitle</Label>
                  <Textarea rows={2} value={form.heroSubtitle} onChange={(e) => set("heroSubtitle", e.target.value)} placeholder="22K and 18K gold, raised by master karigars in our Jaipur atelier — hallmarked, insured, and made to be inherited." className="border-[#E0D9C8] bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">Primary button label</Label>
                  <Input value={form.heroCtaLabel} onChange={(e) => set("heroCtaLabel", e.target.value)} placeholder="Explore the Collection" className="border-[#E0D9C8] bg-white" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#EAE2D3] bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                  <Bell className="size-4 text-[#D4AF37]" aria-hidden />
                  Announcement bar
                </CardTitle>
                <CardDescription>A gold strip above the menu — sales, festivals, new arrivals.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ToggleRow
                  checked={form.announcementEnabled}
                  onChange={(v) => set("announcementEnabled", v)}
                  title="Show announcement"
                  description={form.announcementEnabled ? "Live above the navbar (replaces the rotating promo strip)." : "Off — the default rotating promo strip shows instead."}
                  ariaLabel="Toggle announcement bar"
                />
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#5A544A]">Announcement text</Label>
                  <Input
                    value={form.announcementText}
                    onChange={(e) => set("announcementText", e.target.value)}
                    disabled={!form.announcementEnabled}
                    placeholder="Diwali early access is live — 10% off with LN10"
                    maxLength={200}
                    className="border-[#E0D9C8] bg-white disabled:opacity-60"
                  />
                  <p className="text-[11px] text-[#B0A88F]">Shown in uppercase, one line. Visitors can dismiss it; a NEW text always reappears.</p>
                </div>
                <div className="rounded-md border border-[#F0EAD9] bg-[#FBF9F4] p-3">
                  <p className="mb-1.5 text-[10px] uppercase tracking-[0.25em] text-[#8A8375]">Live preview</p>
                  <div className="flex min-h-9 items-center justify-center bg-[#D4AF37] px-6 py-1.5">
                    <p className="line-clamp-1 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-black">
                      {form.announcementText?.trim() || "Your announcement appears here"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#EAE2D3] bg-white xl:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                  <LayoutGrid className="size-4 text-[#D4AF37]" aria-hidden />
                  Homepage sections
                </CardTitle>
                <CardDescription>Turn any homepage section on or off — changes apply the moment you save.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <ToggleRow checked={form.showCollectionsSection} onChange={(v) => set("showCollectionsSection", v)} title="Featured collections" description="The curated collection tiles." ariaLabel="Toggle featured collections section" />
                <ToggleRow checked={form.showCategoriesSection} onChange={(v) => set("showCategoriesSection", v)} title="Shop by category" description="Rings, necklaces, earrings…" ariaLabel="Toggle categories section" />
                <ToggleRow checked={form.showNewArrivals} onChange={(v) => set("showNewArrivals", v)} title="New arrivals" description="The latest pieces from the bench." ariaLabel="Toggle new arrivals section" />
                <ToggleRow checked={form.showBestSellers} onChange={(v) => set("showBestSellers", v)} title="Best sellers" description="The swipeable favourites rail." ariaLabel="Toggle best sellers section" />
                <ToggleRow checked={form.showTrending} onChange={(v) => set("showTrending", v)} title="Trending now" description="The numbered trend list." ariaLabel="Toggle trending section" />
                <ToggleRow checked={form.showHandmade} onChange={(v) => set("showHandmade", v)} title="Artisan soul showcase" description="Handmade one-of-one highlight." ariaLabel="Toggle handmade section" />
                <ToggleRow checked={form.showTestimonials} onChange={(v) => set("showTestimonials", v)} title="Testimonials" description="Customer voices grid (the Google badge stays)." ariaLabel="Toggle testimonials section" />
                <ToggleRow checked={form.showNewsletter} onChange={(v) => set("showNewsletter", v)} title="Newsletter signup" description="The Circle email capture." ariaLabel="Toggle newsletter section" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================= COMMERCE & FEES ================= */}
        <TabsContent value="commerce" className="mt-0 space-y-6">
          <Card className="border-[#EAE2D3] bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                <Coins className="size-4 text-[#D4AF37]" aria-hidden />
                Commerce
              </CardTitle>
              <CardDescription>Checkout maths and payment gateway toggle.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Shipping fee (₹)</Label>
                <Input type="number" min="0" value={form.shippingFee} onChange={(e) => set("shippingFee", Number(e.target.value))} className="border-[#E0D9C8] bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Free shipping above (₹)</Label>
                <Input type="number" min="0" value={form.freeShippingAbove} onChange={(e) => set("freeShippingAbove", Number(e.target.value))} className="border-[#E0D9C8] bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Tax rate (%)</Label>
                <Input type="number" min="0" max="28" step="0.5" value={form.taxRatePercent} onChange={(e) => set("taxRatePercent", Number(e.target.value))} className="border-[#E0D9C8] bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Gift wrap fee (₹)</Label>
                <Input type="number" min="0" value={form.giftWrapFee} onChange={(e) => set("giftWrapFee", Number(e.target.value))} className="border-[#E0D9C8] bg-white" />
                <p className="text-xs text-[#8A8375]">Charged once per order when the shopper adds signature gift wrap.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Engraving fee (₹ per piece)</Label>
                <Input type="number" min="0" value={form.engravingFee} onChange={(e) => set("engravingFee", Number(e.target.value))} className="border-[#E0D9C8] bg-white" />
                <p className="text-xs text-[#8A8375]">Classic serif hand — charged for each engraved piece.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Script engraving fee (₹ per piece)</Label>
                <Input type="number" min="0" value={form.engravingFeeScript} onChange={(e) => set("engravingFeeScript", Number(e.target.value))} className="border-[#E0D9C8] bg-white" />
                <p className="text-xs text-[#8A8375]">Elegant script hand — flowing curves take the karigar longer, so it carries a premium.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Sans engraving fee (₹ per piece)</Label>
                <Input type="number" min="0" value={form.engravingFeeSans} onChange={(e) => set("engravingFeeSans", Number(e.target.value))} className="border-[#E0D9C8] bg-white" />
                <p className="text-xs text-[#8A8375]">Modern sans hand — deep, clean letter cuts.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Atelier visits per slot</Label>
                <Input type="number" min="1" max="10" value={form.appointmentVisitCapacity} onChange={(e) => set("appointmentVisitCapacity", Number(e.target.value))} className="border-[#E0D9C8] bg-white" />
                <p className="text-xs text-[#8A8375]">Max pending + confirmed in-atelier visits per time slot. Full slots are disabled for booking.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Video consultations per slot</Label>
                <Input type="number" min="1" max="10" value={form.appointmentVideoCapacity} onChange={(e) => set("appointmentVideoCapacity", Number(e.target.value))} className="border-[#E0D9C8] bg-white" />
                <p className="text-xs text-[#8A8375]">Separate book for video calls — a busy video hour never crowds out the atelier floor.</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.engravingEnabled} onCheckedChange={(v) => set("engravingEnabled", v)} aria-label="Enable engraving" />
                <div>
                  <p className="text-sm font-medium text-[#1C1A16]">Hand engraving</p>
                  <p className="text-xs text-[#8A8375]">{form.engravingEnabled ? "Offered on product pages." : "Hidden from the store."}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:col-span-3">
                <Switch checked={form.razorpayEnabled} onCheckedChange={(v) => set("razorpayEnabled", v)} aria-label="Enable Razorpay" />
                <div>
                  <p className="text-sm font-medium text-[#1C1A16]">Razorpay checkout</p>
                  <p className="text-xs text-[#8A8375]">{form.razorpayEnabled ? "Online payments enabled at checkout." : "WhatsApp ordering only."}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= CONTENT & POLICIES ================= */}
        <TabsContent value="content" className="mt-0 space-y-6">
          <Card className="border-[#EAE2D3] bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                <ScrollText className="size-4 text-[#D4AF37]" aria-hidden />
                Content &amp; policies
              </CardTitle>
              <CardDescription>Long-form copy for the About page and policy pages.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">About story</Label>
                <Textarea rows={4} value={form.aboutStory} onChange={(e) => set("aboutStory", e.target.value)} className="border-[#E0D9C8] bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Mission &amp; vision</Label>
                <Textarea rows={4} value={form.missionVision} onChange={(e) => set("missionVision", e.target.value)} className="border-[#E0D9C8] bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Shipping policy</Label>
                <Textarea rows={4} value={form.shippingPolicy} onChange={(e) => set("shippingPolicy", e.target.value)} className="border-[#E0D9C8] bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Returns policy</Label>
                <Textarea rows={4} value={form.returnsPolicy} onChange={(e) => set("returnsPolicy", e.target.value)} className="border-[#E0D9C8] bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Privacy policy</Label>
                <Textarea rows={4} value={form.privacyPolicy} onChange={(e) => set("privacyPolicy", e.target.value)} className="border-[#E0D9C8] bg-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Terms policy</Label>
                <Textarea rows={4} value={form.termsPolicy} onChange={(e) => set("termsPolicy", e.target.value)} className="border-[#E0D9C8] bg-white" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= FAQ ================= */}
        <TabsContent value="faq" className="mt-0 space-y-6">
          <Card className="border-[#EAE2D3] bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg text-[#1C1A16]">FAQ</CardTitle>
              <CardDescription>Shown on the FAQ page. First 20 entries are saved.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {faqRows.length === 0 && <p className="text-sm text-[#B0A88F]">No questions yet — add the first one.</p>}
              {faqRows.map((row, i) => (
                <div key={i} className="grid gap-2 rounded-md border border-[#F0EAD9] bg-[#FBF9F4] p-3 sm:grid-cols-[1fr_2fr_auto]">
                  <Input
                    value={row.q}
                    onChange={(e) => setFaqRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, q: e.target.value } : r)))}
                    placeholder="Question"
                    className="border-[#E0D9C8] bg-white"
                    aria-label={`FAQ ${i + 1} question`}
                  />
                  <Textarea
                    rows={2}
                    value={row.a}
                    onChange={(e) => setFaqRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, a: e.target.value } : r)))}
                    placeholder="Answer"
                    className="border-[#E0D9C8] bg-white"
                    aria-label={`FAQ ${i + 1} answer`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 self-start text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setFaqRows((rows) => rows.filter((_, idx) => idx !== i))}
                    aria-label={`Remove FAQ ${i + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFaqRows((rows) => [...rows, { q: "", a: "" }])}
                className="border-[#D4AF37]/50 text-[#7A5E14] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
              >
                <Plus className="size-4" aria-hidden />
                Add question
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TESTIMONIALS ================= */}
        <TabsContent value="testimonials" className="mt-0 space-y-6">
          <Card className="border-[#EAE2D3] bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                <MessageSquareQuote className="size-4 text-[#D4AF37]" aria-hidden />
                Testimonials
              </CardTitle>
              <CardDescription>Customer voices for the homepage. First 12 entries are saved.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {testimonialRows.length === 0 && <p className="text-sm text-[#B0A88F]">No testimonials yet.</p>}
              {testimonialRows.map((row, i) => (
                <div key={i} className="space-y-2 rounded-md border border-[#F0EAD9] bg-[#FBF9F4] p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_90px_auto]">
                    <Input
                      value={row.name}
                      onChange={(e) =>
                        setTestimonialRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))
                      }
                      placeholder="Name"
                      className="border-[#E0D9C8] bg-white"
                      aria-label={`Testimonial ${i + 1} name`}
                    />
                    <Input
                      value={row.location}
                      onChange={(e) =>
                        setTestimonialRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, location: e.target.value } : r)))
                      }
                      placeholder="Location"
                      className="border-[#E0D9C8] bg-white"
                      aria-label={`Testimonial ${i + 1} location`}
                    />
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      value={row.rating}
                      onChange={(e) =>
                        setTestimonialRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, rating: e.target.value } : r)))
                      }
                      className="border-[#E0D9C8] bg-white"
                      aria-label={`Testimonial ${i + 1} rating (1-5)`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setTestimonialRows((rows) => rows.filter((_, idx) => idx !== i))}
                      aria-label={`Remove testimonial ${i + 1}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    value={row.text}
                    onChange={(e) =>
                      setTestimonialRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, text: e.target.value } : r)))
                    }
                    placeholder="Quote"
                    className="border-[#E0D9C8] bg-white"
                    aria-label={`Testimonial ${i + 1} text`}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTestimonialRows((rows) => [...rows, { name: "", location: "", text: "", rating: "5" }])}
                className="border-[#D4AF37]/50 text-[#7A5E14] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
              >
                <Plus className="size-4" aria-hidden />
                Add testimonial
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= INSTAGRAM GALLERY ================= */}
        <TabsContent value="instagram" className="mt-0 space-y-6">
          <Card className="border-[#EAE2D3] bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                <Instagram className="size-4 text-[#D4AF37]" aria-hidden />
                Instagram gallery
              </CardTitle>
              <CardDescription>Image strip on the homepage. Reorder, edit URLs, or pick from the gallery.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {gallery.length === 0 && <p className="text-sm text-[#B0A88F]">No gallery images yet.</p>}
              {gallery.map((url, i) => (
                <div key={`${url}-${i}`} className="flex items-center gap-2">
                  <img src={url} alt={`Gallery image ${i + 1}`} className="size-10 shrink-0 rounded border border-[#EAE2D3] object-cover" />
                  <Input
                    value={url}
                    onChange={(e) => setGallery((prev) => prev.map((u, idx) => (idx === i ? e.target.value : u)))}
                    className="flex-1 border-[#E0D9C8] bg-white text-xs"
                    aria-label={`Gallery URL ${i + 1}`}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={i === 0}
                    onClick={() =>
                      setGallery((prev) => {
                        const next = [...prev];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        return next;
                      })
                    }
                    aria-label="Move image up"
                  >
                    <ChevronUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={i === gallery.length - 1}
                    onClick={() =>
                      setGallery((prev) => {
                        const next = [...prev];
                        [next[i + 1], next[i]] = [next[i], next[i + 1]];
                        return next;
                      })
                    }
                    aria-label="Move image down"
                  >
                    <ChevronDown className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setGallery((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove gallery image"
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}

              <Separator className="bg-[#EAE2D3]" />

              <div className="rounded-md border border-dashed border-[#D4AF37]/40 bg-[#FBF9F4] p-3">
                <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-[#8A8375]">Gallery — click to add or remove</p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {PRODUCT_IMAGE_LIBRARY.map((src) => {
                    const used = gallery.includes(src);
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() =>
                          setGallery((prev) => (prev.includes(src) ? prev.filter((u) => u !== src) : [...prev, src].slice(0, 12)))
                        }
                        title={src}
                        aria-pressed={used}
                        className={cn(
                          "relative overflow-hidden rounded border transition-all",
                          used ? "border-[#D4AF37] opacity-60 ring-1 ring-[#D4AF37]" : "border-transparent hover:border-[#D4AF37]/60"
                        )}
                      >
                        <img src={src} alt={src.split("/").pop() ?? "Gallery option"} className="aspect-square w-full object-cover" />
                        {used && (
                          <span className="absolute inset-0 flex items-center justify-center bg-white/40">
                            <Check className="size-4 text-[#7A5E14]" aria-hidden />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= SEO & META ================= */}
        <TabsContent value="seo" className="mt-0 space-y-6">
          <Card className="border-[#EAE2D3] bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
                <Globe className="size-4 text-[#D4AF37]" aria-hidden />
                SEO &amp; social sharing
              </CardTitle>
              <CardDescription>What Google shows, and what unfolds when someone shares your link on WhatsApp or Instagram.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Site title</Label>
                <Input
                  value={form.seoTitle}
                  onChange={(e) => set("seoTitle", e.target.value)}
                  placeholder="LN Jewellers — Handcrafted 22K Gold Jewelry, Made in Jaipur"
                  maxLength={200}
                  className="border-[#E0D9C8] bg-white"
                />
                <p className="text-[11px] text-[#B0A88F]">The browser-tab title and the Google result headline. {HERO_HINT}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Site description</Label>
                <Textarea
                  rows={3}
                  value={form.seoDescription}
                  onChange={(e) => set("seoDescription", e.target.value)}
                  placeholder="Heirloom-quality 22K & 18K gold jewellery, handmade in Jaipur…"
                  maxLength={200}
                  className="border-[#E0D9C8] bg-white"
                />
                <p className="text-[11px] text-[#B0A88F]">Meta description — the snippet under the headline in search results.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#5A544A]">Social share image URL</Label>
                <Input
                  value={form.ogImageUrl}
                  onChange={(e) => set("ogImageUrl", e.target.value)}
                  placeholder="/images/products/ring-solitaire.png"
                  className="border-[#E0D9C8] bg-white"
                />
                <p className="text-[11px] text-[#B0A88F]">Shown in WhatsApp/ social link previews. Use a square image from the media library, or any full URL.</p>
              </div>
              <div className="rounded-md border border-dashed border-[#D4AF37]/40 bg-[#FBF9F4] p-4 text-xs leading-relaxed text-[#8A8375]">
                These values are read live from the database — they apply after the next page load (no deploy needed).
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bottom save bar */}
      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[#EAE2D3] bg-white/90 py-4 backdrop-blur">
        <p className="text-xs text-[#8A8375]">
          {dirty ? <span className="font-medium text-[#B45309]">You have unsaved changes.</span> : "Everything is saved."}
        </p>
        {saveButton()}
      </div>
    </div>
  );
}
