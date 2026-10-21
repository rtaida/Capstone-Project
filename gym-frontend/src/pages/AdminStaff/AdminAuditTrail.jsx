import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardList, FileDown, RefreshCw } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const PAGE_SIZE = 20;

function PaginationControls({ pageInfo, onPageChange, loading }) {
  const page = pageInfo?.page || 1;
  const limit = pageInfo?.limit || PAGE_SIZE;
  const total = pageInfo?.total || 0;
  const totalPages = pageInfo?.total_pages || 1;
  const firstRecord = total ? (page - 1) * limit + 1 : 0;
  const lastRecord = Math.min(page * limit, total);

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-xs text-zinc-400">
      <span>Showing {firstRecord}-{lastRecord} of {total}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={loading || page <= 1}
          aria-label="Previous page"
          className="rounded-md border border-white/10 p-1.5 text-zinc-300 hover:border-classic-gold/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span>Page {page} of {totalPages}</span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={loading || page >= totalPages}
          aria-label="Next page"
          className="rounded-md border border-white/10 p-1.5 text-zinc-300 hover:border-classic-gold/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function getAuthHeaders() {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("auth_token") ||
    "";

  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const auditActionLabels = {
  login: "Logged in",
  add: "Added record",
  update: "Updated record",
  delete: "Deleted record",
  restore: "Restored record",
  generate_qr: "Generated QR code",
  approve_member: "Approved member",
  reject_member: "Rejected member",
  confirm_payment: "Confirmed payment",
  bill_payment: "Billed payment",
  reject_payment: "Rejected payment",
  create_walk_in: "Created walk-in",
  record_attendance: "Recorded attendance",
  save_session_type: "Saved session type",
  delete_session_type: "Deleted session type",
  activate_session_type: "Activated session type",
  save_promo: "Saved promotion",
  admin_create_session: "Created session",
  admin_update_session: "Updated session",
  admin_terminate_session: "Terminated session",
  approve_session: "Approved session",
  reject_session: "Rejected session",
  add_admin: "Added admin",
  add_trainer: "Added trainer",
  update_admin: "Updated admin",
  update_trainer: "Updated trainer",
  delete_admin: "Deleted admin",
  delete_trainer: "Deleted trainer",
  send_notice: "Sent notice",
  mark_paid: "Marked payment as paid",
  update_settings: "Updated gym settings",
};

function formatAuditAction(value) {
  const action = String(value || "").trim();
  if (!action) return "-";

  const normalizedKey = action.toLowerCase().replace(/\s+/g, "_");
  if (auditActionLabels[normalizedKey]) return auditActionLabels[normalizedKey];

  const readable = action.replaceAll("_", " ").replace(/\s+/g, " ");
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

export default function AdminAuditTrail() {
  const [records, setRecords] = useState([]);
  const [type, setType] = useState("all");
  const [actionPage, setActionPage] = useState(1);
  const [errorPage, setErrorPage] = useState(1);
  const [pagination, setPagination] = useState({
    action: { page: 1, limit: PAGE_SIZE, total: 0, total_pages: 1 },
    error: { page: 1, limit: PAGE_SIZE, total: 0, total_pages: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ type, limit: String(PAGE_SIZE) });
      if (type === "all") {
        query.set("action_page", String(actionPage));
        query.set("error_page", String(errorPage));
      } else {
        query.set("page", String(type === "action" ? actionPage : errorPage));
      }
      const response = await fetch(
        `${API_URL}/audit_api.php?${query.toString()}`,
        { headers: getAuthHeaders(), cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load the audit trail.");
      }
      setRecords(data.records || []);
      setPagination((current) => ({ ...current, ...(data.pagination || {}) }));
    } catch (loadError) {
      setError(loadError.message || "Unable to load the audit trail.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [actionPage, errorPage, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadRecords(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  const actions = records.filter((record) => record.type === "action");
  const errors = records.filter((record) => record.type === "error");

  const buildAuditPdf = () => {
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 44;
    const contentWidth = pageWidth - margin * 2;
    const pages = [];
    let commands = [];
    let y = margin;
    const colors = {
      black: [0.08, 0.08, 0.09],
      text: [0.18, 0.18, 0.20],
      muted: [0.43, 0.43, 0.46],
      gold: [0.76, 0.57, 0.17],
      border: [0.82, 0.74, 0.54],
      light: [0.97, 0.97, 0.96],
      red: [0.62, 0.19, 0.18],
    };

    const escapePdf = (value) => String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/\r?\n/g, " ")
      .replace(/[—–]/g, "-");
    const rgb = (color, stroke = false) => `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} ${stroke ? "RG" : "rg"}`;
    const add = (command) => commands.push(command);
    const text = (value, x, top, size = 9, options = {}) => {
      const color = options.color || colors.text;
      const font = options.bold ? "F2" : "F1";
      add(`${rgb(color)} BT /${font} ${size} Tf ${x.toFixed(2)} ${(pageHeight - top).toFixed(2)} Td (${escapePdf(value)}) Tj ET`);
    };
    const line = (x1, top1, x2, top2, color = colors.border, width = 0.7) => {
      add(`${rgb(color, true)} ${width.toFixed(2)} w ${x1.toFixed(2)} ${(pageHeight - top1).toFixed(2)} m ${x2.toFixed(2)} ${(pageHeight - top2).toFixed(2)} l S`);
    };
    const rect = (x, top, width, height, fill = colors.light, stroke = colors.border) => {
      add(`${rgb(fill)} ${rgb(stroke, true)} 0.7 w ${x.toFixed(2)} ${(pageHeight - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re B`);
    };
    const wrap = (value, maxChars) => {
      const lines = [];
      let current = "";
      String(value ?? "").split(/\s+/).filter(Boolean).forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxChars && current) {
          lines.push(current);
          current = word;
        } else current = candidate;
      });
      if (current) lines.push(current);
      return lines.length ? lines : ["-"];
    };
    const finishPage = () => pages.push(commands.join("\n"));
    const startPage = (includeHeader = false) => {
      commands = [];
      y = margin;
      if (includeHeader) {
        text("CAPRA FITNESS", margin, y, 10, { bold: true, color: colors.gold });
        y += 22;
        text("AUDIT TRAIL REPORT", margin, y, 21, { bold: true, color: colors.black });
        y += 19;
        text(`Filter: ${type === "all" ? "All records" : type === "action" ? "Admin actions" : "System errors"}`, margin, y, 9, { color: colors.muted });
        y += 15;
        text(`Generated on ${new Date().toLocaleString()}`, margin, y, 8, { color: colors.muted });
        y += 12;
        line(margin, y, pageWidth - margin, y, colors.gold, 1.2);
        y += 22;
      }
    };
    const ensureSpace = (height) => {
      if (y + height > pageHeight - margin - 24) {
        finishPage();
        startPage();
        text("CAPRA FITNESS | AUDIT TRAIL REPORT", margin, y, 9, { bold: true, color: colors.gold });
        y += 18;
        line(margin, y, pageWidth - margin, y, colors.gold, 0.8);
        y += 16;
      }
    };
    const drawTable = (title, rows, isError = false) => {
      ensureSpace(65);
      text(title, margin, y, 14, { bold: true, color: isError ? colors.red : colors.black });
      y += 17;
      text(`${rows.length} record${rows.length === 1 ? "" : "s"}`, margin, y, 8, { color: colors.muted });
      y += 13;
      const columns = isError
        ? [{ label: "WHAT PART HAS ERROR", width: 385 }, { label: "DATE", width: 122 }]
        : [{ label: "NAME", width: 118 }, { label: "ROLE", width: 78 }, { label: "DATE", width: 125 }, { label: "ACTION MADE", width: 186 }];
      const headerHeight = 22;
      rect(margin, y, contentWidth, headerHeight, isError ? [0.99, 0.94, 0.94] : colors.light, isError ? [0.88, 0.65, 0.65] : [0.88, 0.88, 0.86]);
      let x = margin + 8;
      columns.forEach((column) => {
        text(column.label, x, y + 14, 7, { bold: true, color: colors.muted });
        x += column.width;
      });
      y += headerHeight;
      rows.forEach((record) => {
        const values = isError
          ? [record.error_part || "Unknown system error", formatDate(record.date)]
          : [record.name || "Unknown admin", record.role || record.position || "Admin", formatDate(record.date), formatAuditAction(record.action)];
        const wrapped = values.map((value, index) => wrap(value, Math.max(12, Math.floor(columns[index].width / 5.1))).slice(0, 2));
        const rowHeight = Math.max(28, wrapped.reduce((height, lines) => Math.max(height, lines.length * 10 + 12), 0));
        ensureSpace(rowHeight);
        add(`${rgb(isError ? [0.99, 0.96, 0.96] : [1, 1, 1])} ${rgb(isError ? [0.91, 0.82, 0.82] : [0.90, 0.90, 0.88], true)} 0.5 w ${margin.toFixed(2)} ${(pageHeight - y - rowHeight).toFixed(2)} ${contentWidth.toFixed(2)} ${rowHeight.toFixed(2)} re B`);
        x = margin + 8;
        wrapped.forEach((lines, index) => {
          lines.forEach((value, lineIndex) => text(value, x, y + 13 + lineIndex * 10, 8, { color: isError && index === 0 ? colors.red : colors.text }));
          x += columns[index].width;
        });
        y += rowHeight;
      });
      y += 18;
    };

    startPage(true);
    text("Administrative activity and system errors recorded by the Capra Fitness system.", margin, y, 9, { color: colors.text });
    y += 24;
    const summary = [
      ["TOTAL RECORDS", records.length],
      ["ADMIN ACTIONS", actions.length],
      ["SYSTEM ERRORS", errors.length],
    ];
    const gap = 8;
    const metricWidth = (contentWidth - gap * 2) / 3;
    summary.forEach(([label, value], index) => {
      const x = margin + index * (metricWidth + gap);
      rect(x, y, metricWidth, 58);
      text(label, x + 9, y + 17, 7.5, { color: colors.muted });
      text(String(value), x + 9, y + 40, 14, { bold: true, color: colors.black });
    });
    y += 78;
    if (type === "all" || type === "action") drawTable("Admin actions", actions);
    if (type === "all" || type === "error") drawTable("System errors", errors, true);
    finishPage();

    const objects = [];
    const addObject = (body) => { const id = objects.length + 1; objects.push({ id, body }); return id; };
    const pagesId = addObject("");
    const catalogId = addObject("");
    const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const pageIds = [];
    pages.forEach((pageCommands, index) => {
      const footer = `${rgb(colors.muted)} BT /F1 7 Tf ${margin.toFixed(2)} ${(pageHeight - 24).toFixed(2)} Td (Capra Fitness Audit Trail Report) Tj ET BT /F1 7 Tf ${(pageWidth - margin - 48).toFixed(2)} ${(pageHeight - 24).toFixed(2)} Td (Page ${index + 1}) Tj ET`;
      const stream = new TextEncoder().encode(`${pageCommands}\n${footer}`);
      const contentId = addObject({ dictionary: `<< /Length ${stream.length} >>`, stream });
      pageIds.push(addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
    });
    objects[pagesId - 1].body = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    objects[catalogId - 1].body = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    const chunks = [];
    const offsets = new Array(objects.length + 1).fill(0);
    let byteLength = 0;
    const pushText = (value) => { const bytes = new TextEncoder().encode(value); chunks.push(bytes); byteLength += bytes.length; };
    const pushBytes = (bytes) => { chunks.push(bytes); byteLength += bytes.length; };
    pushText("%PDF-1.4\n%CapraFitness\n");
    objects.forEach((object) => {
      offsets[object.id] = byteLength;
      pushText(`${object.id} 0 obj\n`);
      if (typeof object.body === "string") pushText(`${object.body}\nendobj\n`);
      else { pushText(`${object.body.dictionary}\nstream\n`); pushBytes(object.body.stream); pushText("\nendstream\nendobj\n"); }
    });
    const xrefOffset = byteLength;
    pushText(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
    for (let id = 1; id <= objects.length; id += 1) pushText(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
    pushText(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    const output = new Uint8Array(byteLength);
    let offset = 0;
    chunks.forEach((chunk) => { output.set(chunk, offset); offset += chunk.length; });
    return output;
  };

  const generatePdf = async () => {
    setGenerating(true);
    try {
      const pdfBytes = buildAuditPdf();
      if (!pdfBytes || pdfBytes.length < 1000) throw new Error("The generated PDF is empty or incomplete.");
      const url = URL.createObjectURL(new Blob([pdfBytes], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `Capra_Fitness_Audit_Trail_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (generationError) {
      setError(generationError.message || "Unable to generate the audit report.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Trail</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Administrative activity and system errors
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <select
            value={type}
            onChange={(event) => {
              setActionPage(1);
              setErrorPage(1);
              setType(event.target.value);
            }}
            className="rounded-lg border border-classic-gold/30 bg-[#111] px-3 py-2 text-sm text-zinc-200 outline-none transition-all hover:border-classic-gold/80 hover:bg-[#1b160d] focus:border-classic-gold focus:bg-[#1b160d] focus:ring-2 focus:ring-classic-gold/20"
            aria-label="Audit record type"
          >
            <option value="all" className="bg-[#111] text-white">All records</option>
            <option value="action" className="bg-[#111] text-classic-gold">Admin actions</option>
            <option value="error" className="bg-[#111] text-red-300">System errors</option>
          </select>
          <button
            type="button"
            onClick={loadRecords}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-classic-gold px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={generatePdf}
            disabled={generating || loading}
            className="flex items-center gap-2 rounded-lg bg-classic-gold px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            <FileDown className="h-4 w-4" />
            {generating ? "Creating PDF..." : "Generate PDF"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {(type === "all" || type === "action") && (
        <section className="flex max-h-[min(36rem,calc(100dvh-12rem))] min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/20">
          <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-5 py-4">
            <ClipboardList className="h-5 w-5 text-classic-gold" />
            <h2 className="font-semibold text-white">Admin actions</h2>
            <span className="text-sm text-zinc-500">{pagination.action.total}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Action made</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {actions.map((record) => (
                  <tr
                    key={record.id}
                    className="cursor-default transition-colors duration-200 hover:bg-classic-gold/[0.08]"
                  >
                    <td className="px-5 py-3 font-medium text-white">{record.name || "Unknown admin"}</td>
                    <td className="px-5 py-3 capitalize">{record.role || record.position || "Admin"}</td>
                    <td className="whitespace-nowrap px-5 py-3">{formatDate(record.date)}</td>
                    <td className="px-5 py-3">{formatAuditAction(record.action)}</td>
                  </tr>
                ))}
                {!loading && actions.length === 0 && (
                  <tr><td colSpan="4" className="px-5 py-8 text-center text-zinc-500">No admin actions recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls pageInfo={pagination.action} onPageChange={setActionPage} loading={loading} />
        </section>
      )}

      {(type === "all" || type === "error") && (
        <section className="flex max-h-[min(36rem,calc(100dvh-12rem))] min-h-0 flex-col overflow-hidden rounded-xl border border-red-500/20 bg-red-950/10">
          <div className="flex shrink-0 items-center gap-2 border-b border-red-500/20 px-5 py-4">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h2 className="font-semibold text-white">System errors</h2>
            <span className="text-sm text-zinc-500">{pagination.error.total}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-red-500/[0.04] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3">What part has error</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-500/10 text-zinc-300">
                {errors.map((record) => (
                  <tr
                    key={record.id}
                    className="cursor-default transition-colors duration-200 hover:bg-red-500/[0.08]"
                  >
                    <td className="px-5 py-3 text-red-200">{record.error_part || "Unknown system error"}</td>
                    <td className="whitespace-nowrap px-5 py-3">{formatDate(record.date)}</td>
                  </tr>
                ))}
                {!loading && errors.length === 0 && (
                  <tr><td colSpan="2" className="px-5 py-8 text-center text-zinc-500">No system errors recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls pageInfo={pagination.error} onPageChange={setErrorPage} loading={loading} />
        </section>
      )}
    </div>
  );
}
