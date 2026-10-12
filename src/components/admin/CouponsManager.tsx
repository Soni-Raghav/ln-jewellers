"use client";

/**
 * CouponsManager — admin CRUD for discount coupons.
 * GET/POST /api/admin/coupons · PATCH/DELETE /api/admin/coupons/<id>
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Ticket, Plus, Trash2, Loader2, TicketPercent, TrendingUp, BadgeIndianRupee, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "./api";
import { formatINR, formatDate } from "@/lib/format";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: "PERCENT" | "FLAT";
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  active: boolean;
  usageCount: number;
  usageLimit: number | null;
  expiresAt: string | null;
  createdAt: string;
  granted?: number;
  orderCount?: number;
  revenue?: number;
}

interface CouponOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  subtotal: number;
  couponDiscount: number;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

const STATUS_TONE: Record<string, string> = {
  PLACED: "bg-[#D4AF37]/15 text-[#7A5E14]",
  CONFIRMED: "bg-emerald-600/12 text-emerald-800",
  IN_PRODUCTION: "bg-amber-600/12 text-amber-800",
  SHIPPED: "bg-[#D4AF37]/15 text-[#7A5E14]",
  DELIVERED: "bg-emerald-600/12 text-emerald-800",
  CANCELLED: "bg-red-600/12 text-red-700",
};

export default function CouponsManager() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [ordersFor, setOrdersFor] = useState<Coupon | null>(null);
  const [ordersData, setOrdersData] = useState<{ orders: CouponOrderRow[]; count: number; savedTotal: number } | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const openOrders = useCallback(async (c: Coupon) => {
    setOrdersFor(c);
    setOrdersData(null);
    setOrdersLoading(true);
    try {
      const res = await api<{ orders: CouponOrderRow[]; count: number; savedTotal: number }>(`/api/admin/coupons/${c.id}/orders`);
      setOrdersData(res);
    } catch (e) {
      toast.error(errMsg(e));
      setOrdersFor(null);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api<{ items: Coupon[] }>("/api/admin/coupons");
      setCoupons(data.items);
    } catch (e) {
      toast.error(errMsg(e));
      setCoupons([]);
    }
  }, []);

  useEffect(() => {
    let on = true;
    api<{ items: Coupon[] }>("/api/admin/coupons")
      .then((d) => on && setCoupons(d.items))
      .catch((e) => {
        if (on) {
          toast.error(errMsg(e));
          setCoupons([]);
        }
      });
    return () => {
      on = false;
    };
  }, []);

  const toggleActive = async (c: Coupon, active: boolean) => {
    try {
      await api(`/api/admin/coupons/${c.id}`, { method: "PATCH", body: JSON.stringify({ active }) });
      setCoupons((list) => list?.map((x) => (x.id === c.id ? { ...x, active } : x)) ?? null);
      toast.success(`${c.code} ${active ? "activated" : "paused"}`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const remove = async (c: Coupon) => {
    try {
      await api(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
      setCoupons((list) => list?.filter((x) => x.id !== c.id) ?? null);
      toast.success(`${c.code} deleted`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl">Coupons</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Validated server-side at checkout — clients can never dictate discounts.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]">
              <Plus className="mr-2 h-4 w-4" /> New coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="border-[#D4AF37]/30 bg-[#FAF7F0]">
            <DialogHeader>
              <DialogTitle className="font-serif">Create coupon</DialogTitle>
            </DialogHeader>
            <CouponForm
              onCreated={(c) => {
                setCoupons((list) => [c, ...(list ?? [])]);
                setCreateOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {!coupons ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full bg-muted" />)}
        </div>
      ) : coupons.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-[#D4AF37]/40 py-16 text-center">
          <TicketPercent className="mb-3 h-8 w-8 text-[#D4AF37]" />
          <p className="font-serif text-lg">No coupons yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first launch offer to appear at checkout.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* analytics summary strip */}
          {(() => {
            const totalSavings = coupons.reduce((n, c) => n + (c.granted ?? 0), 0);
            const totalOrders = coupons.reduce((n, c) => n + (c.orderCount ?? 0), 0);
            const totalRevenue = coupons.reduce((n, c) => n + (c.revenue ?? 0), 0);
            const avgBasket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
            const stats = [
              { label: "Savings given", value: `−${formatINR(totalSavings)}`, icon: BadgeIndianRupee, tone: "text-[#7A5E14]" },
              { label: "Coupon orders", value: String(totalOrders), icon: Ticket, tone: "text-[#1C1A16]" },
              { label: "Revenue influenced", value: formatINR(totalRevenue), icon: TrendingUp, tone: "text-[#1C1A16]" },
              { label: "Avg. coupon basket", value: formatINR(avgBasket), icon: TicketPercent, tone: "text-[#7A5E14]" },
            ];
            return (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-[#D4AF37]/25 bg-white p-4 transition-shadow hover:shadow-[0_8px_28px_-14px_rgba(212,175,55,0.55)]">
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-full bg-[#D4AF37]/12">
                        <s.icon className="size-4 text-[#A8862A]" aria-hidden />
                      </span>
                      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#8A8375]">{s.label}</p>
                    </div>
                    <p className={`mt-2 font-serif text-2xl ${s.tone}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        <div className="overflow-hidden rounded-xl border border-[#D4AF37]/25 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Min. order</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Avg. basket</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Savings given</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => {
                const expired = c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();
                const exhausted = c.usageLimit !== null && c.usageCount >= c.usageLimit;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-mono text-sm font-semibold tracking-wider">{c.code}</p>
                      {c.description && <p className="mt-0.5 max-w-[240px] truncate text-xs text-muted-foreground" title={c.description}>{c.description}</p>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {c.type === "PERCENT" ? `${c.value}%` : formatINR(c.value)}
                      {c.maxDiscount ? <span className="ml-1 text-xs text-muted-foreground">(cap {formatINR(c.maxDiscount)})</span> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{c.minSubtotal > 0 ? formatINR(c.minSubtotal) : "—"}</TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {(c.orderCount ?? 0) > 0 ? (
                        <button
                          onClick={() => void openOrders(c)}
                          className="font-medium text-[#1C1A16] underline decoration-[#D4AF37]/50 decoration-dotted underline-offset-4 transition-colors hover:text-[#A8862A]"
                          title="See the orders that used this code"
                        >
                          {c.orderCount}
                        </button>
                      ) : (
                        <span className="text-[#B0A88F]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm tabular-nums">
                      {(c.orderCount ?? 0) > 0 && (c.revenue ?? 0) > 0 ? (
                        <span title="Average order total (cancelled orders excluded)">{formatINR(Math.round((c.revenue ?? 0) / (c.orderCount ?? 1)))}</span>
                      ) : (
                        <span className="text-[#B0A88F]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.usageCount}{c.usageLimit !== null ? ` / ${c.usageLimit}` : ""}
                      {exhausted && <Badge className="ml-2 bg-destructive/15 text-destructive">Limit reached</Badge>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {c.granted && c.granted > 0 ? (
                        <span className="font-medium text-[#7A5E14]">−{formatINR(c.granted)}</span>
                      ) : (
                        <span className="text-[#B0A88F]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {c.expiresAt ? formatDate(c.expiresAt) : "Never"}
                      {expired && <Badge className="ml-2 bg-muted text-muted-foreground">Expired</Badge>}
                    </TableCell>
                    <TableCell>
                      <Switch checked={c.active} onCheckedChange={(v) => toggleActive(c, v)} aria-label={`Toggle ${c.code}`} />
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${c.code}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {c.code}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Customers will no longer be able to use this code. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(c)} className="bg-destructive text-white hover:bg-destructive/90">
                              Delete coupon
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        </div>
      )}

      {/* ---------- orders drill-down ---------- */}
      <Dialog open={!!ordersFor} onOpenChange={(o) => !o && setOrdersFor(null)}>
        <DialogContent className="max-h-[85vh] overflow-hidden border-[#D4AF37]/30 bg-[#FAF7F0] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <ReceiptText className="size-5 text-[#A8862A]" aria-hidden />
              Orders using <span className="font-mono tracking-wider">{ordersFor?.code}</span>
            </DialogTitle>
            {ordersData && (
              <DialogDescription>
                {ordersData.count} order{ordersData.count === 1 ? "" : "s"} ·{" "}
                <span className="text-[#7A5E14]">−{formatINR(ordersData.savedTotal)}</span> total discounts given
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="admin-scroll max-h-[60vh] overflow-y-auto pr-1">
            {ordersLoading ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg border border-[#EAE2D3] bg-[#EFEAE0]" />
                ))}
              </div>
            ) : ordersData && ordersData.orders.length > 0 ? (
              <div className="divide-y divide-[#EAE2D3]">
                {ordersData.orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold tracking-wide text-[#1C1A16]">{o.orderNumber}</p>
                      <p className="truncate text-xs text-[#8A8375]">
                        {o.customerName} · {o.email} · {formatDate(o.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium tabular-nums text-[#1C1A16]">{formatINR(o.total)}</p>
                      <p className="text-xs tabular-nums text-[#7A5E14]">−{formatINR(o.couponDiscount)} saved</p>
                    </div>
                    <Badge className={`shrink-0 border-transparent ${STATUS_TONE[o.status] ?? "bg-muted text-muted-foreground"}`}>
                      {o.status.replace("_", " ").toLowerCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-[#6B655A]">No orders have used this code yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CouponForm({ onCreated }: { onCreated: (c: Coupon) => void }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"PERCENT" | "FLAT">("PERCENT");
  const [value, setValue] = useState("10");
  const [minSubtotal, setMinSubtotal] = useState("25000");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setFields({});
    try {
      const data = await api<{ success: true; coupon: Coupon }>("/api/admin/coupons", {
        method: "POST",
        body: JSON.stringify({
          code,
          description,
          type,
          value: Number(value),
          minSubtotal: Number(minSubtotal || 0),
          maxDiscount: maxDiscount ? Number(maxDiscount) : null,
          usageLimit: usageLimit ? Number(usageLimit) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      toast.success(`${data.coupon.code} created`);
      onCreated(data.coupon);
    } catch (e) {
      const msg = errMsg(e);
      try {
        setFields((JSON.parse(msg) as { fields?: Record<string, string> }).fields ?? {});
      } catch {
        /* not a field-error payload */
      }
      toast.error(msg.replace(/^\{.*\}$/, "Validation failed — check the form"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Code *</Label>
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Za-z0-9_-]/g, ""))} placeholder="LN10" className="border-[#D4AF37]/40 bg-white font-mono uppercase" />
        {fields.code && <p className="text-xs text-destructive">{fields.code}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Description</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Launch offer — 10% off" className="border-[#D4AF37]/40 bg-white" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as "PERCENT" | "FLAT")}>
            <SelectTrigger className="border-[#D4AF37]/40 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENT">Percent (%)</SelectItem>
              <SelectItem value="FLAT">Flat (₹)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">{type === "PERCENT" ? "Percent (1–90) *" : "Amount (₹) *"}</Label>
          <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="border-[#D4AF37]/40 bg-white" />
          {fields.value && <p className="text-xs text-destructive">{fields.value}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Min. subtotal (₹)</Label>
          <Input type="number" value={minSubtotal} onChange={(e) => setMinSubtotal(e.target.value)} className="border-[#D4AF37]/40 bg-white" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Max discount (₹, optional)</Label>
          <Input type="number" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="e.g. 20000" className="border-[#D4AF37]/40 bg-white" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Usage limit</Label>
          <Input type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Unlimited" className="border-[#D4AF37]/40 bg-white" />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Expires on</Label>
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="border-[#D4AF37]/40 bg-white" />
        </div>
      </div>
      <Button onClick={submit} disabled={saving} className="h-11 w-full bg-[#D4AF37] font-medium text-black hover:bg-[#E6C87A]">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
        {saving ? "Creating…" : "Create coupon"}
      </Button>
    </div>
  );
}
