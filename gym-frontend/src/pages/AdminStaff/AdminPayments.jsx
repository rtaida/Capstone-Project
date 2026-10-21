import { useCallback, useEffect, useMemo, useState } from "react";
import FeedbackModal from "../../components/memberModal/FeedbackModal";
import {
  CheckCircle,
  Clock3,
  CreditCard,
  RefreshCw,
  Search,
  User,
  CalendarDays,
  PhilippinePeso,
  XCircle,
  AlertCircle,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "/api";

const TABS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "paid", label: "Paid" },
  { id: "billed", label: "Billed" },
];

const money = (value) =>
  `₱${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
};

const statusClass = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "paid":
      return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";

    case "pending":
      return "bg-amber-500/10 text-amber-400 border border-amber-500/20";

    case "billed":
      return "bg-classic-gold/10 text-classic-gold border border-classic-gold/20";

    case "rejected":
      return "bg-red-500/10 text-red-400 border border-red-500/20";

    default:
      return "bg-zinc-800 text-zinc-400 border border-zinc-700";
  }
};

export default function AdminPayments({ addNotification }) {
  const [status, setStatus] = useState("pending");
  const [payments, setPayments] = useState([]);
  const [paymentStats, setPaymentStats] = useState({
    pending_count: 0,
    pending_amount: 0,
    paid_count: 0,
    paid_amount: 0,
    billed_count: 0,
    billed_amount: 0,
    total_count: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");

  const [feedback, setFeedback] = useState(null);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("auth_token") ||
    "";

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const token = getToken();

        const response = await fetch(
          `${API_URL}/member_api.php?action=get_payments&status=${encodeURIComponent(
            status,
          )}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept: "application/json",
              ...(token
                ? {
                    Authorization: `Bearer ${token}`,
                  }
                : {}),
            },
          },
        );

        const raw = await response.text();

        let data;

        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(
            `Server returned an invalid response (${response.status}). ${raw.slice(
              0,
              250,
            )}`,
          );
        }

        if (!response.ok || !data.success) {
          throw new Error(
            data?.message ||
              `Failed to load payments (HTTP ${response.status}).`,
          );
        }

        setPayments(
          Array.isArray(data.payments)
            ? data.payments
            : [],
        );

        setPaymentStats({
          pending_count: Number(data?.stats?.pending_count || 0),
          pending_amount: Number(data?.stats?.pending_amount || 0),
          paid_count: Number(data?.stats?.paid_count || 0),
          paid_amount: Number(data?.stats?.paid_amount || 0),
          billed_count: Number(data?.stats?.billed_count || 0),
          billed_amount: Number(data?.stats?.billed_amount || 0),
          total_count: Number(data?.stats?.total_count || 0),
        });
      } catch (error) {
        const message =
          error?.message ||
          "Failed to load payments.";

        setFeedback({
          type: "error",
          message,
        });

        try {
          await addNotification?.(
            "Payments",
            message,
            "error",
          );
        } catch {}
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [status, addNotification],
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered = payments.filter((payment) => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [
      payment.full_name,
      payment.walk_in_name,
      payment.payment_type,
      payment.payment_method,
      payment.session_type,
      payment.payment_status,
      payment.payment_id,
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(query),
    );
  });

  const pendingCount = paymentStats.pending_count;
  const pendingAmount = paymentStats.pending_amount;
  const paidAmount = paymentStats.paid_amount;

  const processPayment = async (action) => {
    if (!selected || processing) {
      return;
    }

    const paymentId = Number(
      selected.payment_id || 0,
    );

    if (!paymentId) {
      setFeedback({
        type: "error",
        message: "Invalid payment ID.",
      });
      return;
    }

    setProcessing(true);
    setFeedback(null);

    try {
      const token = getToken();

      const response = await fetch(
        `${API_URL}/member_api.php?action=${encodeURIComponent(
          action,
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
          cache: "no-store",
          body: JSON.stringify({
            payment_id: paymentId,
            reason:
              action === "bill_payment"
                ? reason.trim()
                : "",
          }),
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
            `Payment update failed (HTTP ${response.status}).`,
        );
      }

      const successMessage =
        data.message ||
        (action === "confirm_payment"
          ? "Payment confirmed successfully."
          : "Payment moved to Billing successfully.");

      setSelected(null);
      setReason("");

      setFeedback({
        type: "success",
        message: successMessage,
      });

      try {
        await addNotification?.(
          "Payments",
          successMessage,
          "success",
        );
      } catch {}

      await load(true);
    } catch (error) {
      const message =
        error?.message ||
        "Payment update failed.";

      setFeedback({
        type: "error",
        message,
      });

      try {
        await addNotification?.(
          "Payments",
          message,
          "error",
        );
      } catch {}
    } finally {
      setProcessing(false);
    }
  };

  const closeModal = () => {
    if (processing) {
      return;
    }

    setSelected(null);
    setReason("");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <FeedbackModal
        isOpen={Boolean(feedback)}
        type={feedback?.type || "success"}
        title={
          feedback?.type === "success"
            ? "Success"
            : "Payment Error"
        }
        message={feedback?.message || ""}
        onClose={() => setFeedback(null)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Payments
          </h1>

          <p className="text-zinc-400 text-sm mt-1">
            Review and confirm member payment transactions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-classic-gold/10 text-classic-gold hover:bg-classic-gold/20 transition-all disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${
              refreshing ? "animate-spin" : ""
            }`}
          />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-black/40 border border-amber-500/20 rounded-xl p-4">
          <Clock3 className="w-5 h-5 text-amber-400 mb-2" />

          <p className="text-2xl font-bold text-white">
            {pendingCount}
          </p>

          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            Pending
          </p>
        </div>

        <div className="bg-black/40 border border-amber-500/20 rounded-xl p-4">
          <PhilippinePeso className="w-5 h-5 text-amber-400 mb-2" />

          <p className="text-2xl font-bold text-white">
            {money(pendingAmount)}
          </p>

          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            Pending Value
          </p>
        </div>

        <div className="bg-black/40 border border-emerald-500/20 rounded-xl p-4">
          <CheckCircle className="w-5 h-5 text-emerald-400 mb-2" />

          <p className="text-2xl font-bold text-white">
            {money(paidAmount)}
          </p>

          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            Paid Value
          </p>
        </div>

        <div className="bg-black/40 border border-classic-gold/20 rounded-xl p-4">
          <CreditCard className="w-5 h-5 text-classic-gold mb-2" />

          <p className="text-2xl font-bold text-white">
            {paymentStats.total_count}
          </p>

          <p className="text-xs text-zinc-500 uppercase tracking-wider">
            Transactions
          </p>
        </div>
      </div>

      <div className="bg-black/40 border border-classic-gold/10 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex gap-1 bg-zinc-900/70 rounded-lg p-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatus(tab.id)}
                className={`px-4 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                  status === tab.id
                    ? "bg-classic-gold text-black"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search member, session, payment..."
              className="w-full pl-9 pr-3 py-2.5 bg-zinc-900/70 border border-zinc-800 rounded-lg text-sm text-white outline-none focus:border-classic-gold/50"
            />
          </div>
        </div>
      </div>

      <div className="bg-black/40 border border-classic-gold/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-classic-gold mx-auto mb-3 animate-spin" />

            <p className="text-zinc-400">
              Loading payments...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-10 h-10 text-zinc-700 mx-auto mb-3" />

            <p className="text-zinc-300 font-medium">
              No payments found.
            </p>

            <p className="text-zinc-600 text-xs mt-1">
              There are no transactions matching the current filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-4 text-xs uppercase tracking-wider text-zinc-500">
                    Member
                  </th>

                  <th className="text-left px-5 py-4 text-xs uppercase tracking-wider text-zinc-500">
                    Session
                  </th>

                  <th className="text-left px-5 py-4 text-xs uppercase tracking-wider text-zinc-500">
                    Type
                  </th>

                  <th className="text-left px-5 py-4 text-xs uppercase tracking-wider text-zinc-500">
                    Amount
                  </th>

                  <th className="text-left px-5 py-4 text-xs uppercase tracking-wider text-zinc-500">
                    Method
                  </th>

                  <th className="text-left px-5 py-4 text-xs uppercase tracking-wider text-zinc-500">
                    Date
                  </th>

                  <th className="text-left px-5 py-4 text-xs uppercase tracking-wider text-zinc-500">
                    Status
                  </th>

                  <th className="text-right px-5 py-4 text-xs uppercase tracking-wider text-zinc-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((payment) => {
                  const paymentStatus = String(
                    payment.payment_status || "",
                  ).toLowerCase();

                  const memberName =
                    payment.full_name ||
                    payment.walk_in_name ||
                    "Walk-in Client";

                  return (
                    <tr
                      key={payment.payment_id}
                      className="border-b border-zinc-800/70 hover:bg-classic-gold/5 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-classic-gold/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-classic-gold" />
                          </div>

                          <div>
                            <p className="text-sm text-white font-medium">
                              {memberName}
                            </p>

                            <p className="text-xs text-zinc-600">
                              #{payment.payment_id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm text-zinc-300">
                            {payment.session_type ||
                              "Regular Session"}
                          </p>

                          {payment.session_start && (
                            <p className="text-xs text-zinc-600 mt-1">
                              {formatDate(
                                payment.session_start,
                              )}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-xs text-zinc-400">
                          {String(
                            payment.payment_type ||
                              "REGULAR_SESSION",
                          ).replaceAll("_", " ")}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-sm font-semibold text-classic-gold">
                          {money(payment.amount)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-xs text-zinc-400">
                          {payment.payment_method || "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-xs text-zinc-500">
                          {formatDate(payment.payment_date)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${statusClass(
                            paymentStatus,
                          )}`}
                        >
                          {paymentStatus || "unknown"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelected(payment)
                          }
                          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                            paymentStatus === "pending"
                              ? "bg-classic-gold text-black hover:bg-yellow-400"
                              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                          }`}
                        >
                          {paymentStatus === "pending"
                            ? "Review"
                            : "View"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#111111] border border-classic-gold/20 rounded-xl shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
            role="dialog"
            aria-modal="true"
          >
            <div className="h-px bg-classic-gold/60" />

            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Payment Details
                </h2>

                <p className="text-xs text-zinc-500 mt-1">
                  Transaction #{selected.payment_id}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={processing}
                className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all disabled:opacity-50"
                aria-label="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-zinc-900/70 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-classic-gold" />
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                      Member
                    </p>
                  </div>

                  <p className="text-sm text-white font-medium">
                    {selected.full_name ||
                      selected.walk_in_name ||
                      "Walk-in Client"}
                  </p>

                  {selected.member_id && (
                    <p className="text-xs text-zinc-600 mt-1">
                      Member #{selected.member_id}
                    </p>
                  )}
                </div>

                <div className="bg-zinc-900/70 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <PhilippinePeso className="w-4 h-4 text-classic-gold" />
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                      Amount
                    </p>
                  </div>

                  <p className="text-xl text-classic-gold font-bold">
                    {money(selected.amount)}
                  </p>
                </div>

                <div className="bg-zinc-900/70 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-4 h-4 text-classic-gold" />
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                      Payment Method
                    </p>
                  </div>

                  <p className="text-sm text-white">
                    {selected.payment_method || "—"}
                  </p>
                </div>

                <div className="bg-zinc-900/70 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays className="w-4 h-4 text-classic-gold" />
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                      Payment Date
                    </p>
                  </div>

                  <p className="text-sm text-white">
                    {formatDate(
                      selected.payment_date,
                    )}
                  </p>
                </div>
              </div>

              <div className="bg-zinc-900/70 rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
                  Transaction Type
                </p>

                <p className="text-sm text-white">
                  {String(
                    selected.payment_type ||
                      "REGULAR_SESSION",
                  ).replaceAll("_", " ")}
                </p>
              </div>

              {selected.session_type && (
                <div className="bg-zinc-900/70 rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
                    Session
                  </p>

                  <p className="text-sm text-white">
                    {selected.session_type}
                  </p>

                  {selected.session_start && (
                    <p className="text-xs text-zinc-500 mt-2">
                      {formatDate(
                        selected.session_start,
                      )}
                    </p>
                  )}
                </div>
              )}

              <div
                className={`rounded-xl border p-4 ${statusClass(
                  selected.payment_status,
                )}`}
              >
                <div className="flex items-center gap-2">
                  {String(
                    selected.payment_status || "",
                  ).toLowerCase() === "paid" ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}

                  <div>
                    <p className="text-[10px] uppercase tracking-wider opacity-70">
                      Current Status
                    </p>

                    <p className="text-sm font-semibold uppercase">
                      {selected.payment_status ||
                        "Unknown"}
                    </p>
                  </div>
                </div>
              </div>

              {String(
                selected.payment_status || "",
              ).toLowerCase() === "pending" && (
                <>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-2">
                      Billing note
                    </label>

                    <textarea
                      value={reason}
                      onChange={(event) =>
                        setReason(event.target.value)
                      }
                      rows={3}
                      placeholder="Optional note if moving this payment to Billing..."
                      className="w-full bg-zinc-900/70 border border-zinc-800 rounded-xl px-3 py-3 text-sm text-white outline-none resize-none focus:border-classic-gold/50"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        processPayment(
                          "confirm_payment",
                        )
                      }
                      disabled={processing}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition-all disabled:opacity-50"
                    >
                      {processing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}

                      Confirm Payment
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        processPayment(
                          "bill_payment",
                        )
                      }
                      disabled={processing}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-classic-gold text-black font-semibold hover:bg-yellow-400 transition-all disabled:opacity-50"
                    >
                      {processing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CreditCard className="w-4 h-4" />
                      )}

                      Move to Billing
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={processing}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              )}

              {String(
                selected.payment_status || "",
              ).toLowerCase() === "paid" && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Payment has already been confirmed.
                </div>
              )}

              {String(
                selected.payment_status || "",
              ).toLowerCase() === "billed" && (
                <div className="flex items-center gap-2 text-classic-gold text-sm">
                  <CreditCard className="w-4 h-4" />
                  This payment has been moved to Billing.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}