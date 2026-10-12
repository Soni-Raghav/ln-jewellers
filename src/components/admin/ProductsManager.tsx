"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  Gem,
  Loader2,
  Pencil,
  Plus,
  Search,
  Send,
  Undo2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Paginated, Product } from "@/lib/types";
import { formatINR, netPrice, stockLabel } from "@/lib/format";
import { api, errMsg, isAuthError, qs, useDebounced } from "./api";
import ProductForm from "./ProductForm";

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
];

export default function ProductsManager() {
  const [qInput, setQInput] = useState("");
  const q = useDebounced(qInput, 350);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Paginated<Product> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<Paginated<Product>>(`/api/admin/products${qs({ q, status, page })}`);
      setData(res);
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [q, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function togglePublish(p: Product) {
    const next = p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    setBusyId(p.id);
    try {
      await api(`/api/admin/products/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      toast.success(
        next === "PUBLISHED" ? `“${p.name}” is now live on the storefront.` : `“${p.name}” unpublished.`
      );
      await load();
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api<{ success: boolean; archived?: boolean; deleted?: boolean; message?: string }>(
        `/api/admin/products/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      if (res.archived) {
        toast.info(res.message || "Product has order history — archived instead of deleted.");
      } else {
        toast.success(`“${deleteTarget.name}” deleted.`);
      }
      setDeleteTarget(null);
      await load();
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {/* ---------- Toolbar ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-[#1C1A16]">Products</h2>
          <p className="text-sm text-[#8A8375]">
            {data ? `${data.total} piece${data.total === 1 ? "" : "s"} in the catalog` : "Loading catalog…"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#B0A88F]" aria-hidden />
            <Input
              value={qInput}
              onChange={(e) => {
                setQInput(e.target.value);
                setPage(1);
              }}
              placeholder="Search name or SKU…"
              aria-label="Search products"
              className="w-full border-[#E0D9C8] bg-white pl-8 sm:w-64"
            />
          </div>
          <Select
            value={status || "all"}
            onValueChange={(v) => {
              setStatus(v === "all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full border-[#E0D9C8] bg-white sm:w-40" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (
                <SelectItem key={f.value || "all"} value={f.value || "all"}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="bg-[#171717] text-white hover:bg-[#2A2824]"
            onClick={() => {
              setEditProduct(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            New Product
          </Button>
        </div>
      </div>

      {/* ---------- Table ---------- */}
      <Card className="border-[#EAE2D3] bg-white p-0">
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full bg-[#EFEAE0]" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Gem className="size-8 text-[#D4AF37]" aria-hidden />
              <p className="text-sm text-[#8A8375]">No products match this view.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditProduct(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" aria-hidden />
                Create your first piece
              </Button>
            </div>
          ) : (
            <div className="admin-scroll max-h-[70vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#EAE2D3] hover:bg-transparent">
                    <TableHead className="pl-4 text-[11px] uppercase tracking-wider text-[#8A8375]">Piece</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">SKU</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Price</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Stock</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Category</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Flags</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Status</TableHead>
                    <TableHead className="pr-4 text-right text-[11px] uppercase tracking-wider text-[#8A8375]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((p) => {
                    const label = stockLabel(p.stock, p.trackInventory, p.lowStockThreshold);
                    return (
                      <TableRow key={p.id} className="border-[#F0EAD9]">
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3">
                            {p.images[0] ? (
                              <img
                                src={p.images[0]}
                                alt={p.name}
                                className="size-11 shrink-0 rounded-md border border-[#EAE2D3] object-cover"
                              />
                            ) : (
                              <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[#EAE2D3] bg-[#FBF9F4]">
                                <Gem className="size-4 text-[#D4AF37]" aria-hidden />
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="max-w-52 truncate text-sm font-medium text-[#1C1A16]">{p.name}</p>
                              <p className="max-w-52 truncate text-xs text-[#B0A88F]">/{p.slug}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-[#5A544A]">{p.sku}</TableCell>
                        <TableCell>
                          {p.discountPercent > 0 ? (
                            <div className="leading-tight">
                              <p className="text-sm tabular-nums">{formatINR(netPrice(p.price, p.discountPercent))}</p>
                              <p className="text-xs tabular-nums text-[#B0A88F] line-through">{formatINR(p.price)}</p>
                            </div>
                          ) : (
                            <span className="text-sm tabular-nums">{formatINR(p.price)}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StockBadge stock={p.stock} track={p.trackInventory} threshold={p.lowStockThreshold} label={label.label} />
                        </TableCell>
                        <TableCell className="text-sm text-[#5A544A]">{p.category?.name ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex max-w-36 flex-wrap gap-1">
                            {p.featured && <TinyFlag label="Featured" />}
                            {p.bestSeller && <TinyFlag label="Best" />}
                            {p.trending && <TinyFlag label="Trending" />}
                            {p.handmade && <TinyFlag label="Handmade" />}
                          </div>
                        </TableCell>
                        <TableCell>{productStatusBadge(p.status)}</TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-[#5A544A] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
                              onClick={() => {
                                setEditProduct(p);
                                setFormOpen(true);
                              }}
                              aria-label={`Edit ${p.name}`}
                              title="Edit"
                            >
                              <Pencil className="size-4" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 px-2 text-xs text-[#5A544A] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
                              disabled={busyId === p.id}
                              onClick={() => void togglePublish(p)}
                              title={p.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                            >
                              {busyId === p.id ? (
                                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                              ) : p.status === "PUBLISHED" ? (
                                <Undo2 className="size-3.5" aria-hidden />
                              ) : (
                                <Send className="size-3.5" aria-hidden />
                              )}
                              {p.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-[#5A544A] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
                              onClick={() => {
                                // Duplicate: prefill the create form from this piece (new SKU required)
                                setEditProduct({
                                  ...p,
                                  id: "",
                                  name: `${p.name} (Copy)`,
                                  sku: "",
                                  slug: "",
                                  status: "DRAFT",
                                  featured: false,
                                  bestSeller: false,
                                  trending: false,
                                  variants: p.variants ?? [],
                                });
                                setFormOpen(true);
                              }}
                              aria-label={`Duplicate ${p.name}`}
                              title="Duplicate as new draft"
                            >
                              <Copy className="size-4" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => setDeleteTarget(p)}
                              aria-label={`Delete ${p.name}`}
                              title="Delete"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {data && data.items.length > 0 && (
            <div className="flex items-center justify-between border-t border-[#EAE2D3] px-4 py-3">
              <p className="text-xs text-[#8A8375]">
                Page {data.page} of {totalPages} · {data.total} total
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Create / Edit dialog ---------- */}
      <ProductForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditProduct(null);
        }}
        product={editProduct}
        onSaved={() => void load()}
      />

      {/* ---------- Delete confirm ---------- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-[#EAE2D3]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the piece from the catalog. Products with order history are archived instead of
              deleted to keep records intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep product</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Deleting…
                </>
              ) : (
                "Delete product"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- Small local components ----------

function StockBadge({ stock, track, threshold, label }: { stock: number; track: boolean; threshold: number; label: string }) {
  let cls = "border-[#D8D2C4] bg-white text-[#5A544A]";
  if (track && stock <= 0) cls = "border-red-200 bg-red-50 text-red-700";
  else if (track && stock <= threshold) cls = "border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#7A5E14]";
  return (
    <Badge variant="outline" className={`text-[11px] tabular-nums ${cls}`}>
      {track ? `${stock} · ${label}` : label}
    </Badge>
  );
}

function productStatusBadge(status: string) {
  if (status === "PUBLISHED") {
    return (
      <Badge variant="outline" className="border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[11px] text-[#7A5E14]">
        Published
      </Badge>
    );
  }
  if (status === "ARCHIVED") {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-[11px] text-red-700">
        Archived
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-[#D8D2C4] bg-white text-[11px] text-[#5A544A]">
      Draft
    </Badge>
  );
}

function TinyFlag({ label }: { label: string }) {
  return (
    <Badge variant="outline" className="border-[#E6C87A]/70 bg-[#FAF3E0] px-1.5 py-0 text-[9px] uppercase tracking-wide text-[#8A6D1D]">
      {label}
    </Badge>
  );
}
