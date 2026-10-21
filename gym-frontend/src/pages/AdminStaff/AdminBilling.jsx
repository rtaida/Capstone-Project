import { useCallback, useEffect, useMemo, useState } from "react";
import FeedbackModal from "../../components/memberModal/FeedbackModal";
import {
  AlertCircle,
  CheckCircle,
  Clock3,
  CreditCard,
  Mail,
  PhilippinePeso,
  Printer,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "/api";

const TABS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "partial", label: "Partial" },
  { id: "paid", label: "Paid" },
];

const money = (value) =>
  `₱${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const printInvoice = (invoice, lines) => {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return false;

  const status = String(invoice.billing_status || "pending").toUpperCase();
  const rows = lines.map((line, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(line.description || (line.attendance_id ? `Attendance #${line.attendance_id}` : "Promotion / walk-in charge"))}</td>
      <td>${escapeHtml(line.attendance_date ? new Date(line.attendance_date).toLocaleDateString() : "-")}</td>
      <td class="amount">${escapeHtml(money(line.amount))}</td>
    </tr>`).join("");

  printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(invoice.bill_id)}</title>
    <style>
      @page { size: A4; margin: 18mm; }
      * { box-sizing: border-box; }
      body { color: #171717; font: 14px Arial, sans-serif; margin: 0; }
      .receipt { max-width: 760px; margin: 0 auto; }
      header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #b28a39; padding-bottom: 18px; }
      h1 { font-size: 24px; margin: 0 0 5px; }
      h2 { font-size: 20px; margin: 0 0 8px; }
      .muted { color: #666; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin: 22px 0; }
      .meta p { margin: 4px 0; }
      table { border-collapse: collapse; width: 100%; margin-top: 22px; }
      th, td { border-bottom: 1px solid #ddd; padding: 10px 8px; text-align: left; }
      th { background: #f4f1e9; }
      .amount { text-align: right; white-space: nowrap; }
      tfoot td { border: 0; font-size: 17px; font-weight: bold; padding-top: 18px; }
      .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 70px; margin-top: 80px; }
      .signature { border-top: 1px solid #777; padding-top: 8px; text-align: center; }
      @media print { body { print-color-adjust: exact; } }
    </style></head><body><main class="receipt">
      <header><div><h1>Capra Fitness</h1><div class="muted">Payment receipt / invoice</div></div><div><h2>Invoice #${escapeHtml(invoice.bill_id)}</h2><strong>${escapeHtml(status)}</strong></div></header>
      <section class="meta">
        <div><p class="muted">Billed to</p><strong>${escapeHtml(invoice.member_name || "Walk-in customer")}</strong><p>${escapeHtml(invoice.member_email || "")}</p><p>${escapeHtml(invoice.member_phone || "")}</p></div>
        <div><p><strong>Issued:</strong> ${escapeHtml(formatDate(invoice.created_at))}</p><p><strong>Invoice status:</strong> ${escapeHtml(status)}</p><p><strong>Description:</strong> ${escapeHtml(invoice.description || "Gym services")}</p></div>
      </section>
      <table><thead><tr><th>#</th><th>Service / attendance</th><th>Date</th><th class="amount">Amount</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">No invoice items</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3" class="amount">Total</td><td class="amount">${escapeHtml(money(invoice.total_amount))}</td></tr></tfoot>
      </table>
      <div class="signatures"><div class="signature">Received by</div><div class="signature">Member signature</div></div>
    </main><script>window.addEventListener('load', () => window.print());</script></body></html>`);
  printWindow.document.close();
  return true;
};

const paymentStatusClass = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "paid":
      return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
    case "partial":
      return "bg-blue-500/10 text-blue-300 border border-blue-500/20";
    case "pending":
      return "bg-classic-gold/10 text-classic-gold border border-classic-gold/20";
    case "billed":
      return "bg-classic-gold/10 text-classic-gold border border-classic-gold/20";
    case "rejected":
      return "bg-red-500/10 text-red-300 border border-red-500/20";
    default:
      return "bg-zinc-800/80 text-zinc-400 border border-zinc-700";
  }
};

