"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, MessageSquare, Star, Trash2, X } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Paginated, Review } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api, errMsg, isAuthError, qs } from "./api";

type AdminReview = Review & { product: { name: string; slug: string; sku: string } };

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
] as const;

type FilterId = (typeof FILTERS)[number]["value"];

export default function ReviewsManager() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AdminReview> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminReview | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<Paginated<AdminReview>>(`/api/admin/reviews${qs({ filter, page })}`);
      setData(res);
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleApprove(review: AdminReview) {
    setBusyId(review.id);
    try {
      await api(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        body: JSON.stringify({ approved: !review.approved }),
      });
      toast.success(
        review.approved
          ? `Review by ${review.name} unapproved and hidden.`
          : `Review by ${review.name} approved and published.`
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
      await api(`/api/admin/reviews/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`Review by ${deleteTarget.name} deleted.`);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-[#1C1A16]">Reviews</h2>
          <p className="text-sm text-[#8A8375]">
            {data ? `${data.total} review${data.total === 1 ? "" : "s"}` : "Loading reviews…"}
          </p>
        </div>
        <div className="flex gap-1.5">
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
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                filter === f.value
                  ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#7A5E14]"
                  : "border-[#E0D9C8] bg-white text-[#8A8375] hover:border-[#D4AF37]/50 hover:text-[#7A5E14]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="border-[#EAE2D3] bg-white p-0">
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full bg-[#EFEAE0]" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <MessageSquare className="size-8 text-[#D4AF37]" aria-hidden />
              <p className="text-sm text-[#8A8375]">No reviews in this view.</p>
            </div>
          ) : (
            <div className="admin-scroll max-h-[70vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#EAE2D3] hover:bg-transparent">
                    <TableHead className="pl-4 text-[11px] uppercase tracking-wider text-[#8A8375]">Product</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Reviewer</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Rating</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Review</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Date</TableHead>
                    <TableHead className="pr-4 text-right text-[11px] uppercase tracking-wider text-[#8A8375]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((r) => (
                    <TableRow key={r.id} className="border-[#F0EAD9]">
                      <TableCell className="pl-4">
                        <p className="max-w-44 truncate text-sm font-medium text-[#1C1A16]" title={r.product?.name}>
                          {r.product?.name ?? "—"}
                        </p>
                        {r.product?.sku && (
                          <p className="font-mono text-[11px] text-[#B0A88F]">{r.product.sku}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-[#5A544A]">{r.name}</TableCell>
                      <TableCell>
                        <span className="flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "size-3.5",
                                i < r.rating ? "fill-[#D4AF37] text-[#D4AF37]" : "text-[#D8D2C4]"
                              )}
                              aria-hidden
                            />
                          ))}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-72">
                        <p className="truncate text-sm text-[#1C1A16]" title={r.title ?? undefined}>
                          {r.title && <span className="font-medium">{r.title} — </span>}
                          <span className="text-[#5A544A]">{r.comment}</span>
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-[#8A8375]">{formatDate(r.createdAt)}</TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 gap-1 px-2 text-xs",
                              r.approved
                                ? "border-[#D8D2C4] text-[#5A544A] hover:bg-[#F5F1E8]"
                                : "border-[#D4AF37]/50 text-[#7A5E14] hover:bg-[#D4AF37]/10 hover:text-[#7A5E14]"
                            )}
                            disabled={busyId === r.id}
                            onClick={() => void toggleApprove(r)}
                            title={r.approved ? "Unapprove" : "Approve"}
                          >
                            {busyId === r.id ? (
                              <Loader2 className="size-3.5 animate-spin" aria-hidden />
                            ) : r.approved ? (
                              <X className="size-3.5" aria-hidden />
                            ) : (
                              <Check className="size-3.5" aria-hidden />
                            )}
                            {r.approved ? "Unapprove" : "Approve"}
                          </Button>
                          <Badge
                            variant="outline"
                            className={cn(
                              "ml-1 hidden text-[10px] sm:inline",
                              r.approved
                                ? "border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#7A5E14]"
                                : "border-[#D8D2C4] bg-white text-[#B0A88F]"
                            )}
                          >
                            {r.approved ? "Live" : "Hidden"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setDeleteTarget(r)}
                            aria-label={`Delete review by ${r.name}`}
                            title="Delete"
                          >
                            <Trash2 className="size-4" aria-hidden />
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-[#EAE2D3]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete review by {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the review permanently. Deleting is not required to hide a review — unapproving hides it
              from the storefront.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep review</AlertDialogCancel>
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
                "Delete review"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
