"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Clock,
  Gem,
  HelpCircle,
  Loader2,
  Mail,
  PackageX,
  Plus,
  ReceiptText,
  Star,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardStats } from "@/lib/types";
import { formatINR, formatDate } from "@/lib/format";
import { api, errMsg, humanize, isAuthError } from "./api";

// The dashboard endpoint returns slim order rows (no items array, has itemCount)
interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  total: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  itemCount: number;
  createdAt: string;
}

type DashboardData = Omit<DashboardStats, "recentOrders"> & { recentOrders: RecentOrder[] };

const KPIS: { key: keyof DashboardData; label: string; icon: LucideIcon; money?: boolean }[] = [
  { key: "totalProducts", label: "Total Products", icon: Gem },
  { key: "publishedProducts", label: "Published", icon: TrendingUp },
  { key: "totalInventoryUnits", label: "Inventory Units", icon: Boxes },
  { key: "totalOrders", label: "Total Orders", icon: ReceiptText },
  { key: "pendingOrders", label: "Pending Orders", icon: Clock },
  { key: "revenue", label: "Revenue", icon: Wallet, money: true },
  { key: "newInquiries", label: "New Inquiries", icon: Mail },
  { key: "subscribers", label: "Subscribers", icon: Users },
  { key: "pendingReviews", label: "Pending Reviews", icon: Star },
  { key: "pendingQuestions", label: "Pending Q & A", icon: HelpCircle },
  { key: "activeCoupons", label: "Active Coupons", icon: Ticket },
  { key: "couponRedemptions", label: "Coupon Uses", icon: ReceiptText },
  { key: "couponSavings", label: "Coupon Savings", icon: Wallet, money: true },
];