export default function AdminBilling({ addNotification }) {
  const [status, setStatus] = useState("all");
  const thresholdDays = 7; // Fixed to 1 week

  const [records, setRecords] = useState([]);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({
    total_records: 0,
    open_records: 0,
    open_amount: 0,
    paid_records: 0,
    paid_amount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [selected, setSelected] = useState(null);
  const [invoiceLines, setInvoiceLines] = useState([]);
  const [memberFilter, setMemberFilter] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [showMemberOptions, setShowMemberOptions] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [partialPaymentOpen, setPartialPaymentOpen] = useState(false);
  const [partialSelections, setPartialSelections] = useState({});

  const [feedback, setFeedback] = useState(null);

  const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("auth_token") ||
    "";

  const showFeedback = (type, message, title) => {
    setFeedback({
      type,
      message,
      title:
        title ||
        (type === "success" ? "Success" : "Billing Error"),
    });
  };

  const load = useCallback(
    async (refresh = false) => {
      if (!refresh) {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          action: "get_records",
          status,
          days: String(thresholdDays),
          ...(memberFilter ? { member_id: memberFilter } : {}),
        });

        const response = await fetch(
          `${API_URL}/billing_api.php?${params.toString()}`,
          {
            cache: "no-store",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
          },
        );

        const raw = await response.text();

        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(
            `Server returned an invalid response (HTTP ${response.status}). ${raw.slice(
              0,
              250,
            )}`,
          );
        }

        if (!response.ok || !data.success) {
          throw new Error(
            data?.message ||
            `Failed to load billing records (HTTP ${response.status})`,
          );
        }

        setRecords(
          Array.isArray(data.records) ? data.records : [],
        );

        setStats(
          data.stats || {
            total_records: 0,
            open_records: 0,
            open_amount: 0,
            paid_records: 0,
            paid_amount: 0,
          },
        );
      } catch (error) {
        const message =
          error?.message ||
          "Failed to load billing records.";

        showFeedback(
          "error",
          message,
          "Billing Error",
        );

        try {
          await addNotification?.(
            "Billing",
            message,
            "error",
          );
        } catch (notificationError) {
          console.error("Unable to add billing error notification:", notificationError);
        }
      } finally {
        setLoading(false);
      }
    },
    [status, thresholdDays, memberFilter, addNotification],
  );

  useEffect(() => {
    fetch(`${API_URL}/member_api.php?action=get`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setMembers(data.members || []);
      })
      .catch((error) => console.error("Unable to load billing member filters:", error));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      load(true);
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [load]);

  const runBillingCheck = async () => {
    if (processing) return;

    setProcessing(true);

    try {
      const response = await fetch(
        `${API_URL}/billing_api.php?action=process_overdue&days=${thresholdDays}`,
        {
          method: "GET",
          cache: "no-store",
          headers: { Authorization: `Bearer ${getToken()}` },
        },
      );

      const raw = await response.text();

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(
          `Invalid billing server response (HTTP ${response.status}).`,
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data?.message ||
          "Billing check failed.",
        );
      }

      showFeedback(
        "success",
        data.message ||
        "Billing check completed.",
        "Billing Check Complete",
      );

      try {
        await addNotification?.(
          "Billing",
          data.message ||
          "Billing check completed.",
          "success",
        );
      } catch (notificationError) {
        console.error("Unable to add billing success notification:", notificationError);
      }

      await load(true);
    } catch (error) {
      showFeedback(
        "error",
        error?.message ||
        "Billing check failed.",
        "Billing Check Failed",
      );
    } finally {
      setProcessing(false);
    }
  };

  const runBillingAction = async (action) => {
    if (!selected || processing) return;

    setProcessing(true);
    try {
      const response = await fetch(
        `${API_URL}/billing_api.php?action=${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ bill_id: Number(selected.bill_id) }),
        },
      );
      const raw = await response.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Invalid billing server response (HTTP ${response.status}).`);
      }
      if (!response.ok || !data.success) {
        throw new Error(data?.message || "Billing action failed.");
      }

      setSelected(null);
      showFeedback("success", data.message, action === "mark_paid" ? "Payment Confirmed" : "Notice Sent");
      await load(true);
    } catch (error) {
      showFeedback("error", error?.message || "Billing action failed.", "Billing Error");
    } finally {
      setProcessing(false);
    }
  };

  const openInvoice = async (invoice) => {
    setSelected(invoice);
    setInvoiceLines([]);
    setDetailsLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/billing_api.php?action=get_record&bill_id=${encodeURIComponent(invoice.bill_id)}`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load invoice details.");
      }
      setSelected(data.invoice || invoice);
      setInvoiceLines(data.lines || []);
    } catch (error) {
      showFeedback("error", error.message || "Unable to load invoice details.", "Invoice Error");
    } finally {
      setDetailsLoading(false);
    }
  };

  const filteredMembers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();
    if (!query) return members.slice(0, 20);
    return members
      .filter((member) => [member.full_name, member.email, member.phone, member.memberID]
        .some((value) => String(value || "").toLowerCase().includes(query)))
      .slice(0, 20);
  }, [members, memberQuery]);

  const filtered = records;

  const selectMemberFilter = (member) => {
    setMemberFilter(member ? String(member.memberID) : "");
    setMemberQuery(member ? member.full_name : "");
    setShowMemberOptions(false);
  };

  const handlePrintInvoice = () => {
    if (!selected) return;
    if (!printInvoice(selected, invoiceLines)) {
      showFeedback("error", "Allow pop-ups to print or save the invoice as PDF.", "Print Blocked");
    }
  };

  const lineKey = (line, index) =>
    line.attendance_id ? `attendance-${line.attendance_id}` : `promo-${line.description || index}`;

  const openPartialPayment = () => {
    if (!selected || !invoiceLines.length) return;
    const next = {};
    invoiceLines.forEach((line, index) => {
      next[lineKey(line, index)] = false;
    });
    setPartialSelections(next);
    setPartialPaymentOpen(true);
  };

  const togglePartialLine = (key) => {
    setPartialSelections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const partialTotal = useMemo(() =>
    invoiceLines.reduce((total, line, index) => {
      const key = lineKey(line, index);
      return partialSelections[key] ? total + Number(line.amount || 0) : total;
    }, 0), [invoiceLines, partialSelections]);

  const submitPartialPayment = async () => {
    if (!selected || partialTotal <= 0) {
      showFeedback("error", "Select at least one session or promotion to apply a partial payment.", "Partial Payment");
      return;
    }

    try {
      const selectedItems = invoiceLines
        .filter((line, index) => partialSelections[lineKey(line, index)])
        .map((line) => ({
          attendance_id: line.attendance_id ?? null,
          amount: Number(line.amount || 0),
          description: line.description || "Selected charge",
        }));

      const response = await fetch(`${API_URL}/billing_api.php?action=partial_payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          bill_id: Number(selected.bill_id),
          selected: selectedItems,
        }),
      });

      const raw = await response.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Invalid billing server response (HTTP ${response.status}).`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data?.message || "Partial payment failed.");
      }

      setPartialPaymentOpen(false);
      setPartialSelections({});
      setSelected(null);
      showFeedback("success", data.message || "Partial payment applied.", "Partial Payment");
      await load(true);
    } catch (error) {
      showFeedback("error", error?.message || "Partial payment failed.", "Partial Payment");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <FeedbackModal
        isOpen={Boolean(feedback)}
        type={feedback?.type || "success"}
        title={feedback?.title || "Billing"}
        message={feedback?.message || ""}
        onClose={() => setFeedback(null)}
      />


      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Billing
          </h1>

          <p className="text-zinc-400 text-sm mt-1">
            Review member invoices, combine overdue attendance charges, and print receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900/70 border border-zinc-800 rounded-xl px-3 py-2">
            <Clock3 className="w-4 h-4 text-classic-gold" />

            <span className="text-xs text-zinc-500">
              Overdue after: <span className="text-white font-medium">1 week</span>
            </span>
          </div>

          <button
            onClick={runBillingCheck}
            disabled={processing}
            className="
              flex items-center gap-2
              px-4 py-2.5
              rounded-xl
              bg-classic-gold
              text-black
              font-semibold
              hover:bg-light-gold
              transition-all
              disabled:opacity-50
            "
          >
            <RefreshCw
              className={`w-4 h-4 ${processing ? "animate-spin" : ""
                }`}
            />

            {processing
              ? "Checking..."
              : "Run Billing Check"}
          </button>
        </div>
      </div>


      <div className="
        rounded-xl
        border border-classic-gold/10
        bg-classic-gold/5
        px-4 py-3
        flex items-start gap-3
      ">
        <AlertCircle className="w-5 h-5 text-classic-gold mt-0.5 shrink-0" />

        <p className="text-xs text-zinc-400 leading-relaxed">
          An invoice is created from a member's
          <span className="text-white font-medium">
            {" "}pending session payments{" "}
          </span>
          that remains unpaid beyond
            <span className="text-white font-medium"> 1 week</span>; overdue attendance items for that member are grouped into one pending invoice.
        </p>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-black/40 border border-red-500/20 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-400 mb-2" />
          <p className="text-2xl font-bold text-white">
            {stats.open_records || 0}
          </p>
          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            Pending Invoices
          </p>
        </div>

        <div className="bg-black/40 border border-red-500/20 rounded-xl p-4">
          <PhilippinePeso className="w-5 h-5 text-red-400 mb-2" />
          <p className="text-2xl font-bold text-white">
            {money(stats.open_amount)}
          </p>
          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            Outstanding
          </p>
        </div>

        <div className="bg-black/40 border border-emerald-500/20 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 text-emerald-400 mb-2" />
          <p className="text-2xl font-bold text-white">
            {stats.paid_records || 0}
          </p>
          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            Paid Invoices
          </p>
        </div>

        <div className="bg-black/40 border border-classic-gold/20 rounded-xl p-4">
          <CreditCard className="w-5 h-5 text-classic-gold mb-2" />
          <p className="text-2xl font-bold text-white">
            {stats.total_records || 0}
          </p>
          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            Total Invoices
          </p>
        </div>
      </div>


      <div className="
        bg-black/40
        border border-classic-gold/10
        rounded-xl
        p-4
        flex flex-col lg:flex-row
        gap-3
        lg:items-center
        lg:justify-between
      ">
        <div className="
          flex gap-1
          bg-zinc-900/70
          rounded-lg
          p-1
          overflow-x-auto
        ">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setStatus(tab.id)
              }
              className={`
                px-4 py-2
                rounded-md
                text-xs
                font-medium
                whitespace-nowrap
                transition-all
                ${status === tab.id
                  ? "bg-classic-gold text-black"
                  : "text-zinc-400 hover:text-white"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={memberQuery}
            onFocus={() => setShowMemberOptions(true)}
            onChange={(event) => {
              setMemberQuery(event.target.value);
              setMemberFilter("");
              setShowMemberOptions(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setShowMemberOptions(false);
            }}
            placeholder="Filter by member name, email, phone, or ID"
            aria-label="Search members to filter invoices"
            aria-expanded={showMemberOptions}
            aria-controls="billing-member-options"
            autoComplete="off"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/70 py-2.5 pl-9 pr-20 text-sm text-white outline-none focus:border-classic-gold/50"
          />
          {(memberFilter || memberQuery) && (
            <button
              type="button"
              onClick={() => selectMemberFilter(null)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
              aria-label="Clear member filter"
            >
              Clear
            </button>
          )}
          {showMemberOptions && (
            <div id="billing-member-options" className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-[#111111] py-1 shadow-xl">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectMemberFilter(null)}
                className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
              >
                All members
              </button>
              {filteredMembers.length ? filteredMembers.map((member) => (
                <button
                  type="button"
                  key={member.memberID}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectMemberFilter(member)}
                  className="w-full px-3 py-2 text-left hover:bg-zinc-800"
                >
                  <span className="block truncate text-sm text-zinc-200">{member.full_name}</span>
                  <span className="block truncate text-xs text-zinc-500">{member.email} · #{member.memberID}</span>
                </button>
              )) : (
                <p className="px-3 py-2 text-sm text-zinc-500">No matching members</p>
              )}
            </div>
          )}
        </div>
      </div>


      <div className="space-y-4">
        {loading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-52 rounded-xl bg-black/35 border border-classic-gold/10 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-black/35 border border-classic-gold/10 rounded-xl p-12 text-center">
            <CreditCard className="w-9 h-9 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-300 font-medium">No invoices found.</p>
            <p className="text-zinc-600 text-xs mt-1">
              Overdue attendance charges will be grouped into member invoices after 1 week.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filtered.map((record) => {
              const paymentStatus = String(record.billing_status || "pending").toLowerCase();
              const isPaid = paymentStatus === "paid";
              const isPartial = paymentStatus === "partial";

              return (
                <article
                  key={record.bill_id}
                  onClick={() => openInvoice(record)}
                  className="group cursor-pointer rounded-xl bg-black/35 border border-zinc-800/80 hover:border-classic-gold/25 hover:bg-black/45 transition-all duration-200"
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-classic-gold/5 border border-classic-gold/10 flex items-center justify-center shrink-0">
                          <CreditCard className="w-4.5 h-4.5 text-classic-gold" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-white">
                              Invoice #{record.bill_id}
                            </h3>
                            <span className="text-[10px] text-zinc-600">{record.item_count || 0} item(s)</span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1 truncate">
                            {record.member_name || "Unknown member"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-classic-gold">
                          {money(record.total_amount)}
                        </p>
                        <span
                          className={`inline-flex mt-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${paymentStatusClass(paymentStatus)}`}
                        >
                          {isPaid ? "PAID" : isPartial ? "PARTIAL" : "PENDING"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                      <div className="rounded-lg bg-zinc-900/45 border border-zinc-800/60 px-3 py-3">
                        <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">
                          Invoice
                        </p>
                        <p className="text-xs font-medium text-zinc-200 truncate">
                          {record.description || "Attendance charges"}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-1 truncate">
                          {record.item_count || 0} attendance line(s)
                        </p>
                      </div>

                      <div className="rounded-lg bg-zinc-900/45 border border-zinc-800/60 px-3 py-3">
                        <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">
                          Payment method
                        </p>
                        <p className="text-xs font-medium text-zinc-200">
                          {record.payment_method || "—"}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-1">
                          Issued: {formatDate(record.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-zinc-800/60">
                      <div className="flex items-center gap-2 min-w-0">
                        {isPaid ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : isPartial ? (
                          <CreditCard className="w-4 h-4 text-blue-300 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-classic-gold shrink-0" />
                        )}
                        <span className="text-[11px] text-zinc-500 truncate">
                          {isPaid ? "Invoice settled" : isPartial ? "Partial payment made" : "Invoice pending"}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-600 group-hover:text-classic-gold transition-colors">
                        Click to view details
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>


      {partialPaymentOpen && selected && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPartialPaymentOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg max-h-[80vh] overflow-hidden rounded-xl border border-blue-500/20 bg-[#111111] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Partial Payment</h3>
                <p className="text-xs text-zinc-500">Select which sessions or promo charges to settle.</p>
              </div>
              <button
                type="button"
                onClick={() => setPartialPaymentOpen(false)}
                className="rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:text-white"
                aria-label="Close partial payment"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[55vh] space-y-2 overflow-y-auto p-4">
              {invoiceLines.length === 0 ? (
                <p className="text-sm text-zinc-500">No invoice items available for partial payment.</p>
              ) : (
                invoiceLines.map((line, index) => {
                  const key = lineKey(line, index);
                  const checked = Boolean(partialSelections[key]);
                  return (
                    <label
                      key={key}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-3 transition ${checked ? "border-blue-500/40 bg-blue-500/10" : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePartialLine(key)}
                          className="h-4 w-4 accent-blue-500"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-white">{line.description || "Selected charge"}</p>
                          <p className="text-[10px] text-zinc-500">{formatDate(line.attendance_date) || "General invoice item"}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-classic-gold">{money(line.amount)}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="border-t border-zinc-800 bg-zinc-950/60 px-5 py-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-zinc-400">Selected total</span>
                <span className="text-lg font-bold text-white">{money(partialTotal)}</span>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPartialPaymentOpen(false)}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitPartialPayment}
                  disabled={partialTotal <= 0 || processing}
                  className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirm Partial Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelected(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-xl max-h-[82vh] overflow-hidden bg-[#111111] border border-classic-gold/15 rounded-xl shadow-2xl animate-modal-in"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-record-title"
          >
            <div className="h-px bg-classic-gold/50" />

            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80">
              <div className="min-w-0">
                <h2 id="billing-record-title" className="text-lg font-semibold text-white">
                  Invoice #{selected.bill_id}
                </h2>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {selected.description || "Attendance charges"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Close billing details"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(82vh-73px)] space-y-4">
              {detailsLoading ? (
                <p className="py-8 text-center text-sm text-zinc-500">Loading invoice details...</p>
              ) : null}
              <div className="flex items-center justify-between gap-4 rounded-lg bg-zinc-900/45 border border-zinc-800/70 px-4 py-3">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-zinc-600">
                    Invoice Status
                  </p>
                  <span
                    className={`inline-flex mt-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${paymentStatusClass(selected.billing_status)}`}
                  >
                    {String(selected.billing_status || "pending").toUpperCase() === "PARTIAL" ? "PARTIALLY PAID" : String(selected.billing_status || "pending").toUpperCase()}
                  </span>
                </div>
                <p className="text-xl font-bold text-classic-gold">
                  {money(selected.total_amount)}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-zinc-900/45 border border-zinc-800/70 p-4">
                  <p className="text-[9px] uppercase tracking-wider text-zinc-600">Member</p>
                  <p className="text-sm font-semibold text-white mt-1">
                    {selected.member_name || "Unknown member"}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1 break-all">
                    {selected.member_email || "No email"}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {selected.member_phone || "No phone"}
                  </p>
                </div>

                <div className="rounded-lg bg-zinc-900/45 border border-zinc-800/70 p-4">
                  <p className="text-[9px] uppercase tracking-wider text-zinc-600">Invoice description</p>
                  <p className="text-sm font-semibold text-white mt-1">{selected.description || "Attendance charges"}</p>
                  <p className="text-xs text-zinc-500 mt-1">{invoiceLines.length} attendance item(s)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg bg-zinc-900/45 border border-zinc-800/70 p-3">
                  <p className="text-[9px] uppercase tracking-wider text-zinc-600">Invoice created</p>
                  <p className="text-xs text-zinc-300 mt-1">{formatDate(selected.created_at)}</p>
                </div>
                <div className="rounded-lg bg-zinc-900/45 border border-zinc-800/70 p-3">
                  <p className="text-[9px] uppercase tracking-wider text-zinc-600">Overdue</p>
                  <p className="text-xs text-zinc-300 mt-1">{Math.max(0, Number(selected.overdue_days || 0))} days</p>
                </div>
                <div className="rounded-lg bg-zinc-900/45 border border-zinc-800/70 p-3">
                  <p className="text-[9px] uppercase tracking-wider text-zinc-600">Method</p>
                  <p className="text-xs text-zinc-300 mt-1">{selected.payment_method || "—"}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-zinc-800/70">
                <div className="grid grid-cols-[1fr_auto] gap-3 bg-zinc-900/70 px-4 py-2 text-[10px] uppercase tracking-wider text-zinc-500">
                  <span>Attendance / description</span><span>Amount</span>
                </div>
                {invoiceLines.map((line, index) => (
                  <div key={`${line.attendance_id || "legacy"}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 border-t border-zinc-800/70 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-zinc-200">{line.description || (line.attendance_id ? `Attendance #${line.attendance_id}` : "Promotion / walk-in charge")}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">{formatDate(line.attendance_date)}</p>
                    </div>
                    <p className="text-xs font-semibold text-white">{money(line.amount)}</p>
                  </div>
                ))}
              </div>

              {selected.description && (
                <div className="rounded-lg bg-zinc-900/45 border border-zinc-800/70 p-4">
                  <p className="text-[9px] uppercase tracking-wider text-zinc-600">Description</p>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{selected.description}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  type="button"
                  onClick={handlePrintInvoice}
                  disabled={detailsLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-200 hover:border-classic-gold/40 hover:text-classic-gold disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => runBillingAction("send_notice")}
                  disabled={processing || String(selected.billing_status).toLowerCase() === "paid"}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-classic-gold/30 bg-classic-gold/10 px-4 py-3 text-sm font-semibold text-classic-gold hover:bg-classic-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  Send Notice
                </button>
                <button
                  type="button"
                  onClick={openPartialPayment}
                  disabled={processing || String(selected.billing_status).toLowerCase() === "paid" || !invoiceLines.length}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-300 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  Partial Payment
                </button>
                <button
                  type="button"
                  onClick={() => runBillingAction("mark_paid")}
                  disabled={processing || String(selected.billing_status).toLowerCase() === "paid"}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark Paid
                </button>
              </div>

              <div className="text-[10px] text-zinc-700 pt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span>Created: {formatDate(selected.created_at)}</span>
                {selected.resolved_at && <span>Resolved: {formatDate(selected.resolved_at)}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}