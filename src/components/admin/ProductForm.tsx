"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Category, Collection, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ApiError, PRODUCT_IMAGE_LIBRARY, PRODUCT_STATUSES, api, errMsg, isAuthError } from "./api";

interface VariantRow {
  name: string;
  size: string;
  priceDelta: string;
  stock: string;
}

interface FormState {
  name: string;
  sku: string;
  slug: string;
  shortDescription: string;
  description: string;
  price: string;
  discountPercent: string;
  categoryId: string;
  collectionId: string;
  material: string;
  purity: string;
  color: string;
  weightGrams: string;
  dimensions: string;
  stock: string;
  lowStockThreshold: string;
  trackInventory: boolean;
  featured: boolean;
  bestSeller: boolean;
  trending: boolean;
  handmade: boolean;
  readyToShip: boolean;
  craftsmanship: string;
  careInstructions: string;
  status: string;
  tags: string;
  model3dUrl: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  sku: "",
  slug: "",
  shortDescription: "",
  description: "",
  price: "",
  discountPercent: "0",
  categoryId: "",
  collectionId: "",
  material: "22K Gold",
  purity: "",
  color: "",
  weightGrams: "",
  dimensions: "",
  stock: "0",
  lowStockThreshold: "3",
  trackInventory: true,
  featured: false,
  bestSeller: false,
  trending: false,
  handmade: false,
  readyToShip: true,
  craftsmanship: "",
  careInstructions: "",
  status: "DRAFT",
  tags: "",
  model3dUrl: "",
};

const EMPTY_VARIANT: VariantRow = { name: "", size: "", priceDelta: "0", stock: "0" };

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null; // null = create mode
  onSaved: () => void;
}

