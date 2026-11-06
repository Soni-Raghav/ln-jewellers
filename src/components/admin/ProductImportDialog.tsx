"use client";

/**
 * ProductImportDialog — bulk-import products from Excel / CSV / Google Sheets.
 *
 * Flow for the shop owner:
 *  1. Download the template (.xlsx) — it documents every column and ships with
 *     two example rows, so the format is never a guess.
 *  2. Fill it in Excel or Google Sheets (or any CSV).
 *  3. Upload the file, or paste the Google Sheets link (shared "Anyone with
 *     the link – Viewer").
 *
 * Rows are validated one by one; the summary shows exactly which rows failed
 * and why, so a 200-row catalogue never dies on a single typo.
 */

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Link2,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  truncated: number;
  errors: { row: number; name: string; message: string }[];
}

/** Compact client-side summary of the format (full docs live in the template file). */
const KEY_COLUMNS: { col: string; hint: string }[] = [
  { col: "name *", hint: "Product title" },
  { col: "price *", hint: "INR — “₹ 24,999” works" },
  { col: "category *", hint: "Match a category; new ones are created" },
  { col: "sku", hint: "Leave blank to auto-generate · repeat to update" },
  { col: "description / shortDescription", hint: "Story + one-liner" },
  { col: "discountPercent", hint: "0–90" },
  { col: "stock / lowStockThreshold", hint: "Pieces on hand · “Only N left” at" },
  { col: "featured / bestSeller / trending / handmade", hint: "yes or no" },
  { col: "status", hint: "PUBLISHED · DRAFT · ARCHIVED" },
  { col: "images", hint: "Up to 8 URLs separated by |" },
  { col: "tags", hint: "Comma separated" },
  { col: "material / purity / weightGrams / dimensions", hint: "Specs line" },
  { col: "collection", hint: "Optional; created when missing" },
  { col: "model3dUrl", hint: "Optional .glb for the 3D tab" },
];

