"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Check, Loader2, Search, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StockAlertDTO } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api, errMsg, isAuthError, qs, useDebounced } from "./api";

interface StockAlertsData {
  items: StockAlertDTO[];
  total: number;
  page: number;
  pageSize: number;
  pendingCount: number;
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Awaiting outreach" },
  { value: "notified", label: "Notified" },
] as const;

type FilterId = (typeof FILTERS)[number]["value"];

export default function StockAlertsManager() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<StockAlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockAlertDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<StockAlertsData>(`/api/admin/stock-alerts${qs({ filter, q: debouncedSearch, page, pageSize: 12 })}`);
      setData(res);
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearch, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markNotified(alert: StockAlertDTO, notified: boolean) {
    setBusyId(alert.id);
    try {
      await api(`/api/admin/stock-alerts/${alert.id}`, {
        method: "PATCH",
        body: JSON.stringify({ notified }),
      });
      toast.success(
        notified
          ? `${alert.email} marked as notified.`
          : `${alert.email} moved back to awaiting outreach.`
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
      await api(`/api/admin/stock-alerts/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`Request from ${deleteTarget.email} removed.`);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      {/* ---------- summary ---------- */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-[#EAE2D3] bg-white">
          <CardContent className="flex items-center gap-4 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#D4AF37]/12">
              <Bell className="size-5 text-[#A8862A]" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#8A8375]">Awaiting outreach</p>
              <p className="font-serif text-2xl tabular-nums text-[#0A0A0A]">{data?.pendingCount ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#EAE2D3] bg-white">
          <CardContent className="flex items-center gap-4 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#D4AF37]/12">
              <BellRing className="size-5 text-[#A8862A]" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#8A8375]">Total requests</p>
              <p className="font-serif text-2xl tabular-nums text-[#0A0A0A]">{data?.total ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#D4AF37]/30 bg-gradient-to-br from-[#FAF6EA] to-white">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-[#8A8375]">Concierge tip</p>
            <p className="mt-1 text-sm leading-relaxed text-[#4A463C]">
              When a piece is restocked, WhatsApp the requester personally — gold lovers answer texts before emails.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---------- toolbar ---------- */}
      <Card className="border-[#EAE2D3] bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setFilter(f.value);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs uppercase tracking-wider transition-colors",
                    filter === f.value
                      ? "border-[#D4AF37] bg-[#0A0A0A] text-[#E6C87A]"
                      : "border-[#EAE2D3] bg-white text-[#6B655A] hover:border-[#D4AF37]/50"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#B0A88F]" aria-hidden />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search email, phone or piece…"
                className="border-[#EAE2D3] pl-9"
                aria-label="Search stock alerts"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------- list ---------- */}
      {loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg border border-[#EAE2D3] bg-[#EFEAE0]" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card className="border-[#EAE2D3] bg-white">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Bell className="size-8 text-[#D4AF37]" aria-hidden />
            <p className="font-serif text-lg text-[#1C1A16]">No requests here</p>
            <p className="max-w-sm text-sm text-[#6B655A]">
              When a piece sells out, shoppers can ask to be told the moment it returns — those requests land on this desk.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-[#EAE2D3] bg-white">
          <div className="admin-scroll overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Piece</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((a) => {
                  const outOfStock = a.product.trackInventory && a.product.stock <= 0;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {a.product.image ? (
                            <img src={a.product.image} alt="" className="size-11 shrink-0 rounded-md border border-[#EAE2D3] object-cover" />
                          ) : (
                            <span className="grid size-11 shrink-0 place-items-center rounded-md border border-[#EAE2D3] bg-[#F1E8D2] font-serif text-[#8A6D1F]">
                              {a.product.name.charAt(0)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="max-w-[220px] truncate text-sm font-medium text-[#1C1A16]">{a.product.name}</p>
                            <p className="text-xs text-[#8A8375]">
                              {a.product.sku} ·{" "}
                              <span className={outOfStock ? "text-destructive" : "text-emerald-700"}>
                                {outOfStock ? "still sold out" : `back in stock (${a.product.stock})`}
                              </span>
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <a href={`mailto:${a.email}`} className="text-sm text-[#1C1A16] underline-offset-2 hover:text-[#A8862A] hover:underline">
                          {a.email}
                        </a>
                        {a.phone && <p className="text-xs text-[#8A8375]">{a.phone}</p>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-[#6B655A]">{formatDate(a.createdAt)}</TableCell>
                      <TableCell>
                        {a.notified ? (
                          <Badge className="border-transparent bg-emerald-600/12 text-emerald-800">
                            Notified {a.notifiedAt ? `· ${formatDate(a.notifiedAt)}` : ""}
                          </Badge>
                        ) : (
                          <Badge className="border-transparent bg-[#D4AF37]/15 text-[#7A5E14]">Awaiting</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === a.id}
                            onClick={() => void markNotified(a, !a.notified)}
                            className={cn(
                              "h-8 gap-1.5 text-xs",
                              a.notified ? "text-[#6B655A]" : "text-[#1C6B3D] hover:bg-emerald-600/10"
                            )}
                            title={a.notified ? "Move back to awaiting outreach" : "Mark as personally notified"}
                          >
                            {busyId === a.id ? (
                              <Loader2 className="size-3.5 animate-spin" aria-hidden />
                            ) : a.notified ? (
                              <Bell className="size-3.5" aria-hidden />
                            ) : (
                              <Check className="size-3.5" aria-hidden />
                            )}
                            {a.notified ? "Reopen" : "Mark notified"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setDeleteTarget(a)}
                            aria-label={`Delete request from ${a.email}`}
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

          {/* Pagination */}
          {data.items.length > 0 && (
            <div className="flex items-center justify-between border-t border-[#EAE2D3] px-4 py-3">
              <p className="text-xs text-[#8A8375]">
                Page {data.page} of {totalPages} · {data.total} total
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ---------- delete confirm ---------- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-[#EAE2D3]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Remove request from “{deleteTarget?.email}”?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be listed for “{deleteTarget?.product.name}”. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep request</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
              Delete request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
