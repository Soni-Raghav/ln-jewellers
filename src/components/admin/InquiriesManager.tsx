"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, Phone, Search, Trash2 } from "lucide-react";
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
import type { Paginated } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { INQUIRY_STATUSES, api, errMsg, humanize, isAuthError, qs, useDebounced } from "./api";
import { cn } from "@/lib/utils";

interface InquiryDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function InquiriesManager() {
  const [qInput, setQInput] = useState("");
  const q = useDebounced(qInput, 350);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<Paginated<InquiryDTO> | null>(null);
  const [loading, setLoading] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState<InquiryDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<Paginated<InquiryDTO>>(`/api/admin/inquiries${qs({ q, page, pageSize: 12 })}`);
      setData(res);
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Client-side filter (the endpoint is not searchable server-side)
  const items = (data?.items ?? []).filter((i) => {
    if (!q.trim()) return true;
    const hay = `${i.name} ${i.email} ${i.phone ?? ""} ${i.subject} ${i.message}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  async function updateStatus(inquiry: InquiryDTO, status: string) {
    try {
      await api(`/api/admin/inquiries/${inquiry.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success(`Inquiry from ${inquiry.name} marked ${humanize(status)}.`);
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((i) => (i.id === inquiry.id ? { ...i, status } : i)) } : prev
      );
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/admin/inquiries/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`Inquiry from ${deleteTarget.name} deleted.`);
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
          <h2 className="font-serif text-2xl text-[#1C1A16]">Inquiries</h2>
          <p className="text-sm text-[#8A8375]">
            {data ? `${data.total} contact message${data.total === 1 ? "" : "s"}` : "Loading inquiries…"}
          </p>
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#B0A88F]" aria-hidden />
          <Input
            value={qInput}
            onChange={(e) => setPage(1)}
            placeholder="Filter by name, email, subject…"
            aria-label="Filter inquiries"
            className="w-full border-[#E0D9C8] bg-white pl-8"
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg border border-[#EAE2D3] bg-[#EFEAE0]" />
          ))}
        </div>
      ) : !data || items.length === 0 ? (
        <Card className="border-[#EAE2D3] bg-white">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Mail className="size-8 text-[#D4AF37]" aria-hidden />
            <p className="text-sm text-[#8A8375]">No inquiries match this view.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((i) => (
            <Card key={i.id} className="gap-3 border-[#EAE2D3] bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-serif text-base text-[#1C1A16]">{i.name}</p>
                  <p className="text-[11px] text-[#B0A88F]">{formatDate(i.createdAt)}</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[11px]",
                    i.status === "NEW"
                      ? "border-[#E6C87A]/70 bg-[#FAF3E0] text-[#8A6D1D]"
                      : i.status === "RESOLVED"
                        ? "border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#7A5E14]"
                        : "border-[#D8D2C4] bg-white text-[#5A544A]"
                  )}
                >
                  {humanize(i.status)}
                </Badge>
              </div>

              <p className="font-serif text-sm italic text-[#7A5E14]">{i.subject}</p>
              <p className="admin-scroll max-h-28 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-[#5A544A]">
                {i.message}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5A544A]">
                <a
                  href={`mailto:${i.email}`}
                  className="flex items-center gap-1 underline decoration-[#D4AF37]/50 underline-offset-2 hover:text-[#7A5E14]"
                >
                  <Mail className="size-3.5 text-[#D4AF37]" aria-hidden />
                  {i.email}
                </a>
                {i.phone && (
                  <a
                    href={`tel:${i.phone}`}
                    className="flex items-center gap-1 underline decoration-[#D4AF37]/50 underline-offset-2 hover:text-[#7A5E14]"
                  >
                    <Phone className="size-3.5 text-[#D4AF37]" aria-hidden />
                    {i.phone}
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-[#F0EAD9] pt-3">
                <Select value={i.status} onValueChange={(v) => void updateStatus(i, v)}>
                  <SelectTrigger size="sm" className="w-36 border-[#E0D9C8] bg-white text-xs" aria-label={`Status for inquiry from ${i.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INQUIRY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {humanize(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setDeleteTarget(i)}
                  aria-label={`Delete inquiry from ${i.name}`}
                  title="Delete inquiry"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#EAE2D3] pt-3">
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-[#EAE2D3]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete inquiry from {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the message permanently. If you still need the details, copy them before deleting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep inquiry</AlertDialogCancel>
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
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
