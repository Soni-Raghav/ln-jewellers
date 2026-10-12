"use client";

import { useCallback, useEffect, useState } from "react";
import { Boxes, Eye, Loader2, Search, Sparkles, PenLine, Download, XCircle, ShieldCheck } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrderDTO, Paginated } from "@/lib/types";
import { formatINR, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ORDER_STATUSES, PAYMENT_STATUSES, api, errMsg, humanize, isAuthError, qs, useDebounced } from "./api";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "PLACED", label: "Placed" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "IN_PRODUCTION", label: "In production" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function OrdersManager() {
  const [qInput, setQInput] = useState("");
  const q = useDebounced(qInput, 350);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Paginated<OrderDTO> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [detail, setDetail] = useState<OrderDTO | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderDTO | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<Paginated<OrderDTO>>(`/api/admin/orders${qs({ q, status, page })}`);
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

  // Patch a single order locally after a successful update
  function patchLocal(id: string, patch: Partial<OrderDTO>) {
    setData((prev) =>
      prev ? { ...prev, items: prev.items.map((o) => (o.id === id ? { ...o, ...patch } : o)) } : prev
    );
  }

  async function updateOrder(order: OrderDTO, patch: { status?: string; paymentStatus?: string }, successMsg: string) {
    setBusyId(order.id);
    try {
      await api(`/api/admin/orders/${order.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      toast.success(successMsg);
      patchLocal(order.id, patch);
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
      await load(); // restore truth on failure
    } finally {
      setBusyId(null);
    }
  }

  function handleStatusChange(order: OrderDTO, value: string) {
    if (value === "CANCELLED") {
      setCancelTarget(order);
      return;
    }
    void updateOrder(order, { status: value }, `Order ${order.orderNumber} → ${humanize(value)}.`);
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    const order = cancelTarget;
    setCancelTarget(null);
    await updateOrder(
      order,
      { status: "CANCELLED" },
      `Order ${order.orderNumber} cancelled — inventory has been restocked.`
    );
  }

  async function declineCancelRequest(order: OrderDTO) {
    setBusyId(order.id);
    try {
      await api(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ cancelRequested: false }),
      });
      toast.success(`Cancellation request for ${order.orderNumber} declined — customer keeps the order.`);
      patchLocal(order.id, { cancelRequested: false, cancelReason: null, cancelRequestedAt: null });
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {/* ---------- Toolbar ---------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-[#1C1A16]">Orders</h2>
          <p className="text-sm text-[#8A8375]">
            {data ? `${data.total} order${data.total === 1 ? "" : "s"}` : "Loading orders…"}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-[#D4AF37]/50 text-[#7A5E14] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
            onClick={() => window.open("/api/admin/orders/export", "_blank")}
            title="Download every order as CSV"
          >
            <Download className="mr-2 size-4" aria-hidden />
            Export CSV
          </Button>
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#B0A88F]" aria-hidden />
            <Input
              value={qInput}
              onChange={(e) => {
                setQInput(e.target.value);
                setPage(1);
              }}
              placeholder="Search number, customer, email, phone…"
              aria-label="Search orders"
              className="w-full border-[#E0D9C8] bg-white pl-8"
            />
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="admin-scroll flex gap-1.5 overflow-x-auto pb-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value || "all"}
            type="button"
            onClick={() => {
              setStatus(t.value);
              setPage(1);
            }}
            aria-pressed={status === t.value}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
              status === t.value
                ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#7A5E14]"
                : "border-[#E0D9C8] bg-white text-[#8A8375] hover:border-[#D4AF37]/50 hover:text-[#7A5E14]"
            )}
          >
            {t.label}
          </button>
        ))}
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
              <p className="text-sm text-[#8A8375]">No orders match this view.</p>
            </div>
          ) : (
            <div className="admin-scroll max-h-[70vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#EAE2D3] hover:bg-transparent">
                    <TableHead className="pl-4 text-[11px] uppercase tracking-wider text-[#8A8375]">Order</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Customer</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Items</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Total</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Payment</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Pay status</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Status</TableHead>
                    <TableHead className="pr-4 text-right text-[11px] uppercase tracking-wider text-[#8A8375]">
                      Detail
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((o) => (
                    <TableRow key={o.id} className="border-[#F0EAD9]">
                      <TableCell className="pl-4">
                        <p className="flex items-center gap-1.5 font-mono text-xs font-medium text-[#7A5E14]">
                          {o.orderNumber}
                          {o.cancelRequested && o.status !== "CANCELLED" && (
                            <span
                              className="relative flex h-2 w-2 shrink-0"
                              title="Customer requested cancellation"
                              aria-label="Customer requested cancellation"
                            >
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-70" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-600" />
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-[#B0A88F]">{formatDate(o.createdAt)}</p>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-40 truncate text-sm text-[#1C1A16]">{o.customerName}</p>
                        <p className="max-w-40 truncate text-[11px] text-[#B0A88F]">{o.email}</p>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-[#5A544A]">{o.items.length}</TableCell>
                      <TableCell className="text-sm tabular-nums">{formatINR(o.total)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[11px]",
                            o.paymentMethod === "RAZORPAY"
                              ? "border-[#D8D2C4] bg-white text-[#5A544A]"
                              : "border-[#E6C87A]/70 bg-[#FAF3E0] text-[#8A6D1D]"
                          )}
                        >
                          {o.paymentMethod === "RAZORPAY" ? (
                            <Sparkles className="mr-1 size-3" aria-hidden />
                          ) : null}
                          {humanize(o.paymentMethod)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={o.paymentStatus}
                          onValueChange={(v) =>
                            void updateOrder(o, { paymentStatus: v }, `Payment for ${o.orderNumber} marked ${humanize(v)}.`)
                          }
                          disabled={busyId === o.id}
                        >
                          <SelectTrigger size="sm" className="w-28 border-[#E0D9C8] bg-white text-xs" aria-label={`Payment status for ${o.orderNumber}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {humanize(s)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={o.status}
                          onValueChange={(v) => handleStatusChange(o, v)}
                          disabled={busyId === o.id}
                        >
                          <SelectTrigger size="sm" className="w-36 border-[#E0D9C8] bg-white text-xs" aria-label={`Status for ${o.orderNumber}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ORDER_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {humanize(s)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-[#5A544A] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
                          onClick={() => setDetail(o)}
                          aria-label={`View order ${o.orderNumber}`}
                          title="View detail"
                        >
                          {busyId === o.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <Eye className="size-4" aria-hidden />
                          )}
                        </Button>
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

      {/* ---------- Detail dialog ---------- */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="admin-scroll max-h-[90vh] overflow-y-auto border-[#EAE2D3] sm:max-w-2xl">
          <DialogHeader>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#B0A88F]">
              {detail ? formatDate(detail.createdAt) : ""}
            </p>
            <DialogTitle className="font-serif text-xl text-[#1C1A16]">
              Order {detail?.orderNumber}
            </DialogTitle>
            <DialogDescription>
              {detail ? (
                <span className="flex flex-wrap items-center gap-2">
                  {orderStatusBadge(detail.status)}
                  {paymentBadge(detail.paymentStatus)}
                  {paymentMethodBadge(detail.paymentMethod)}
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-5">
              {/* Customer cancellation request */}
              {detail.cancelRequested && detail.status !== "CANCELLED" && (
                <section className="rounded-md border border-amber-300 bg-amber-50 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                    <XCircle className="size-4" aria-hidden />
                    Customer requested cancellation
                    {detail.cancelRequestedAt && (
                      <span className="text-xs font-normal text-amber-700/80">· {formatDate(detail.cancelRequestedAt)}</span>
                    )}
                  </p>
                  {detail.cancelReason && (
                    <p className="mt-1 rounded bg-white/70 px-2 py-1 text-xs italic text-amber-900">“{detail.cancelReason}”</p>
                  )}
                  <p className="mt-1.5 text-xs leading-relaxed text-amber-700">
                    Approving cancels the order and restocks every piece. Declining keeps it — please call the customer first.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busyId === detail.id}
                      onClick={() => {
                        setCancelTarget(detail);
                      }}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      <XCircle className="mr-1.5 size-3.5" aria-hidden /> Approve &amp; cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === detail.id}
                      onClick={() => void declineCancelRequest(detail)}
                      className="border-amber-400 text-amber-800 hover:bg-amber-100"
                    >
                      <ShieldCheck className="mr-1.5 size-3.5" aria-hidden /> Keep order (decline)
                    </Button>
                  </div>
                </section>
              )}

              {/* Customer */}
              <section className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-[#F0EAD9] bg-[#FBF9F4] p-3 text-sm">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-[#8A8375]">Customer</p>
                  <p className="font-medium text-[#1C1A16]">{detail.customerName}</p>
                  <p className="text-[#5A544A]">
                    <a href={`mailto:${detail.email}`} className="underline decoration-[#D4AF37]/50 underline-offset-2 hover:text-[#7A5E14]">
                      {detail.email}
                    </a>
                  </p>
                  <p className="text-[#5A544A]">{detail.phone}</p>
                </div>
                <div className="rounded-md border border-[#F0EAD9] bg-[#FBF9F4] p-3 text-sm">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-[#8A8375]">Ship to</p>
                  <p className="text-[#5A544A]">{detail.address}</p>
                  <p className="text-[#5A544A]">
                    {detail.city}, {detail.state} — {detail.pincode}
                  </p>
                  {detail.notes && (
                    <p className="mt-1 border-t border-[#EAE2D3] pt-1 text-xs italic text-[#8A8375]">
                      Note: {detail.notes}
                    </p>
                  )}
                  {detail.engravingText && (
                    <p className="mt-2 flex items-start gap-1.5 rounded border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-2 py-1.5 text-xs text-[#7A5E14]">
                      <PenLine className="mt-0.5 size-3 shrink-0" aria-hidden />
                      <span>
                        Engrave: <span className="font-serif italic tracking-wider">“{detail.engravingText}”</span>
                      </span>
                    </p>
                  )}
                </div>
              </section>

              {/* Items */}
              <section>
                <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-[#8A8375]">Pieces</p>
                <div className="space-y-2">
                  {detail.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 rounded-md border border-[#F0EAD9] p-2">
                      {it.image ? (
                        <img
                          src={it.image}
                          alt={it.name}
                          className="size-12 shrink-0 rounded border border-[#EAE2D3] object-cover"
                        />
                      ) : (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded border border-[#EAE2D3] bg-[#FBF9F4]">
                          <Boxes className="size-4 text-[#D4AF37]" aria-hidden />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#1C1A16]">{it.name}</p>
                        <p className="font-mono text-[11px] text-[#B0A88F]">
                          {it.sku}
                          {it.variantName ? ` · ${it.variantName}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm tabular-nums text-[#1C1A16]">{formatINR(it.lineTotal)}</p>
                        <p className="text-[11px] tabular-nums text-[#8A8375]">
                          {it.quantity} × {formatINR(it.unitPrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Totals */}
              <section className="rounded-md border border-[#F0EAD9] bg-[#FBF9F4] p-3 text-sm">
                <div className="space-y-1">
                  <TotalRow label="Subtotal" value={formatINR(detail.subtotal)} />
                  {detail.discount > 0 && <TotalRow label="Discount" value={`− ${formatINR(detail.discount)}`} />}
                  {!!detail.couponDiscount && detail.couponDiscount > 0 && detail.couponCode && (
                    <TotalRow label={`Coupon ${detail.couponCode}`} value={`− ${formatINR(detail.couponDiscount)}`} gold />
                  )}
                  <TotalRow label="Shipping" value={detail.shipping === 0 ? "Free" : formatINR(detail.shipping)} />
                  {!!detail.giftWrap && !!detail.giftWrapFee && detail.giftWrapFee > 0 && (
                    <TotalRow label="Signature gift wrap" value={formatINR(detail.giftWrapFee)} gold />
                  )}
                  {!!detail.engravingText && !!detail.engravingFee && detail.engravingFee > 0 && (
                    <TotalRow label={`Engraving “${detail.engravingText}”`} value={formatINR(detail.engravingFee)} gold />
                  )}
                  <TotalRow label="Tax" value={formatINR(detail.tax)} />
                </div>
                <Separator className="my-2 bg-[#EAE2D3]" />
                <div className="flex items-center justify-between">
                  <span className="font-serif text-base text-[#1C1A16]">Total</span>
                  <span className="font-serif text-lg tabular-nums text-[#D4AF37]">{formatINR(detail.total)}</span>
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Cancel confirm ---------- */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent className="border-[#EAE2D3]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Cancel order {cancelTarget?.orderNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancelling marks the order as CANCELLED and automatically restocks every item back into inventory. This
              cannot be undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => void confirmCancel()}
            >
              Cancel order & restock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- Small helpers ----------
function TotalRow({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${gold ? "text-[#7A5E14]" : "text-[#5A544A]"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function orderStatusBadge(status: string) {
  if (status === "CANCELLED") {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-[11px] text-red-700">
        Cancelled
      </Badge>
    );
  }
  if (status === "DELIVERED") {
    return (
      <Badge variant="outline" className="border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[11px] text-[#7A5E14]">
        Delivered
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-[#E6C87A]/70 bg-[#FAF3E0] text-[11px] text-[#8A6D1D]">
      {humanize(status)}
    </Badge>
  );
}

function paymentBadge(status: string) {
  if (status === "PAID") {
    return (
      <Badge variant="outline" className="border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[11px] text-[#7A5E14]">
        Paid
      </Badge>
    );
  }
  if (status === "REFUNDED") {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-[11px] text-red-700">
        Refunded
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-[#D8D2C4] bg-white text-[11px] text-[#5A544A]">
      Unpaid
    </Badge>
  );
}

function paymentMethodBadge(method: string) {
  return (
    <Badge variant="outline" className="border-[#D8D2C4] bg-white text-[11px] text-[#5A544A]">
      {humanize(method)}
    </Badge>
  );
}
