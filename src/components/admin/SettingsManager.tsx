"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  Info,
  Instagram,
  Loader2,
  MessageSquareQuote,
  Plus,
  ScrollText,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { StoreSettingsDTO } from "@/lib/types";
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
  updatedAt: new Date(0).toISOString(),
};

export default function SettingsManager() {
  const [form, setForm] = useState<StoreSettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [faqRows, setFaqRows] = useState<FaqRow[]>([]);
  const [testimonialRows, setTestimonialRows] = useState<TestimonialRow[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ settings: StoreSettingsDTO | null }>("/api/admin/settings");
      const s = res.settings ?? DEFAULT_SETTINGS;
      setForm({ ...DEFAULT_SETTINGS, ...s });
      setFaqRows(s.faq.map((f) => ({ ...f })));
      setTestimonialRows(s.testimonials.map((t) => ({ ...t, rating: String(t.rating) })));
      setGallery([...s.instagramGallery]);
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
      };
      const res = await api<{ success: boolean; settings: StoreSettingsDTO }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success("Store settings saved.");
      const s = res.settings;
      setForm({ ...DEFAULT_SETTINGS, ...s });
      setFaqRows(s.faq.map((f) => ({ ...f })));
      setTestimonialRows(s.testimonials.map((t) => ({ ...t, rating: String(t.rating) })));
      setGallery([...s.instagramGallery]);
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <div className="space-y-6">
      {/* ---------- Toolbar ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-[#1C1A16]">Store settings</h2>
          <p className="text-sm text-[#8A8375]">Brand, contact, commerce and content for the whole storefront.</p>
        </div>
        <Button onClick={() => void handleSave()} disabled={saving} className="bg-[#171717] text-white hover:bg-[#2A2824]">
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Save all changes"
          )}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ---------- Brand ---------- */}
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

        {/* ---------- Contact ---------- */}
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

        {/* ---------- Social ---------- */}
        <Card className="border-[#EAE2D3] bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
              <Instagram className="size-4 text-[#D4AF37]" aria-hidden />
              Social
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

        {/* ---------- Commerce ---------- */}
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
              <Input
                type="number"
                min="0"
                value={form.shippingFee}
                onChange={(e) => set("shippingFee", Number(e.target.value))}
                className="border-[#E0D9C8] bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#5A544A]">Free shipping above (₹)</Label>
              <Input
                type="number"
                min="0"
                value={form.freeShippingAbove}
                onChange={(e) => set("freeShippingAbove", Number(e.target.value))}
                className="border-[#E0D9C8] bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#5A544A]">Tax rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="28"
                step="0.5"
                value={form.taxRatePercent}
                onChange={(e) => set("taxRatePercent", Number(e.target.value))}
                className="border-[#E0D9C8] bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#5A544A]">Gift wrap fee (₹)</Label>
              <Input
                type="number"
                min="0"
                value={form.giftWrapFee}
                onChange={(e) => set("giftWrapFee", Number(e.target.value))}
                className="border-[#E0D9C8] bg-white"
              />
              <p className="text-xs text-[#8A8375]">Charged once per order when the shopper adds signature gift wrap.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#5A544A]">Engraving fee (₹ per piece)</Label>
              <Input
                type="number"
                min="0"
                value={form.engravingFee}
                onChange={(e) => set("engravingFee", Number(e.target.value))}
                className="border-[#E0D9C8] bg-white"
              />
              <p className="text-xs text-[#8A8375]">Classic serif hand — charged for each engraved piece.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#5A544A]">Script engraving fee (₹ per piece)</Label>
              <Input
                type="number"
                min="0"
                value={form.engravingFeeScript}
                onChange={(e) => set("engravingFeeScript", Number(e.target.value))}
                className="border-[#E0D9C8] bg-white"
              />
              <p className="text-xs text-[#8A8375]">Elegant script hand — flowing curves take the karigar longer, so it carries a premium.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#5A544A]">Sans engraving fee (₹ per piece)</Label>
              <Input
                type="number"
                min="0"
                value={form.engravingFeeSans}
                onChange={(e) => set("engravingFeeSans", Number(e.target.value))}
                className="border-[#E0D9C8] bg-white"
              />
              <p className="text-xs text-[#8A8375]">Modern sans hand — deep, clean letter cuts.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#5A544A]">Atelier visits per slot</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={form.appointmentVisitCapacity}
                onChange={(e) => set("appointmentVisitCapacity", Number(e.target.value))}
                className="border-[#E0D9C8] bg-white"
              />
              <p className="text-xs text-[#8A8375]">Max pending + confirmed in-atelier visits per time slot. Full slots are disabled for booking.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#5A544A]">Video consultations per slot</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={form.appointmentVideoCapacity}
                onChange={(e) => set("appointmentVideoCapacity", Number(e.target.value))}
                className="border-[#E0D9C8] bg-white"
              />
              <p className="text-xs text-[#8A8375]">Separate book for video calls — a busy video hour never crowds out the atelier floor.</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.engravingEnabled} onCheckedChange={(v) => set("engravingEnabled", v)} aria-label="Enable engraving" />
              <div>
                <p className="text-sm font-medium text-[#1C1A16]">Hand engraving</p>
                <p className="text-xs text-[#8A8375]">
                  {form.engravingEnabled ? "Offered on product pages." : "Hidden from the store."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:col-span-3">
              <Switch checked={form.razorpayEnabled} onCheckedChange={(v) => set("razorpayEnabled", v)} aria-label="Enable Razorpay" />
              <div>
                <p className="text-sm font-medium text-[#1C1A16]">Razorpay checkout</p>
                <p className="text-xs text-[#8A8375]">
                  {form.razorpayEnabled ? "Online payments enabled at checkout." : "WhatsApp ordering only."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ---------- Content / policies ---------- */}
        <Card className="border-[#EAE2D3] bg-white xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
              <ScrollText className="size-4 text-[#D4AF37]" aria-hidden />
              Content & policies
            </CardTitle>
            <CardDescription>Long-form copy for the About page and policy pages.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#5A544A]">About story</Label>
              <Textarea rows={4} value={form.aboutStory} onChange={(e) => set("aboutStory", e.target.value)} className="border-[#E0D9C8] bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#5A544A]">Mission & vision</Label>
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

        {/* ---------- FAQ editor ---------- */}
        <Card className="border-[#EAE2D3] bg-white xl:col-span-2">
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

        {/* ---------- Testimonials editor ---------- */}
        <Card className="border-[#EAE2D3] bg-white xl:col-span-2">
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

        {/* ---------- Instagram gallery ---------- */}
        <Card className="border-[#EAE2D3] bg-white xl:col-span-2">
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
      </div>

      {/* Bottom save bar */}
      <div className="flex justify-end border-t border-[#EAE2D3] pt-4">
        <Button onClick={() => void handleSave()} disabled={saving} className="bg-[#171717] text-white hover:bg-[#2A2824]">
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Save all changes"
          )}
        </Button>
      </div>
    </div>
  );
}
