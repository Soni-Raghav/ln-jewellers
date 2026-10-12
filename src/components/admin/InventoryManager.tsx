"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  Download,
  History,
  Loader2,
  PackageX,
  Search,
  SlidersHorizontal,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Paginated } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MOVEMENT_REASONS, api, errMsg, humanize, isAuthError, qs, useDebounced } from "./api";

// ---------- Local API shapes ----------
interface InventoryVariant {
  id: string;
  name: string;
  stock: number;
  active: boolean;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  image: string | null;
  categoryName: string;
  stock: number;
  trackInventory: boolean;
  lowStockThreshold: number;
  variants: InventoryVariant[];
}

interface Movement {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  actor: string | null;
  createdAt: string;
  variantName: string | null;
}

type InventoryResponse = Paginated<InventoryItem> & { movements: Movement[] };

const FILTERS = [
  { value: "all", label: "All", icon: Boxes },
  { value: "low", label: "Low", icon: SlidersHorizontal },
  { value: "out", label: "Out of stock", icon: PackageX },
  { value: "untracked", label: "Untracked", icon: EyeOff },
] as const;

type FilterId = (typeof FILTERS)[number]["value"];

export default function InventoryManager() {
  const [qInput, setQInput] = useState("");
  const q = useDebounced(qInput, 350);
  const [filter, setFilter] = useState<FilterId>("all");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Adjust dialog state
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);
  const [adjustVariant, setAdjustVariant] = useState<string>("main");
  const [deltaStr, setDeltaStr] = useState("");
  const [reason, setReason] = useState<string>("RESTOCK");
  const [note, setNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // History dialog state
  const [historyTarget, setHistoryTarget] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<Movement[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<InventoryResponse>(`/api/admin/inventory${qs({ q, filter, page })}`);
      setData(res);
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [q, filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdjust(item: InventoryItem) {
    setAdjustTarget(item);
    setAdjustVariant("main");
    setDeltaStr("");
    setReason("RESTOCK");
    setNote("");
  }

  async function submitAdjust() {
    if (!adjustTarget) return;
    const delta = Number(deltaStr);
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error("Enter a non-zero adjustment (negative values reduce stock).");
      return;
    }
    setAdjusting(true);
    try {
      const payload: Record<string, unknown> = {
        productId: adjustTarget.id,
        delta,
        reason,
        note: note.trim(),
      };
      if (adjustVariant !== "main") payload.variantId = adjustVariant;
      const res = await api<{ success: boolean; newStock: number }>("/api/admin/inventory", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success(
        `${adjustVariant === "main" ? adjustTarget.name : "Variant"} stock adjusted — now ${res.newStock} unit${res.newStock === 1 ? "" : "s"}.`
      );
      setAdjustTarget(null);
      await load();
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setAdjusting(false);
    }
  }

  async function openHistory(item: InventoryItem) {
    setHistoryTarget(item);
    setMovements(null);
    setHistoryLoading(true);
    try {
      const res = await api<InventoryResponse>(`/api/admin/inventory${qs({ movementsFor: item.id })}`);
      setMovements(res.movements);
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
      setMovements([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {/* ---------- Toolbar ---------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-[#1C1A16]">Inventory</h2>
          <p className="text-sm text-[#8A8375]">
            {data ? `${data.total} tracked piece${data.total === 1 ? "" : "s"}` : "Loading stock…"}
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
              aria-label="Search inventory"
              className="w-full border-[#E0D9C8] bg-white pl-8 sm:w-60"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setFilter(f.value);
                  setPage(1);
                }}
                aria-pressed={filter === f.value}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                  filter === f.value
                    ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#7A5E14]"
                    : "border-[#E0D9C8] bg-white text-[#8A8375] hover:border-[#D4AF37]/50 hover:text-[#7A5E14]"
                )}
              >
                <f.icon className="size-3.5" aria-hidden />
                {f.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            className="border-[#D4AF37]/50 text-[#7A5E14] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
            onClick={() => window.open("/api/admin/inventory/export", "_blank")}
          >
            <Download className="size-4" aria-hidden />
            Export CSV
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
              <Boxes className="size-8 text-[#D4AF37]" aria-hidden />
              <p className="text-sm text-[#8A8375]">No inventory matches this view.</p>
            </div>
          ) : (
            <div className="admin-scroll max-h-[70vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#EAE2D3] hover:bg-transparent">
                    <TableHead className="pl-4 text-[11px] uppercase tracking-wider text-[#8A8375]">Product</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">SKU</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Category</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Main stock</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Variants</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Tracking</TableHead>
                    <TableHead className="pr-4 text-right text-[11px] uppercase tracking-wider text-[#8A8375]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow key={item.id} className="border-[#F0EAD9]">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="size-10 shrink-0 rounded-md border border-[#EAE2D3] object-cover"
                            />
                          ) : (
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[#EAE2D3] bg-[#FBF9F4]">
                              <Boxes className="size-4 text-[#D4AF37]" aria-hidden />
                            </span>
                          )}
                          <p className="max-w-52 truncate text-sm font-medium text-[#1C1A16]">{item.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#5A544A]">{item.sku}</TableCell>
                      <TableCell className="text-sm text-[#5A544A]">{item.categoryName}</TableCell>
                      <TableCell>{mainStockBadge(item)}</TableCell>
                      <TableCell>
                        {item.variants.length === 0 ? (
                          <span className="text-xs text-[#B0A88F]">—</span>
                        ) : (
                          <div className="flex max-w-56 flex-wrap gap-1">
                            {item.variants.map((v) => (
                              <Badge
                                key={v.id}
                                variant="outline"
                                className={cn(
                                  "border-[#E0D9C8] bg-[#FBF9F4] text-[10px] tabular-nums text-[#5A544A]",
                                  item.trackInventory && v.stock <= 0 && "border-red-200 bg-red-50 text-red-700"
                                )}
                              >
                                {v.name}: {v.stock}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[11px]",
                            item.trackInventory
                              ? "border-[#D8D2C4] bg-white text-[#5A544A]"
                              : "border-[#E6C87A]/70 bg-[#FAF3E0] text-[#8A6D1D]"
                          )}
                        >
                          {item.trackInventory ? "Tracked" : "Made to order"}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 px-2 text-xs text-[#5A544A] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
                            onClick={() => openAdjust(item)}
                            disabled={!item.trackInventory}
                            title={item.trackInventory ? "Adjust stock" : "Tracking disabled for this piece"}
                          >
                            <SlidersHorizontal className="size-3.5" aria-hidden />
                            Adjust
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 px-2 text-xs text-[#5A544A] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
                            onClick={() => void openHistory(item)}
                          >
                            <History className="size-3.5" aria-hidden />
                            History
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

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

      {/* ---------- Adjust dialog ---------- */}
      <Dialog open={!!adjustTarget} onOpenChange={(o) => !o && !adjusting && setAdjustTarget(null)}>
        <DialogContent className="border-[#EAE2D3] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-[#1C1A16]">Adjust stock</DialogTitle>
            <DialogDescription>
              {adjustTarget?.name} — movements are logged to the audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#5A544A]">Target</Label>
              <Select value={adjustVariant} onValueChange={setAdjustVariant}>
                <SelectTrigger className="w-full border-[#E0D9C8] bg-white" aria-label="Stock target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Main stock (currently {adjustTarget?.stock ?? 0})</SelectItem>
                  {adjustTarget?.variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} (currently {v.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="adjust-delta" className="text-xs font-medium text-[#5A544A]">
                  Delta (±)
                </Label>
                <Input
                  id="adjust-delta"
                  type="number"
                  value={deltaStr}
                  onChange={(e) => setDeltaStr(e.target.value)}
                  placeholder="+5 or -2"
                  className="border-[#E0D9C8] bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#5A544A]">Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="w-full border-[#E0D9C8] bg-white" aria-label="Adjustment reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {humanize(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adjust-note" className="text-xs font-medium text-[#5A544A]">
                Note (optional)
              </Label>
              <Input
                id="adjust-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Received from karigar #12"
                maxLength={300}
                className="border-[#E0D9C8] bg-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={adjusting} onClick={() => setAdjustTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitAdjust()}
              disabled={adjusting || deltaStr.trim() === ""}
              className="bg-[#171717] text-white hover:bg-[#2A2824]"
            >
              {adjusting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Applying…
                </>
              ) : (
                "Apply adjustment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- History dialog ---------- */}
      <Dialog open={!!historyTarget} onOpenChange={(o) => !o && setHistoryTarget(null)}>
        <DialogContent className="border-[#EAE2D3] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-[#1C1A16]">Stock history</DialogTitle>
            <DialogDescription>{historyTarget?.name} — last 50 movements</DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-[#EFEAE0]" />
              ))}
            </div>
          ) : !movements || movements.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#8A8375]">No movements recorded for this piece yet.</p>
          ) : (
            <div className="admin-scroll max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {movements.map((m) => (
                <div key={m.id} className="rounded-md border border-[#F0EAD9] bg-[#FBF9F4] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "font-mono text-sm font-semibold tabular-nums",
                        m.delta >= 0 ? "text-emerald-700" : "text-red-600"
                      )}
                    >
                      {m.delta >= 0 ? `+${m.delta}` : m.delta}
                    </span>
                    <span className="text-xs text-[#8A8375]">{humanize(m.reason)}</span>
                  </div>
                  {m.variantName && <p className="text-xs text-[#5A544A]">Variant: {m.variantName}</p>}
                  {m.note && <p className="truncate text-xs italic text-[#8A8375]" title={m.note}>{m.note}</p>}
                  <p className="text-[11px] text-[#B0A88F]">
                    {formatDate(m.createdAt)} · {m.actor ?? "system"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Badge helpers ----------
function mainStockBadge(item: InventoryItem) {
  if (!item.trackInventory) {
    return (
      <Badge variant="outline" className="border-[#E6C87A]/70 bg-[#FAF3E0] text-[11px] text-[#8A6D1D]">
        Made to order
      </Badge>
    );
  }
  if (item.stock <= 0) {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-[11px] tabular-nums text-red-700">
        0 · Out of stock
      </Badge>
    );
  }
  if (item.stock <= item.lowStockThreshold) {
    return (
      <Badge variant="outline" className="border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[11px] tabular-nums text-[#7A5E14]">
        {item.stock} · Low (≤ {item.lowStockThreshold})
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-[#D8D2C4] bg-white text-[11px] tabular-nums text-[#5A544A]">
      {item.stock} in stock
    </Badge>
  );
}
