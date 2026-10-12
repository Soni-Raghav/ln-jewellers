"use client";

import { useCallback, useEffect, useState } from "react";
import { MailCheck, Users } from "lucide-react";
import { toast } from "sonner";
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
import type { Paginated } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { api, errMsg, isAuthError, qs } from "./api";

interface SubscriberDTO {
  id: string;
  email: string;
  active: boolean;
  createdAt: string;
}

type SubscribersResponse = Paginated<SubscriberDTO> & { activeCount: number };

export default function SubscribersManager() {
  const [data, setData] = useState<SubscribersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<SubscribersResponse>(`/api/admin/subscribers${qs({ page })}`);
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
  const inactive = data ? data.total - data.activeCount : 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl text-[#1C1A16]">Subscribers</h2>
        <p className="text-sm text-[#8A8375]">Newsletter list for the atelier dispatch.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <Card className="gap-1 border-[#EAE2D3] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-[#8A8375]">Total</p>
            <Users className="size-4 text-[#D4AF37]" aria-hidden />
          </div>
          <p className="font-serif text-2xl tabular-nums text-[#D4AF37]">
            {data ? data.total.toLocaleString("en-IN") : "—"}
          </p>
        </Card>
        <Card className="gap-1 border-[#EAE2D3] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-[#8A8375]">Active</p>
            <MailCheck className="size-4 text-[#D4AF37]" aria-hidden />
          </div>
          <p className="font-serif text-2xl tabular-nums text-[#D4AF37]">
            {data ? data.activeCount.toLocaleString("en-IN") : "—"}
          </p>
          {data && inactive > 0 && <p className="text-[11px] text-[#B0A88F]">{inactive} unsubscribed</p>}
        </Card>
      </div>

      <Card className="border-[#EAE2D3] bg-white p-0">
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-[#EFEAE0]" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Users className="size-8 text-[#D4AF37]" aria-hidden />
              <p className="text-sm text-[#8A8375]">No subscribers yet.</p>
            </div>
          ) : (
            <div className="admin-scroll max-h-[70vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#EAE2D3] hover:bg-transparent">
                    <TableHead className="pl-4 text-[11px] uppercase tracking-wider text-[#8A8375]">Email</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-[#8A8375]">Joined</TableHead>
                    <TableHead className="pr-4 text-right text-[11px] uppercase tracking-wider text-[#8A8375]">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((s) => (
                    <TableRow key={s.id} className="border-[#F0EAD9]">
                      <TableCell className="pl-4 text-sm">{s.email}</TableCell>
                      <TableCell className="text-sm text-[#8A8375]">{formatDate(s.createdAt)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <Badge
                          variant="outline"
                          className={
                            s.active
                              ? "border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[11px] text-[#7A5E14]"
                              : "border-[#D8D2C4] bg-white text-[11px] text-[#B0A88F]"
                          }
                        >
                          {s.active ? "Active" : "Unsubscribed"}
                        </Badge>
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