export default function Overview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [restockingId, setRestockingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<DashboardData>("/api/admin/dashboard");
      setData(res);
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function quickRestock(productId: string, name: string) {
    setRestockingId(productId);
    try {
      await api("/api/admin/inventory", {
        method: "POST",
        body: JSON.stringify({ productId, delta: 5, reason: "RESTOCK" }),
      });
      toast.success(`Added 5 units to “${name}”.`);
      await load();
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setRestockingId(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 13 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg border border-[#EAE2D3] bg-[#EFEAE0]" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-lg border border-[#EAE2D3] bg-[#EFEAE0]" />
          <Skeleton className="h-64 rounded-lg border border-[#EAE2D3] bg-[#EFEAE0]" />
        </div>
        <Skeleton className="h-80 rounded-lg border border-[#EAE2D3] bg-[#EFEAE0]" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="border-[#EAE2D3] bg-white">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="size-8 text-[#D4AF37]" aria-hidden />
          <p className="text-sm text-[#6B655A]">Could not load the dashboard. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------- KPI cards ---------- */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {KPIS.map((kpi) => {
            const raw = data[kpi.key];
            const value = typeof raw === "number" ? raw : 0;
            return (
              <Card
                key={kpi.key as string}
                className="group gap-2 border-[#EAE2D3] bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37]/50 hover:shadow-[0_8px_24px_-12px_rgba(212,175,55,0.45)]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-[#8A8375]">{kpi.label}</p>
                  <span className="grid size-6 place-items-center rounded-full bg-[#D4AF37]/10 transition-colors group-hover:bg-[#D4AF37]/20">
                    <kpi.icon className="size-3.5 text-[#A8862A]" aria-hidden />
                  </span>
                </div>
                <p className="font-serif text-2xl tabular-nums text-[#0A0A0A] sm:text-3xl">
                  {kpi.money ? formatINR(value) : value.toLocaleString("en-IN")}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ---------- 14-day sales chart ---------- */}
      <SalesChart series={data.salesSeries} />

      {/* ---------- Stock alerts ---------- */}
      <section aria-label="Stock alerts" className="grid gap-6 lg:grid-cols-2">
        <Card className="border-[#EAE2D3] bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
              <AlertTriangle className="size-4 text-[#D4AF37]" aria-hidden />
              Low stock
              <Badge variant="outline" className="ml-auto border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[10px] text-[#7A5E14]">
                {data.lowStock.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="admin-scroll max-h-72 space-y-2 overflow-y-auto">
            {data.lowStock.length === 0 && (
              <p className="py-6 text-center text-sm text-[#8A8375]">All stock levels are healthy.</p>
            )}
            {data.lowStock.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-md border border-[#F0EAD9] bg-[#FBF9F4] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1C1A16]">{p.name}</p>
                  <p className="font-mono text-xs text-[#8A8375]">{p.sku}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-[#7A5E14]">
                    <span className="font-serif text-base tabular-nums">{p.stock}</span>
                    <span className="text-[#B0A88F]"> / {p.lowStockThreshold}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restockingId === p.id}
                    onClick={() => void quickRestock(p.id, p.name)}
                    className="h-7 border-[#D4AF37]/50 px-2 text-xs text-[#7A5E14] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
                    aria-label={`Restock 5 units of ${p.name}`}
                  >
                    {restockingId === p.id ? (
                      <Loader2 className="size-3 animate-spin" aria-hidden />
                    ) : (
                      <Plus className="size-3" aria-hidden />
                    )}
                    5
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-[#EAE2D3] bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-[#1C1A16]">
              <PackageX className="size-4 text-red-600" aria-hidden />
              Out of stock
              <Badge variant="outline" className="ml-auto border-red-200 bg-red-50 text-[10px] text-red-700">
                {data.outOfStock.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="admin-scroll max-h-72 space-y-2 overflow-y-auto">
            {data.outOfStock.length === 0 && (
              <p className="py-6 text-center text-sm text-[#8A8375]">Nothing is out of stock.</p>
            )}
            {data.outOfStock.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-md border border-red-100 bg-red-50/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1C1A16]">{p.name}</p>
                  <p className="font-mono text-xs text-[#8A8375]">{p.sku}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-medium text-red-600">Out</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restockingId === p.id}
                    onClick={() => void quickRestock(p.id, p.name)}
                    className="h-7 border-[#D4AF37]/50 px-2 text-xs text-[#7A5E14] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
                    aria-label={`Restock 5 units of ${p.name}`}
                  >
                    {restockingId === p.id ? (
                      <Loader2 className="size-3 animate-spin" aria-hidden />
                    ) : (
                      <Plus className="size-3" aria-hidden />
                    )}
                    5
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ---------- Recent activity ---------- */}
      <section aria-label="Recent activity" className="grid gap-6 lg:grid-cols-3">
        <Card className="border-[#EAE2D3] bg-white lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif text-lg text-[#1C1A16]">Recent orders</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#8A8375]">No orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#EAE2D3] hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Order</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Customer</TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wider text-[#8A8375]">Total</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Status</TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wider text-[#8A8375]">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentOrders.map((o) => (
                    <TableRow key={o.id} className="border-[#F0EAD9]">
                      <TableCell className="font-mono text-xs font-medium text-[#7A5E14]">{o.orderNumber}</TableCell>
                      <TableCell className="max-w-40 truncate text-sm">{o.customerName}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatINR(o.total)}</TableCell>
                      <TableCell>{orderStatusBadge(o.status)}</TableCell>
                      <TableCell className="text-right text-xs text-[#8A8375]">{formatDate(o.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-[#EAE2D3] bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg text-[#1C1A16]">Recent inquiries</CardTitle>
            </CardHeader>
            <CardContent className="admin-scroll max-h-56 space-y-2 overflow-y-auto">
              {data.recentInquiries.length === 0 && (
                <p className="py-4 text-center text-sm text-[#8A8375]">No inquiries yet.</p>
              )}
              {data.recentInquiries.map((i) => (
                <div key={i.id} className="rounded-md border border-[#F0EAD9] bg-[#FBF9F4] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-[#1C1A16]">{i.name}</p>
                    {inquiryBadge(i.status)}
                  </div>
                  <p className="truncate text-xs italic text-[#8A8375]">{i.subject}</p>
                  <p className="text-[11px] text-[#B0A88F]">{formatDate(i.createdAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-[#EAE2D3] bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg text-[#1C1A16]">Top products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.topProducts.filter((p) => p.sold > 0).length === 0 && (
                <p className="py-2 text-center text-sm text-[#8A8375]">No sales recorded yet.</p>
              )}
              {data.topProducts
                .filter((p) => p.sold > 0)
                .map((p, idx) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 font-serif text-xs text-[#7A5E14]">
                      {idx + 1}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm text-[#1C1A16]">{p.name}</p>
                    <span className="shrink-0 text-xs tabular-nums text-[#8A8375]">{p.sold} sold</span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

// ---------- 14-day sales chart (pure SVG, gold bars) ----------
function SalesChart({ series }: { series: DashboardData["salesSeries"] }) {
  const W = 720;
  const H = 190;
  const PAD = { top: 16, right: 8, bottom: 26, left: 8 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxRevenue = Math.max(...series.map((d) => d.revenue), 1);
  const totalOrders = series.reduce((n, d) => n + d.orders, 0);
  const totalRevenue = series.reduce((n, d) => n + d.revenue, 0);
  const barGap = 6;
  const barW = Math.max(6, (innerW - barGap * (series.length - 1)) / series.length);

  return (
    <Card className="border-[#EAE2D3] bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 font-serif text-lg text-[#1C1A16]">
          <TrendingUp className="size-4 text-[#D4AF37]" aria-hidden />
          Last 14 days
          <span className="ml-auto flex flex-wrap gap-4 text-xs font-normal text-[#8A8375]">
            <span>
              <span className="font-serif text-base tabular-nums text-[#1C1A16]">{totalOrders}</span> orders
            </span>
            <span>
              <span className="font-serif text-base tabular-nums text-[#1C1A16]">{formatINR(totalRevenue)}</span> value
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-44 w-full"
          role="img"
          aria-label={`Bar chart of orders and revenue over the last 14 days: ${totalOrders} orders worth ${formatINR(totalRevenue)}`}
        >
          <defs>
            <linearGradient id="sales-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E6C87A" />
              <stop offset="100%" stopColor="#D4AF37" />
            </linearGradient>
          </defs>
          {/* baseline */}
          <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#EAE2D3" strokeWidth="1" />
          {series.map((d, i) => {
            const h = Math.max(d.revenue > 0 ? 4 : 0, (d.revenue / maxRevenue) * innerH);
            const x = PAD.left + i * (barW + barGap);
            const y = H - PAD.bottom - h;
            return (
              <g key={d.date}>
                <title>{`${d.label}: ${d.orders} order${d.orders === 1 ? "" : "s"} · ${formatINR(d.revenue)}`}</title>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx="3"
                  fill="url(#sales-bar)"
                  opacity={d.revenue > 0 ? 0.92 : 0.25}
                  className="transition-opacity hover:opacity-100"
                />
                {d.orders > 0 && (
                  <circle cx={x + barW / 2} cy={y - 7} r="2.4" fill="#0A0A0A" opacity="0.75" />
                )}
                {(i % 2 === 0 || i === series.length - 1) && (
                  <text
                    x={x + barW / 2}
                    y={H - PAD.bottom + 16}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#8A8375"
                  >
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <p className="mt-2 text-[11px] text-[#B0A88F]">
          Bars show order value per day · dots mark order days · hover a bar for details.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------- Status badges (subtle gold/charcoal; red only for cancelled/out) ----------
function orderStatusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "CANCELLED") {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-[11px] text-red-700">
        Cancelled
      </Badge>
    );
  }
  if (s === "DELIVERED") {
    return (
      <Badge variant="outline" className="border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[11px] text-[#7A5E14]">
        Delivered
      </Badge>
    );
  }
  if (s === "PLACED") {
    return (
      <Badge variant="outline" className="border-[#E6C87A]/70 bg-[#FAF3E0] text-[11px] text-[#8A6D1D]">
        Placed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-[#D8D2C4] bg-white text-[11px] text-[#5A544A]">
      {humanize(status)}
    </Badge>
  );
}

function inquiryBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "NEW") {
    return (
      <Badge variant="outline" className="border-[#E6C87A]/70 bg-[#FAF3E0] text-[10px] text-[#8A6D1D]">
        New
      </Badge>
    );
  }
  if (s === "RESOLVED") {
    return (
      <Badge variant="outline" className="border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[10px] text-[#7A5E14]">
        Resolved
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-[#D8D2C4] bg-white text-[10px] text-[#5A544A]">
      In progress
    </Badge>
  );
}