export default function ProductImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setSheetUrl("");
    setResult(null);
    setErrorMsg("");
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  async function runImport() {
    if (!file && !sheetUrl.trim()) {
      setErrorMsg("Attach an Excel/CSV file or paste a Google Sheets link first.");
      return;
    }
    setImporting(true);
    setErrorMsg("");
    setResult(null);
    try {
      const fd = new FormData();
      if (file) fd.set("file", file);
      if (sheetUrl.trim()) fd.set("sheetUrl", sheetUrl.trim());
      fd.set("updateExisting", String(updateExisting));

      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => null)) as (ImportResult & { error?: string }) | null;
      if (!res.ok || !data) {
        setErrorMsg(data?.error ?? `Import failed (${res.status}).`);
        return;
      }
      setResult({
        total: data.total,
        created: data.created,
        updated: data.updated,
        failed: data.failed,
        truncated: data.truncated,
        errors: data.errors ?? [],
      });
      if (data.created + data.updated > 0) {
        toast.success(`${data.created > 0 ? `${data.created} new piece${data.created === 1 ? "" : "s"} added` : ""}${data.created > 0 && data.updated > 0 ? " · " : ""}${data.updated > 0 ? `${data.updated} updated` : ""}`);
        onImported();
      }
    } catch {
      setErrorMsg("Network error — please try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="admin-scroll max-h-[90vh] overflow-y-auto border-[#EAE2D3] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl text-[#1C1A16]">
            <FileSpreadsheet className="size-5 text-[#A8862A]" aria-hidden /> Import products
          </DialogTitle>
          <DialogDescription>
            Bulk-add or refresh the catalog from Excel, CSV or Google Sheets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ---------- Step 1 — format ---------- */}
          <section className="rounded-lg border border-[#EAE2D3] bg-[#FBF9F4] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1C1A16]">1 · Get the format</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#8A8375]">
                  The template documents every column, with examples and your live category list. Fill it in Excel or Google&nbsp;Sheets.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-[#D4AF37]/50 text-[#7A5E14] hover:bg-[#D4AF37]/10"
                onClick={() => window.open("/api/admin/products/import/template", "_blank")}
              >
                <Download className="mr-1.5 size-3.5" aria-hidden /> Template
              </Button>
            </div>
            <details className="group mt-3">
              <summary className="cursor-pointer select-none text-xs font-medium text-[#7A5E14] hover:underline">
                Column quick reference
              </summary>
              <div className="admin-scroll mt-2 max-h-44 overflow-y-auto rounded-md border border-[#EAE2D3] bg-white">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {KEY_COLUMNS.map((c) => (
                      <tr key={c.col} className="border-b border-[#F0EAD9] last:border-0">
                        <td className="w-44 px-2.5 py-1.5 font-mono text-[11px] text-[#5A544A]">{c.col}</td>
                        <td className="px-2.5 py-1.5 text-[#8A8375]">{c.hint}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          {/* ---------- Step 2 — source ---------- */}
          <section className="rounded-lg border border-[#EAE2D3] bg-white p-4">
            <p className="text-sm font-medium text-[#1C1A16]">2 · Provide the products</p>
            <div className="mt-3 space-y-3">
              <div>
                <Label htmlFor="import-file" className="text-xs text-[#5A544A]">Excel or CSV file</Label>
                <Input
                  id="import-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setErrorMsg("");
                  }}
                  className="border-[#E0D9C8] bg-white file:mr-3 file:rounded-md file:border-0 file:bg-[#D4AF37]/15 file:px-3 file:py-1 file:text-xs file:font-medium file:text-[#7A5E14]"
                />
              </div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-[#B0A88F]">
                <span className="h-px flex-1 bg-[#EAE2D3]" /> or <span className="h-px flex-1 bg-[#EAE2D3]" />
              </div>
              <div>
                <Label htmlFor="import-sheet-url" className="flex items-center gap-1.5 text-xs text-[#5A544A]">
                  <Link2 className="size-3" aria-hidden /> Google Sheets link
                </Label>
                <Input
                  id="import-sheet-url"
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => {
                    setSheetUrl(e.target.value);
                    setErrorMsg("");
                  }}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  className="border-[#E0D9C8] bg-white"
                />
                <p className="mt-1 text-[11px] text-[#B0A88F]">
                  In Google Sheets: Share → “Anyone with the link · Viewer”, then paste the link. The first tab (or the tab in the URL&apos;s #gid=) is imported.
                </p>
              </div>
            </div>
          </section>

          {/* ---------- Step 3 — rules ---------- */}
          <section className="rounded-lg border border-[#EAE2D3] bg-white p-4">
            <p className="text-sm font-medium text-[#1C1A16]">3 · How rows behave</p>
            <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-md border border-[#EAE2D3] bg-[#FBF9F4] p-3">
              <Checkbox
                checked={updateExisting}
                onCheckedChange={(v) => setUpdateExisting(v === true)}
                className="mt-0.5"
                aria-label="Update existing products that share a SKU"
              />
              <span className="text-xs leading-relaxed text-[#5A544A]">
                <span className="font-medium text-[#1C1A16]">Update pieces whose SKU exists</span> — a row with a known sku refreshes that product (prices, stock, flags…) instead of being skipped. Rows without a sku always create new products.
              </span>
            </label>
          </section>

          {/* ---------- Error ---------- */}
          {errorMsg && (
            <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {errorMsg}
            </p>
          )}

          {/* ---------- Result ---------- */}
          {result && (
            <section className="rounded-lg border border-[#EAE2D3] bg-[#FBF9F4] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#25D366]/15 px-2.5 py-1 text-xs font-medium text-[#0e6e3a]">
                  <CheckCircle2 className="size-3.5" aria-hidden /> {result.created} new
                </span>
                {result.updated > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#D4AF37]/15 px-2.5 py-1 text-xs font-medium text-[#7A5E14]">
                    <CheckCircle2 className="size-3.5" aria-hidden /> {result.updated} updated
                  </span>
                )}
                {result.failed > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                    <XCircle className="size-3.5" aria-hidden /> {result.failed} failed
                  </span>
                )}
                {result.truncated > 0 && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                    {result.truncated} rows beyond the {result.total} limit were skipped
                  </span>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="admin-scroll mt-3 max-h-48 overflow-y-auto rounded-md border border-[#EAE2D3] bg-white">
                  <ul className="divide-y divide-[#F0EAD9] text-xs">
                    {result.errors.map((e) => (
                      <li key={`${e.row}-${e.name}`} className="px-3 py-2">
                        <span className="font-mono text-[10px] text-[#B0A88F]">row {e.row}</span>{" "}
                        <span className="font-medium text-[#1C1A16]">{e.name}</span>{" "}
                        <span className="text-red-700">— {e.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* ---------- Actions ---------- */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" className="border-[#E0D9C8]" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
            <Button
              className="bg-[#0A0A0A] text-[#FAF7F0] hover:bg-[#171717]"
              disabled={importing}
              onClick={() => void runImport()}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> Importing…
                </>
              ) : (
                <>
                  <Upload className="mr-2 size-4" aria-hidden /> {result ? "Import again" : "Import products"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
