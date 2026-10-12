"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarCheck,
  CalendarX,
  Check,
  Clock,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  Trash2,
  Video,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AppointmentDTO } from "@/lib/types";
import { formatDate, formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api, errMsg, isAuthError, qs, useDebounced } from "./api";

interface AppointmentsData {
  items: AppointmentDTO[];
  total: number;
  page: number;
  pageSize: number;
  pendingCount: number;
  todayCount: number;
  upcomingCount: number;
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "pending", label: "Awaiting confirmation" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
] as const;

type FilterId = (typeof FILTERS)[number]["value"];

const STATUS_STYLES: Record<string, string> = {
  PENDING: "border-transparent bg-[#D4AF37]/15 text-[#7A5E14]",
  CONFIRMED: "border-transparent bg-emerald-600/12 text-emerald-800",
  DECLINED: "border-transparent bg-red-600/10 text-red-800",
  COMPLETED: "border-transparent bg-[#0A0A0A]/8 text-[#4A463C]",
};

/** YYYY-MM-DD (IST) for the "today" highlight — must match the API's day. */
function istToday(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function AppointmentsManager() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AppointmentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppointmentDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<AppointmentsData>(`/api/admin/appointments${qs({ filter, q: debouncedSearch, page, pageSize: 12 })}`);
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

  async function setStatus(appt: AppointmentDTO, status: string) {
    setBusyId(appt.id);
    try {
      await api(`/api/admin/appointments/${appt.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      toast.success(
        status === "CONFIRMED"
          ? `${appt.name}'s ${appt.timeSlot} visit is confirmed.`
          : status === "DECLINED"
            ? `${appt.name}'s request was declined.`
            : status === "COMPLETED"
              ? `${appt.name}'s visit marked completed.`
              : `${appt.name}'s request moved back to pending.`
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
      await api(`/api/admin/appointments/${deleteTarget.id}`, { method: "DELETE" });
      toast.success(`Booking for ${deleteTarget.name} removed from the book.`);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const today = istToday();

  return (
    <div className="space-y-6">
      {/* ---------- summary ---------- */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={CalendarClock} label="Awaiting confirmation" value={data?.pendingCount ?? "—"} />
        <SummaryCard icon={CalendarCheck} label="Today's book" value={data?.todayCount ?? "—"} />
        <SummaryCard icon={Clock} label="Upcoming (PENDING + CONFIRMED)" value={data?.upcomingCount ?? "—"} />
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
                placeholder="Search name, email, phone, notes…"
                className="border-[#EAE2D3] pl-9"
                aria-label="Search appointments"
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
            <CalendarClock className="size-8 text-[#D4AF37]" aria-hidden />
            <p className="font-serif text-lg text-[#1C1A16]">The appointment book is clear</p>
            <p className="max-w-sm text-sm text-[#6B655A]">
              Private viewings and video consultations booked from the Contact page land here for confirmation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-[#EAE2D3] bg-white">
          <div className="admin-scroll overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Guest</TableHead>
                  <TableHead>Appointment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((a) => {
                  const isToday = a.date === today;
                  const isVideo = a.type === "VIDEO_CALL";
                  return (
                    <TableRow key={a.id} className={cn(isToday && filter === "all" && "bg-[#D4AF37]/[0.06]")}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#1C1A16]">{a.name}</p>
                          <a href={`mailto:${a.email}`} className="text-xs text-[#6B655A] underline-offset-2 hover:text-[#A8862A] hover:underline">
                            {a.email}
                          </a>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-[#8A8375]">
                            <Phone className="size-3" aria-hidden /> {a.phone}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="whitespace-nowrap text-sm font-medium text-[#1C1A16]">
                          {formatLongDate(a.date)}
                          {isToday && (
                            <Badge className="ml-2 border-transparent bg-[#D4AF37] text-[10px] uppercase tracking-wider text-[#171717]">
                              Today
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-[#8A8375]">{a.timeSlot} IST · booked {formatDate(a.createdAt)}</p>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm text-[#4A463C]">
                          {isVideo ? <Video className="size-4 text-[#A8862A]" aria-hidden /> : <MapPin className="size-4 text-[#A8862A]" aria-hidden />}
                          {isVideo ? "Video call" : "Atelier visit"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        {a.notes ? (
                          <p className="truncate text-sm text-[#6B655A]" title={a.notes}>
                            {a.notes}
                          </p>
                        ) : (
                          <span className="text-xs text-[#B0A88F]">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border-transparent uppercase tracking-wider", STATUS_STYLES[a.status] ?? "")}>
                          {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {a.status !== "CONFIRMED" && a.status !== "COMPLETED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyId === a.id}
                              onClick={() => void setStatus(a, "CONFIRMED")}
                              className="h-8 gap-1.5 text-xs text-[#1C6B3D] hover:bg-emerald-600/10"
                              title="Confirm this appointment"
                            >
                              {busyId === a.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
                              Confirm
                            </Button>
                          )}
                          {a.status === "CONFIRMED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyId === a.id}
                              onClick={() => void setStatus(a, "COMPLETED")}
                              className="h-8 gap-1.5 text-xs text-[#6B655A] hover:bg-[#D4AF37]/10"
                              title="Mark as visited / completed"
                            >
                              <CalendarCheck className="size-3.5" aria-hidden />
                              Complete
                            </Button>
                          )}
                          {(a.status === "PENDING" || a.status === "CONFIRMED") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyId === a.id}
                              onClick={() => void setStatus(a, "DECLINED")}
                              className="h-8 gap-1.5 text-xs text-red-700 hover:bg-red-50"
                              title="Decline this request"
                            >
                              <CalendarX className="size-3.5" aria-hidden />
                              Decline
                            </Button>
                          )}
                          {a.status === "DECLINED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyId === a.id}
                              onClick={() => void setStatus(a, "PENDING")}
                              className="h-8 gap-1.5 text-xs text-[#6B655A]"
                              title="Reopen as pending"
                            >
                              <Clock className="size-3.5" aria-hidden />
                              Reopen
                            </Button>
                          )}
                          <a
                            href={`mailto:${a.email}?subject=${encodeURIComponent(`Your Aurelia Jewels appointment · ${formatLongDate(a.date)}`)}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6B655A] transition-colors hover:bg-[#D4AF37]/10 hover:text-[#A8862A]"
                            aria-label={`Email ${a.name} about the appointment`}
                            title="Email guest"
                          >
                            <Mail className="size-4" aria-hidden />
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setDeleteTarget(a)}
                            aria-label={`Delete booking for ${a.name}`}
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
            <AlertDialogTitle className="font-serif">Remove {deleteTarget?.name}&apos;s booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `${formatLongDate(deleteTarget.date)} at ${deleteTarget.timeSlot} — ${deleteTarget.type === "VIDEO_CALL" ? "video consultation" : "atelier visit"}. ` : ""}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
              Delete booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof CalendarClock; label: string; value: number | string }) {
  return (
    <Card className="border-[#EAE2D3] bg-white">
      <CardContent className="flex items-center gap-4 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#D4AF37]/12">
          <Icon className="size-5 text-[#A8862A]" aria-hidden />
        </span>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#8A8375]">{label}</p>
          <p className="font-serif text-2xl tabular-nums text-[#0A0A0A]">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