export default function ProductForm({ open, onOpenChange, product, onSaved }: ProductFormProps) {
  // A "product" with an empty id is a DUPLICATE source — prefill create mode from it.
  const isEdit = !!product && !!product.id;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [images, setImages] = useState<string[]>([]);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // (Re)initialise the form every time the dialog opens
  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku,
        slug: product.slug,
        shortDescription: product.shortDescription ?? "",
        description: product.description ?? "",
        price: String(product.price),
        discountPercent: String(product.discountPercent ?? 0),
        categoryId: product.categoryId,
        collectionId: product.collectionId ?? "",
        material: product.material ?? "22K Gold",
        purity: product.purity ?? "",
        color: product.color ?? "",
        weightGrams: product.weightGrams != null ? String(product.weightGrams) : "",
        dimensions: product.dimensions ?? "",
        stock: String(product.stock ?? 0),
        lowStockThreshold: String(product.lowStockThreshold ?? 3),
        trackInventory: product.trackInventory,
        featured: product.featured,
        bestSeller: product.bestSeller,
        trending: product.trending,
        handmade: product.handmade,
        readyToShip: product.readyToShip,
        craftsmanship: product.craftsmanship ?? "",
        careInstructions: product.careInstructions ?? "",
        status: product.status,
        tags: (product.tags ?? []).join(", "),
        model3dUrl: product.model3dUrl ?? "",
      });
      setImages([...(product.images ?? [])]);
      // Duplicate mode (id === "") carries the source piece's variants over as editable rows
      setVariantRows(
        product.id === ""
          ? (product.variants ?? []).map((v) => ({
              name: v.name,
              size: v.size ?? "",
              priceDelta: String(v.priceDelta ?? 0),
              stock: String(Math.max(0, v.stock ?? 0)),
            }))
          : []
      );
    } else {
      setForm({ ...EMPTY_FORM });
      setImages([]);
      setVariantRows([{ ...EMPTY_VARIANT }]);
    }
  }, [open, product]);

  // Fetch categories + collections when opened
  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const [cats, cols] = await Promise.all([
        api<{ categories: Category[] }>("/api/categories"),
        api<{ collections: Collection[] }>("/api/collections"),
      ]);
      setCategories(cats.categories);
      setCollections(cols.collections);
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadMeta();
  }, [open, loadMeta]);

  // ---------- images ----------
  function addImage(url: string) {
    setImages((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url].slice(0, 8)));
  }
  function moveImage(i: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // ---------- variants (create only) ----------
  function setVariant(i: number, patch: Partial<VariantRow>) {
    setVariantRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  // ---------- submit ----------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const clientErrors: Record<string, string> = {};
    if (!form.name.trim()) clientErrors.name = "Product name is required";
    if (!form.sku.trim()) clientErrors.sku = "SKU is required";
    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0) clientErrors.price = "Valid price is required";
    if (!form.categoryId) clientErrors.categoryId = "Category is required";
    if (Object.keys(clientErrors).length) {
      setFieldErrors(clientErrors);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      shortDescription: form.shortDescription.trim(),
      description: form.description.trim(),
      price,
      discountPercent: Number(form.discountPercent || 0),
      categoryId: form.categoryId,
      collectionId: form.collectionId || null,
      images,
      model3dUrl: form.model3dUrl.trim(),
      material: form.material.trim() || "22K Gold",
      purity: form.purity.trim(),
      color: form.color.trim(),
      weightGrams: form.weightGrams.trim() ? Number(form.weightGrams) : null,
      dimensions: form.dimensions.trim(),
      lowStockThreshold: Number(form.lowStockThreshold || 3),
      trackInventory: form.trackInventory,
      featured: form.featured,
      bestSeller: form.bestSeller,
      trending: form.trending,
      handmade: form.handmade,
      readyToShip: form.readyToShip,
      craftsmanship: form.craftsmanship.trim(),
      careInstructions: form.careInstructions.trim(),
      status: form.status,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    setSaving(true);
    try {
      if (isEdit && product) {
        if (form.slug.trim()) payload.slug = form.slug.trim();
        // NOTE: stock is intentionally omitted on edit — stock changes go through Inventory
        await api(`/api/admin/products/${product.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success(`“${form.name.trim()}” updated.`);
      } else {
        payload.slug = form.slug.trim(); // blank → backend auto-generates from name
        payload.stock = Math.max(0, Number(form.stock || 0));
        // Variants are only supported on create (no variants endpoint exists)
        payload.variants = variantRows
          .filter((r) => r.name.trim())
          .map((r) => ({
            name: r.name.trim(),
            size: r.size.trim() || null,
            priceDelta: Number(r.priceDelta || 0),
            stock: Math.max(0, Number(r.stock || 0)),
          }));
        await api("/api/admin/products", { method: "POST", body: JSON.stringify(payload) });
        toast.success(`“${form.name.trim()}” created.`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      if (!isAuthError(err)) toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  const slugHint =
    form.slug.trim() || form.name.trim()
      ? `URL: /product/${slugify(form.slug.trim() || form.name.trim())}`
      : "Auto-generated from the product name if left blank.";

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="admin-scroll max-h-[92vh] overflow-y-auto border-[#EAE2D3] sm:max-w-3xl">
        <DialogHeader>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#B0A88F]">Atelier catalog</p>
          <DialogTitle className="font-serif text-xl text-[#1C1A16]">
            {isEdit ? `Edit — ${product?.name}` : product?.id === "" ? "Duplicate as new draft" : "New piece"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the piece below. Stock changes are managed from the Inventory tab."
              : "Add a new piece to the catalog. Fields marked * are required."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ---------- Identity ---------- */}
          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *" error={fieldErrors.name} className="sm:col-span-2">
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Heritage Solitaire Ring"
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
            <Field label="SKU *" error={fieldErrors.sku}>
              <Input
                value={form.sku}
                onChange={(e) => set("sku", e.target.value.toUpperCase())}
                placeholder="LN-RING-001"
                className="border-[#E0D9C8] bg-white font-mono"
              />
            </Field>
            <Field label="Slug" hint={slugHint} error={fieldErrors.slug}>
              <Input
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="auto from name"
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
            <Field label="Short description" className="sm:col-span-2">
              <Input
                value={form.shortDescription}
                onChange={(e) => set("shortDescription", e.target.value)}
                placeholder="One-line hook shown on cards"
                maxLength={200}
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={4}
                placeholder="Full story for the product page…"
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
          </section>

          <Separator className="bg-[#EAE2D3]" />

          {/* ---------- Commerce ---------- */}
          <section className="grid gap-4 sm:grid-cols-3">
            <Field label="Price (₹) *" error={fieldErrors.price}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
            <Field label="Discount %">
              <Input
                type="number"
                min="0"
                max="90"
                value={form.discountPercent}
                onChange={(e) => set("discountPercent", e.target.value)}
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="w-full border-[#E0D9C8] bg-white" aria-label="Product status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "PUBLISHED" ? "Published" : s === "DRAFT" ? "Draft" : "Archived"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category *" error={fieldErrors.categoryId}>
              <Select
                value={form.categoryId || undefined}
                onValueChange={(v) => set("categoryId", v)}
                disabled={metaLoading}
              >
                <SelectTrigger className="w-full border-[#E0D9C8] bg-white" aria-label="Category">
                  <SelectValue placeholder={metaLoading ? "Loading…" : "Select category"} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Collection">
              <Select
                value={form.collectionId || "none"}
                onValueChange={(v) => set("collectionId", v === "none" ? "" : v)}
                disabled={metaLoading}
              >
                <SelectTrigger className="w-full border-[#E0D9C8] bg-white" aria-label="Collection">
                  <SelectValue placeholder={metaLoading ? "Loading…" : "No collection"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No collection</SelectItem>
                  {collections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tags" hint="Comma separated">
              <Input
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="bridal, gold, solitaire"
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
          </section>

          <Separator className="bg-[#EAE2D3]" />

          {/* ---------- Material ---------- */}
          <section className="grid gap-4 sm:grid-cols-3">
            <Field label="Material">
              <Input
                value={form.material}
                onChange={(e) => set("material", e.target.value)}
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
            <Field label="Purity">
              <Input
                value={form.purity}
                onChange={(e) => set("purity", e.target.value)}
                placeholder="22K / 916"
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
            <Field label="Color">
              <Input
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
                placeholder="Yellow gold"
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
            <Field label="Weight (g)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.weightGrams}
                onChange={(e) => set("weightGrams", e.target.value)}
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
            <Field label="Dimensions">
              <Input
                value={form.dimensions}
                onChange={(e) => set("dimensions", e.target.value)}
                placeholder="12 × 4 mm"
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
            <Field label="3D model URL" hint="Optional .glb/.gltf">
              <Input
                value={form.model3dUrl}
                onChange={(e) => set("model3dUrl", e.target.value)}
                placeholder="/models/ring.glb"
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
            <Field label="Craftsmanship" className="sm:col-span-2">
              <Textarea
                value={form.craftsmanship}
                onChange={(e) => set("craftsmanship", e.target.value)}
                rows={2}
                placeholder="Hand-set stones, jaali work…"
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
            <Field label="Care instructions">
              <Textarea
                value={form.careInstructions}
                onChange={(e) => set("careInstructions", e.target.value)}
                rows={2}
                placeholder="Store in the pouch provided…"
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
          </section>

          <Separator className="bg-[#EAE2D3]" />

          {/* ---------- Stock & flags ---------- */}
          <section className="grid gap-4 sm:grid-cols-2">
            {!isEdit && (
              <Field label="Opening stock" hint="Later changes go through the Inventory tab">
                <Input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => set("stock", e.target.value)}
                  className="border-[#E0D9C8] bg-white"
                />
              </Field>
            )}
            <Field label="Low-stock threshold">
              <Input
                type="number"
                min="0"
                value={form.lowStockThreshold}
                onChange={(e) => set("lowStockThreshold", e.target.value)}
                className="border-[#E0D9C8] bg-white"
              />
            </Field>
            <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-3", isEdit && "sm:col-span-2")}>
              <SwitchField
                label="Track inventory"
                checked={form.trackInventory}
                onChange={(v) => set("trackInventory", v)}
              />
              <SwitchField label="Ready to ship" checked={form.readyToShip} onChange={(v) => set("readyToShip", v)} />
              <SwitchField label="Featured" checked={form.featured} onChange={(v) => set("featured", v)} />
              <SwitchField label="Best seller" checked={form.bestSeller} onChange={(v) => set("bestSeller", v)} />
              <SwitchField label="Trending" checked={form.trending} onChange={(v) => set("trending", v)} />
              <SwitchField label="Handmade" checked={form.handmade} onChange={(v) => set("handmade", v)} />
            </div>
          </section>

          <Separator className="bg-[#EAE2D3]" />

          {/* ---------- Images ---------- */}
          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-[#8A8375]">
              Images <span className="normal-case text-[#B0A88F]">(first image is the cover · max 8)</span>
            </p>
            {images.length === 0 && (
              <p className="rounded-md border border-dashed border-[#E0D9C8] px-3 py-4 text-center text-sm text-[#B0A88F]">
                No images yet — pick from the gallery below.
              </p>
            )}
            {images.map((url, i) => (
              <div key={`${url}-${i}`} className="flex items-center gap-2">
                <img
                  src={url}
                  alt={`Image ${i + 1}`}
                  className="size-10 shrink-0 rounded border border-[#EAE2D3] object-cover"
                />
                <Input
                  value={url}
                  onChange={(e) =>
                    setImages((prev) => prev.map((u, idx) => (idx === i ? e.target.value : u)))
                  }
                  className="flex-1 border-[#E0D9C8] bg-white text-xs"
                  aria-label={`Image URL ${i + 1}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={i === 0}
                  onClick={() => moveImage(i, -1)}
                  aria-label="Move image up"
                >
                  <ChevronUp className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={i === images.length - 1}
                  onClick={() => moveImage(i, 1)}
                  aria-label="Move image down"
                >
                  <ChevronDown className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Remove image"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ))}

            <GalleryPicker active={images} onToggle={addImage} />
          </section>

          {/* ---------- Variants ---------- */}
          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-[#8A8375]">Variants</p>

            {isEdit ? (
              <div className="rounded-md border border-[#EAE2D3] bg-[#FBF9F4] p-3">
                {(product?.variants ?? []).length === 0 ? (
                  <p className="text-sm text-[#8A8375]">This piece has no variants.</p>
                ) : (
                  <div className="space-y-1.5">
                    {product!.variants.map((v) => (
                      <div key={v.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-[#1C1A16]">
                          {v.name}
                          {v.size ? <span className="text-[#B0A88F]"> · {v.size}</span> : null}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-[#8A8375]">
                          {v.priceDelta ? `+₹${v.priceDelta} · ` : ""}stock {v.stock}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 border-t border-[#EAE2D3] pt-2 text-xs italic text-[#B0A88F]">
                  Variants cannot be edited after creation — manage their stock via the Inventory tab.
                </p>
              </div>
            ) : (
              <>
                {variantRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_100px_100px_auto]">
                    <Field label={i === 0 ? "Name" : undefined}>
                      <Input
                        value={row.name}
                        onChange={(e) => setVariant(i, { name: e.target.value })}
                        placeholder="Size 7"
                        className="border-[#E0D9C8] bg-white"
                      />
                    </Field>
                    <Field label={i === 0 ? "Size" : undefined}>
                      <Input
                        value={row.size}
                        onChange={(e) => setVariant(i, { size: e.target.value })}
                        placeholder="16 mm"
                        className="border-[#E0D9C8] bg-white"
                      />
                    </Field>
                    <Field label={i === 0 ? "Price Δ" : undefined}>
                      <Input
                        type="number"
                        value={row.priceDelta}
                        onChange={(e) => setVariant(i, { priceDelta: e.target.value })}
                        className="border-[#E0D9C8] bg-white"
                        aria-label={`Variant ${i + 1} price delta`}
                      />
                    </Field>
                    <Field label={i === 0 ? "Stock" : undefined}>
                      <Input
                        type="number"
                        min="0"
                        value={row.stock}
                        onChange={(e) => setVariant(i, { stock: e.target.value })}
                        className="border-[#E0D9C8] bg-white"
                        aria-label={`Variant ${i + 1} stock`}
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="mb-0.5 size-9 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setVariantRows((rows) => rows.filter((_, idx) => idx !== i))}
                      aria-label={`Remove variant ${i + 1}`}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVariantRows((rows) => [...rows, { ...EMPTY_VARIANT }])}
                  className="border-[#D4AF37]/50 text-[#7A5E14] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
                >
                  <Plus className="size-4" aria-hidden />
                  Add variant
                </Button>
                <p className="text-xs italic text-[#B0A88F]">
                  Variants are only set at creation. Their stock can later be adjusted from the Inventory tab.
                </p>
              </>
            )}
          </section>

          <DialogFooter className="gap-2 border-t border-[#EAE2D3] pt-4">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#171717] text-white hover:bg-[#2A2824]">
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Create product"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Gallery picker ----------
function GalleryPicker({ active, onToggle }: { active: string[]; onToggle: (url: string) => void }) {
  return (
    <div className="rounded-md border border-dashed border-[#D4AF37]/40 bg-[#FBF9F4] p-3">
      <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-[#8A8375]">Gallery — click to add or remove</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {PRODUCT_IMAGE_LIBRARY.map((src) => {
          const used = active.includes(src);
          return (
            <button
              key={src}
              type="button"
              onClick={() => onToggle(src)}
              title={src}
              aria-pressed={used}
              className={cn(
                "relative overflow-hidden rounded border transition-all",
                used
                  ? "border-[#D4AF37] opacity-60 ring-1 ring-[#D4AF37]"
                  : "border-transparent hover:border-[#D4AF37]/60"
              )}
            >
              <img src={src} alt={src.split("/").pop() ?? "Product image"} className="aspect-square w-full object-cover" />
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
  );
}

// ---------- Small field wrappers ----------
function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label className="text-xs font-medium text-[#5A544A]">{label}</Label>}
      {children}
      {hint && !error && <p className="text-[11px] text-[#B0A88F]">{hint}</p>}
      {error && (
        <p role="alert" className="text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#5A544A]">
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
      {label}
    </label>
  );
}

function slugify(v: string): string {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
