"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, MessageCircleQuestion, Search, Trash2, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api, errMsg, isAuthError, qs, useDebounced } from "./api";

interface AdminQuestion {
  id: string;
  name: string;
  email: string | null;
  question: string;
  answer: string | null;
  approved: boolean;
  createdAt: string;
  answeredAt: string | null;
  product: { id: string; name: string; slug: string; sku: string; image: string };
}

interface QuestionsPage {
  items: AdminQuestion[];
  total: number;
  page: number;
  totalPages: number;
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "answered", label: "Answered" },
] as const;

type FilterId = (typeof FILTERS)[number]["value"];

export default function QuestionsManager() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<QuestionsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<AdminQuestion | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<QuestionsPage>(`/api/admin/questions${qs({ filter, q: debouncedSearch || undefined, page })}`);
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

  async function saveAnswer(q: AdminQuestion) {
    const answer = (drafts[q.id] ?? q.answer ?? "").trim();
    if (!answer) {
      toast.error("Write an answer first — it will be published on the product page.");
      return;
    }
    setBusyId(q.id);
    try {
      await api(`/api/admin/questions/${q.id}`, {
        method: "PATCH",
        body: JSON.stringify({ answer, approved: true }),
      });
      toast.success(`Answer published for “${q.product.name}”.`);
      await load();
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleApprove(q: AdminQuestion) {
    setBusyId(q.id);
    try {
      await api(`/api/admin/questions/${q.id}`, {
        method: "PATCH",
        body: JSON.stringify({ approved: !q.approved }),
      });
      toast.success(q.approved ? "Question hidden from the product page." : "Question approved and visible.");
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
      await api(`/api/admin/questions/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Question deleted.");
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-[#1C1A16]">Product Q &amp; A</h2>
          <p className="text-sm text-[#8A8375]">
            {data ? `${data.total} question${data.total === 1 ? "" : "s"}` : "Loading questions…"} — approved answers
            appear publicly under each product.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#B0A88F]" aria-hidden />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search question, asker, product…"
              className="h-9 w-64 border-[#E0D9C8] pl-9 text-sm"
              aria-label="Search questions"
            />
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
      </div>

      {loading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg bg-[#EFEAE0]" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card className="border-[#EAE2D3] bg-white p-0">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <MessageCircleQuestion className="size-8 text-[#D4AF37]" aria-hidden />
            <p className="text-sm text-[#8A8375]">No questions in this view.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="admin-scroll max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {data.items.map((q) => {
            const answered = !!q.answer;
            const draft = drafts[q.id] ?? q.answer ?? "";
            return (
              <Card key={q.id} className="gap-0 border-[#EAE2D3] bg-white p-0">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        aria-hidden
                        className="mt-0.5 grid size-8 shrink-0 place-items-center overflow-hidden rounded-md border border-[#EAE2D3] bg-[#FAF7F0] font-serif text-xs text-[#B0A88F]"
                      >
                        {q.product.image ? (
                          <img src={q.product.image} alt="" className="size-full object-cover" />
                        ) : (
                          q.product.name.charAt(0)
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#1C1A16]" title={q.product.name}>
                          {q.product.name}
                        </p>
                        <p className="font-mono text-[11px] text-[#B0A88F]">{q.product.sku}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          q.approved
                            ? "border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#7A5E14]"
                            : "border-[#D8D2C4] bg-white text-[#B0A88F]"
                        )}
                      >
                        {q.approved ? "Approved" : "Pending"}
                      </Badge>
                      {answered && (
                        <Badge variant="outline" className="border-[#D8D2C4] text-[10px] text-[#5A544A]">
                          Answered
                        </Badge>
                      )}
                    </div>
                  </div>

                  <blockquote className="mt-3 border-l-2 border-[#D4AF37]/50 pl-3 text-sm text-[#1C1A16]">
                    “{q.question}”
                  </blockquote>
                  <p className="mt-1.5 pl-3 text-xs text-[#8A8375]">
                    {q.name}
                    {q.email ? ` · ${q.email}` : ""} · {formatDate(q.createdAt)}
                    {q.answeredAt ? ` · answered ${formatDate(q.answeredAt)}` : ""}
                  </p>

                  <div className="mt-3">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                      rows={Math.min(6, Math.max(2, Math.ceil(draft.length / 70)))}
                      placeholder="Write the atelier's answer…"
                      className="border-[#E0D9C8] bg-[#FDFCF8] text-sm"
                      aria-label={`Answer to question from ${q.name}`}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 border-[#D8D2C4] text-xs text-[#5A544A] hover:bg-[#F5F1E8]"
                      disabled={busyId === q.id}
                      onClick={() => void toggleApprove(q)}
                    >
                      {busyId === q.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : q.approved ? (
                        <X className="size-3.5" aria-hidden />
                      ) : (
                        <Check className="size-3.5" aria-hidden />
                      )}
                      {q.approved ? "Unapprove" : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 gap-1 bg-[#0A0A0A] text-xs text-[#FAF7F0] hover:bg-[#171717]"
                      disabled={busyId === q.id}
                      onClick={() => void saveAnswer(q)}
                    >
                      {busyId === q.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Check className="size-3.5" aria-hidden />
                      )}
                      {answered ? "Update answer" : "Publish answer"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setDeleteTarget(q)}
                      aria-label={`Delete question from ${q.name}`}
                      title="Delete"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="flex items-center justify-between border-t border-[#EAE2D3] px-1 py-3">
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-[#EAE2D3]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the question and its answer. Deleting is not required to hide it — unapproving
              keeps it archived but hidden from the storefront.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep question</AlertDialogCancel>
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
                "Delete question"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
