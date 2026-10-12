"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { toast } from "sonner";
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
import type { Paginated } from "@/lib/types";
import { api, errMsg, isAuthError, qs } from "./api";

interface AuditLogDTO {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AuditLogDTO> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<Paginated<AuditLogDTO>>(`/api/admin/audit-logs${qs({ page })}`);
      setData(res);
    } catch (e) {
      if (!isAuthError(e)) toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl text-[#1C1A16]">Audit logs</h2>
        <p className="text-sm text-[#8A8375]">Every privileged action, recorded.</p>
      </div>

      <Card className="border-[#EAE2D3] bg-white p-0">
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-[#EFEAE0]" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <ScrollText className="size-8 text-[#D4AF37]" aria-hidden />
              <p className="text-sm text-[#8A8375]">No audit entries yet.</p>
            </div>
          ) : (
            <div className="admin-scroll max-h-[70vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#EAE2D3] hover:bg-transparent">
                    <TableHead className="pl-4 text-[11px] uppercase tracking-wider text-[#8A8375]">Time</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Actor</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Action</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Entity</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Entity ID</TableHead>
                    <TableHead className="pr-4 text-[11px] uppercase tracking-wider text-[#8A8375]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((log) => (
                    <TableRow key={log.id} className="border-[#F0EAD9]">
                      <TableCell className="whitespace-nowrap pl-4 text-xs text-[#8A8375]">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-44 truncate text-sm text-[#5A544A]" title={log.actor}>
                        {log.actor}
                      </TableCell>
                      <TableCell>
                        <span className="rounded bg-[#FAF3E0] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#7A5E14]">
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-[#5A544A]">{log.entity}</TableCell>
                      <TableCell className="max-w-32 truncate font-mono text-xs text-[#B0A88F]" title={log.entityId ?? undefined}>
                        {log.entityId ?? "—"}
                      </TableCell>
                      <TableCell className="pr-4">
                        <span
                          className="block max-w-72 truncate text-xs text-[#8A8375]"
                          title={log.details ?? undefined}
                        >
                          {log.details ? `${log.details.slice(0, 80)}${log.details.length > 80 ? "…" : ""}` : "—"}
                        </span>
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
    </div>
  );
}
