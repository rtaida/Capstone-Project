import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Mail,
  Phone,
  RefreshCw,
  Star,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  UserRound,
} from "lucide-react";
import bgImage from "../../assets/Capra bg.jpg";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const money = (value) => `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDateInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const formatRevenueDate = (value, includeYear = true) => {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
};

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const databaseDateKey = (value) => {
  const key = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
};

const inPeriod = (value, month, year) => {
  const d = parseDate(value);
  const key = databaseDateKey(value);
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  if (key) return key.startsWith(`${monthKey}-`);

  return d && d.getMonth() === month && d.getFullYear() === year;
};

const getAuthHeaders = () => {
  const token =
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    "";

  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

function Metric({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-xl border border-classic-gold/10 bg-black/35 p-4">
      <Icon className="h-5 w-5 text-classic-gold mb-3" />
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-zinc-500 mt-2">{sub}</div>}
    </div>
  );
}

function TrainerCard({ trainer, sessions }) {
  const trainerSessions = sessions.filter((s) => Number(s.trainer_id) === Number(trainer.trainerID));
  const rated = trainerSessions.filter((s) => Number(s.rating) > 0);
  const average = rated.length ? rated.reduce((sum, s) => sum + Number(s.rating), 0) / rated.length : 0;
  const clients = new Set(trainerSessions.map((s) => s.booked_by).filter(Boolean)).size;

  return (
    <div className="rounded-2xl border border-classic-gold/10 bg-black/35 overflow-hidden">
      <div className="p-5 border-b border-classic-gold/10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-classic-gold/10 flex items-center justify-center ring-1 ring-classic-gold/20">
              <UserRound className="h-5 w-5 text-classic-gold" />
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-semibold truncate">{trainer.full_name || "Unnamed Trainer"}</h3>
              <p className="text-classic-gold/70 text-xs">{trainer.specialization || trainer.expertise_area || "Trainer"}</p>
            </div>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${average >= 4 ? "bg-emerald-500/10 text-emerald-400" : average > 0 ? "bg-classic-gold/10 text-classic-gold" : "bg-zinc-500/10 text-zinc-400"}`}>
          {average ? `${average.toFixed(1)}/5` : "Not rated"}
        </span>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-white/[0.03] p-3">
          <div className="text-zinc-500 text-xs mb-1 flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Email</div>
          <div className="text-zinc-200 truncate">{trainer.email || "—"}</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3">
          <div className="text-zinc-500 text-xs mb-1 flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> Phone</div>
          <div className="text-zinc-200">{trainer.phone_number || trainer.phone || "—"}</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3">
          <div className="text-zinc-500 text-xs mb-1">Age</div>
          <div className="text-zinc-200">{trainer.age || "—"}</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3">
          <div className="text-zinc-500 text-xs mb-1">Status</div>
          <div className="text-zinc-200">{trainer.status || "Active"}</div>
        </div>
      </div>
      <div className="px-5 pb-5 grid grid-cols-3 gap-3">
        <div className="text-center rounded-lg bg-white/[0.03] p-3">
          <div className="text-white font-semibold">{trainerSessions.length}</div>
          <div className="text-[10px] uppercase text-zinc-500">Sessions</div>
        </div>
        <div className="text-center rounded-lg bg-white/[0.03] p-3">
          <div className="text-white font-semibold">{clients}</div>
          <div className="text-[10px] uppercase text-zinc-500">Clients</div>
        </div>
        <div className="text-center rounded-lg bg-white/[0.03] p-3">
          <div className="flex justify-center items-center gap-1 text-white font-semibold">{average ? average.toFixed(1) : "—"}<Star className="w-3.5 h-3.5 text-classic-gold fill-classic-gold" /></div>
          <div className="text-[10px] uppercase text-zinc-500">Rating</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminReports({ addNotification, showFeedback }) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [members, setMembers] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [payments, setPayments] = useState([]);
  const [billing, setBilling] = useState([]);
  const [walkIns, setWalkIns] = useState([]);
  const [revenueStartDate, setRevenueStartDate] = useState(() => formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [revenueEndDate, setRevenueEndDate] = useState(() => formatDateInput(now));
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [memberFilter, setMemberFilter] = useState("active");
  const [paymentFilter, setPaymentFilter] = useState("paid");
  const [trainerFilter, setTrainerFilter] = useState("most sessions");
  const reportRef = useRef(null);

  const fetchReports = useCallback(async () => {
    setRefreshing(true);
    try {
      const [
        membersRes,
        trainersRes,
        sessionsRes,
        attendanceRes,
        revenueRes,
        paymentsRes,
        billingRes,
        walkInsRes,
      ] = await Promise.all([
        fetch(`${API_URL}/member_api.php?action=get`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/trainer_api.php?action=get_report_trainers`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/trainer_api.php?action=get_all_sessions`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/member_api.php?action=get_attendance`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/member_api.php?action=get_revenue&month=${selectedMonth + 1}&year=${selectedYear}&start_date=${revenueStartDate}&end_date=${revenueEndDate}`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/member_api.php?action=get_payments&status=all`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/billing_api.php?action=get_records&days=14&status=all`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/member_api.php?action=get_walk_ins&month=${selectedMonth + 1}&year=${selectedYear}`, { headers: getAuthHeaders() }),
      ]);

      const responses = [
        membersRes,
        trainersRes,
        sessionsRes,
        attendanceRes,
        revenueRes,
        paymentsRes,
        billingRes,
        walkInsRes,
      ];

      const invalidResponse = responses.find((response) => !response.ok);
      if (invalidResponse) {
        throw new Error(`Report API request failed with HTTP ${invalidResponse.status}`);
      }

      const [
        membersData,
        trainersData,
        sessionsData,
        attendanceData,
        revenueData,
        paymentsData,
        billingData,
        walkInsData,
      ] = await Promise.all(responses.map((response) => response.json()));
      if (membersData.success) setMembers(membersData.members || []);
      if (trainersData.success) setTrainers(trainersData.trainers || []);
      if (sessionsData.success) setSessions(sessionsData.sessions || []);
      if (attendanceData.success) setAttendance(attendanceData.records || []);
      if (revenueData.success) setRevenue(revenueData.revenue || []);
      if (paymentsData.success) setPayments(paymentsData.payments || []);
      if (billingData.success) setBilling(billingData.records || []);
      if (walkInsData.success) setWalkIns(walkInsData.records || []);
    } catch {
      addNotification?.("Report Error", "Failed to load report data.", "error");
      showFeedback?.("error", "Failed to load report data.", "Report Error");
    } finally {
      setRefreshing(false);
    }
  }, [selectedMonth, selectedYear, revenueStartDate, revenueEndDate, addNotification, showFeedback]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchReports(); }, 0);
    return () => clearTimeout(timer);
  }, [fetchReports]);

  const periodMembers = useMemo(() => members.filter((m) => inPeriod(m.created_at, selectedMonth, selectedYear)), [members, selectedMonth, selectedYear]);
  const periodSessions = useMemo(() => sessions.filter((s) => inPeriod(s.start_time || s.created_at, selectedMonth, selectedYear)), [sessions, selectedMonth, selectedYear]);
  const periodAttendance = useMemo(() => attendance.filter((a) => inPeriod(a.attendance_date || a.created_at, selectedMonth, selectedYear)), [attendance, selectedMonth, selectedYear]);
  const totalRevenue = useMemo(() => revenue.reduce((sum, r) => sum + Number(r.amount || 0), 0), [revenue]);
  const periodPayments = useMemo(() => payments.filter((p) => inPeriod(p.payment_date || p.created_at, selectedMonth, selectedYear)), [payments, selectedMonth, selectedYear]);
  const periodBilling = useMemo(() => billing.filter((b) => inPeriod(b.payment_date || b.created_at, selectedMonth, selectedYear)), [billing, selectedMonth, selectedYear]);
  const periodWalkIns = useMemo(() => walkIns.filter((w) => {
    const status = String(w.payment_status || w.linked_payment_status || "").toLowerCase();
    return inPeriod(w.created_at, selectedMonth, selectedYear) &&
      !["rejected", "voided", "refunded"].includes(status);
  }), [walkIns, selectedMonth, selectedYear]);
  const paidWalkIns = periodWalkIns.filter((w) => String(w.payment_status || w.linked_payment_status || "").toLowerCase() === "paid");
  const walkInRevenue = paidWalkIns.reduce((sum, w) => sum + Number(w.amount || 0), 0);
  const paidPayments = periodPayments.filter((p) => p.payment_status === "paid");
  const pendingPayments = periodPayments.filter((p) => p.payment_status === "pending");
  const openBills = periodBilling.filter((b) => ["open", "pending", "partial"].includes(String(b.billing_status || "").toLowerCase()));
  const paidAttendance = useMemo(
    () => periodAttendance.filter((a) => String(a.payment_status || "").toLowerCase() === "paid").length,
    [periodAttendance]
  );
  const totalMembers = members.length;
  const activeMembers = members.filter((m) => String(m.status).toLowerCase() === "active").length;
  const inactiveMembers = members.filter((m) => String(m.status).toLowerCase() === "inactive").length;
  const newMembersForMonth = periodMembers.length;
  const approvedSessions = periodSessions.filter((s) => s.status === "approved").length;
  const bookedSessions = periodSessions.filter((s) => s.is_booked === true || Number(s.is_booked) === 1).length;
  const ratedSessions = periodSessions.filter((s) => Number(s.rating) > 0);
  const avgRating = ratedSessions.length ? ratedSessions.reduce((sum, s) => sum + Number(s.rating), 0) / ratedSessions.length : 0;
  const revenueDays = revenue.filter((r) => Number(r.amount) > 0).length;
  const averageDailyRevenue = revenue.length ? totalRevenue / revenue.length : 0;

  const revenueChart = revenue.map((r) => ({
    day: /^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) ? formatRevenueDate(r.date, false) : `Day ${r.date}`,
    revenue: Number(r.amount || 0),
  }));
  const revenueRangeLabel = `${formatRevenueDate(revenueStartDate)} - ${formatRevenueDate(revenueEndDate)}`;

  const memberLeaderboard = useMemo(() => {
    const checkInCounts = attendance.reduce((counts, record) => {
      const memberId = Number(record.member_id);
      if (memberId > 0) counts[memberId] = (counts[memberId] || 0) + 1;
      return counts;
    }, {});

    return members
      .map((member) => ({
        ...member,
        checkInTotal: checkInCounts[Number(member.memberID)] || 0,
      }))
      .sort((first, second) => second.checkInTotal - first.checkInTotal || String(first.full_name || "").localeCompare(String(second.full_name || "")));
  }, [attendance, members]);

  const filteredMemberList = useMemo(() => {
    const filterValue = String(memberFilter).trim().toLowerCase();
    if (filterValue === "most checks in") {
      return memberLeaderboard.filter((member) => member.checkInTotal > 0).slice(0, 8);
    }
    if (filterValue === "active") {
      return members.filter((member) => String(member.status || "").toLowerCase() === "active");
    }
    if (filterValue === "inactive") {
      return members.filter((member) => String(member.status || "").toLowerCase() === "inactive");
    }
    return members;
  }, [memberFilter, memberLeaderboard, members]);

  const trainerRows = useMemo(() => {
    return trainers.map((trainer) => {
      const allTrainerSessions = sessions.filter((s) => Number(s.trainer_id) === Number(trainer.trainerID));
      const rated = allTrainerSessions.filter((s) => Number(s.rating) > 0);
      const average = rated.length ? rated.reduce((sum, s) => sum + Number(s.rating), 0) / rated.length : 0;
      const clients = [...new Set(allTrainerSessions.map((s) => s.booked_by).filter(Boolean))];
      const selectedSessions = allTrainerSessions.filter((s) => inPeriod(s.start_time || s.created_at, selectedMonth, selectedYear));
      return {
        name: trainer.full_name || "Unnamed Trainer",
        specialization: trainer.specialization || trainer.expertise_area || "Trainer",
        email: trainer.email || "Not provided",
        phone: trainer.phone_number || trainer.phone || "Not provided",
        age: trainer.age || "Not provided",
        status: trainer.status || "Active",
        sessions: selectedSessions.length,
        totalSessions: allTrainerSessions.length,
        clients,
        rating: average,
        ratingCount: rated.length,
      };
    });
  }, [selectedMonth, selectedYear, sessions, trainers]);

  const filteredTrainerList = useMemo(() => {
    const list = [...trainerRows];
    const filterValue = String(trainerFilter).trim().toLowerCase();

    if (filterValue === "most sessions") {
      return list
        .sort((a, b) => (Number(b.totalSessions) || 0) - (Number(a.totalSessions) || 0) || (Number(b.rating) || 0) - (Number(a.rating) || 0));
    }

    if (filterValue === "least sessions") {
      return list
        .sort((a, b) => (Number(a.totalSessions) || 0) - (Number(b.totalSessions) || 0) || (Number(b.rating) || 0) - (Number(a.rating) || 0));
    }

    if (filterValue === "high ratings") {
      return list
        .filter((trainer) => Number(trainer.rating) > 0)
        .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0) || (Number(b.totalSessions) || 0) - (Number(a.totalSessions) || 0));
    }

    return list;
  }, [trainerFilter, trainerRows]);

  const trainerSummary = useMemo(() => {
    const ratedRows = filteredTrainerList.filter((trainer) => Number(trainer.rating) > 0);
    const average = ratedRows.length ? ratedRows.reduce((sum, trainer) => sum + Number(trainer.rating || 0), 0) / ratedRows.length : 0;

    return {
      total: filteredTrainerList.length,
      sessions: filteredTrainerList.reduce((sum, trainer) => sum + Number(trainer.sessions || 0), 0),
      average,
    };
  }, [filteredTrainerList]);

  const paymentOverview = useMemo(() => {
    const paidAmount = paidPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const pendingAmount = pendingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const billedAmount = openBills.reduce((sum, b) => sum + Number(b.total_amount ?? b.amount_due ?? 0), 0);
    const totalAmount = paidAmount + pendingAmount + billedAmount;

    return {
      paidAmount,
      pendingAmount,
      billedAmount,
      totalAmount,
    };
  }, [openBills, paidPayments, pendingPayments]);

  const paymentSummaryValue = useMemo(() => {
    switch (paymentFilter) {
      case "paid": return { label: "Paid", value: paymentOverview.paidAmount, count: paidPayments.length };
      case "pending": return { label: "Pendings", value: paymentOverview.pendingAmount, count: pendingPayments.length };
      case "billed": return { label: "Billed", value: paymentOverview.billedAmount, count: openBills.length };
      case "total": return { label: "Total", value: paymentOverview.totalAmount, count: paidPayments.length + pendingPayments.length + openBills.length };
      default: return { label: "Paid", value: paymentOverview.paidAmount, count: paidPayments.length };
    }
  }, [openBills.length, paidPayments, paymentFilter, paymentOverview, pendingPayments]);

  const revenueInsight = useMemo(() => {
    if (!totalRevenue) return `No paid revenue was recorded from ${revenueRangeLabel}. That is a warning signal: check whether sessions were actually sold and whether payments were recorded correctly.`;
    if (revenueDays < Math.max(1, Math.ceil(revenue.length * 0.2))) return `Revenue is positive, but concentrated on only ${revenueDays} day${revenueDays === 1 ? "" : "s"}. That is a weak consistency signal; review session bookings and payment collection.`;
    if (averageDailyRevenue > 0 && bookedSessions > 0) return `Revenue looks healthy for the selected period: ${money(totalRevenue)} across ${revenueDays} revenue day${revenueDays === 1 ? "" : "s"}, with ${bookedSessions} booked session${bookedSessions === 1 ? "" : "s"}.`;
    return `Revenue is ${money(totalRevenue)} for the selected period. There is activity, but the report should be compared with bookings and attendance before calling performance strong or weak.`;
  }, [totalRevenue, revenueDays, revenue.length, revenueRangeLabel, averageDailyRevenue, bookedSessions]);

  const changeMonth = (delta) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const buildStructuredPdf = () => {
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 44;
    const contentWidth = pageWidth - margin * 2;
    const pages = [];
    let commands = [];
    let y = margin;

    const C = {
      black: [0.08, 0.08, 0.09],
      text: [0.18, 0.18, 0.20],
      muted: [0.43, 0.43, 0.46],
      gold: [0.76, 0.57, 0.17],
      lightGold: [0.94, 0.89, 0.74],
      border: [0.82, 0.74, 0.54],
      light: [0.97, 0.97, 0.96],
      white: [1, 1, 1],
      green: [0.12, 0.42, 0.27],
      red: [0.62, 0.19, 0.18],
    };

    const pdfEscape = (value) =>
      String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/\r?\n/g, " ")
        .replace(/[—–]/g, "-")
        .replace(/₱/g, "PHP ");

    const addCommand = (command) => commands.push(command);
    const rgb = (c, stroke = false) => `${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)} ${stroke ? "RG" : "rg"}`;

    const text = (value, x, topY, size = 10, options = {}) => {
      const font = options.bold ? "F2" : "F1";
      const color = options.color || C.text;
      addCommand(
        `${rgb(color)} BT /${font} ${size} Tf ${x.toFixed(2)} ${(pageHeight - topY).toFixed(2)} Td (${pdfEscape(value)}) Tj ET`
      );
    };

    const line = (x1, y1, x2, y2, width = 0.7, color = C.border) => {
      addCommand(
        `${rgb(color, true)} ${width.toFixed(2)} w ${x1.toFixed(2)} ${(pageHeight - y1).toFixed(2)} m ${x2.toFixed(2)} ${(pageHeight - y2).toFixed(2)} l S`
      );
    };

    const rect = (x, topY, width, height, options = {}) => {
      const fill = options.fill || C.white;
      const stroke = options.stroke || C.border;
      const mode = options.stroke === false ? "f" : "B";
      addCommand(
        `${rgb(fill)} ${rgb(stroke, true)} 0.7 w ${x.toFixed(2)} ${(pageHeight - topY - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${mode}`
      );
    };

    const wrap = (value, maxChars) => {
      const words = String(value ?? "").split(/\s+/).filter(Boolean);
      const lines = [];
      let current = "";
      words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxChars && current) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      });
      if (current) lines.push(current);
      return lines;
    };

    const startPage = () => {
      commands = [];
      y = margin;
    };
    const finishPage = () => pages.push(commands.join("\n"));
    const ensureSpace = (needed = 30) => {
      if (y + needed > pageHeight - margin - 20) {
        finishPage();
        startPage();
      }
    };

    const paragraph = (value, maxChars = 92, size = 9.5, leading = 14) => {
      wrap(value, maxChars).forEach((lineText) => {
        ensureSpace(leading + 2);
        text(lineText, margin, y, size, { color: C.text });
        y += leading;
      });
      y += 4;
    };

    const sectionTitle = (title, subtitle) => {
      ensureSpace(58);
      text(title, margin, y, 16, { bold: true, color: C.black });
      y += 20;
      if (subtitle) {
        text(subtitle, margin, y, 9, { color: C.muted });
        y += 15;
      }
      line(margin, y, pageWidth - margin, y, 0.9, C.gold);
      y += 17;
    };

    const metricStrip = (items, columns = 4) => {
      const gap = 8;
      const width = (contentWidth - gap * (columns - 1)) / columns;
      const height = 61;
      items.forEach((item, index) => {
        if (index > 0 && index % columns === 0) y += height + gap;
        const col = index % columns;
        const x = margin + col * (width + gap);
        const top = y;
        rect(x, top, width, height, { fill: C.light, stroke: [0.88, 0.88, 0.86] });
        text(item.label, x + 9, top + 17, 7.5, { color: C.muted });
        text(item.value, x + 9, top + 39, 14, { bold: true, color: C.black });
      });
      y += height + 18;
    };

    const keyValue = (label, value, x, top, width) => {
      text(label, x, top, 7.5, { bold: true, color: C.muted });
      const lines = wrap(value, Math.max(20, Math.floor(width / 5.4)));
      lines.slice(0, 2).forEach((lineText, i) => text(lineText, x, top + 13 + i * 11, 8.5, { color: C.text }));
    };

    const drawRevenueChart = () => {
      ensureSpace(260);
      const top = y;
      const chartHeight = 205;
      const chartLeft = margin + 49;
      const chartWidth = contentWidth - 62;
      const values = revenueChart.map((r) => Number(r.revenue || 0));
      const maxValue = Math.max(1, ...values);
      const gap = values.length > 18 ? 1.8 : 3.2;
      const barWidth = values.length ? Math.max(2.4, (chartWidth - gap * Math.max(0, values.length - 1)) / values.length) : 0;

      rect(margin, top, contentWidth, chartHeight + 25, { fill: C.white, stroke: [0.88, 0.88, 0.86] });
      text("Daily paid revenue", margin + 13, top + 19, 10, { bold: true, color: C.black });
      text(revenueRangeLabel, margin + 13, top + 34, 7.5, { color: C.muted });

      const baseline = top + chartHeight - 22;
      const plotTop = top + 52;
      line(chartLeft, baseline, chartLeft + chartWidth, baseline, 0.7, [0.55, 0.55, 0.56]);
      line(chartLeft, plotTop, chartLeft, baseline, 0.7, [0.55, 0.55, 0.56]);

      [0, maxValue / 2, maxValue].forEach((value) => {
        const tickY = baseline - (value / maxValue) * (baseline - plotTop);
        line(chartLeft, tickY, chartLeft + chartWidth, tickY, 0.3, [0.90, 0.90, 0.90]);
        text(`PHP ${Math.round(value).toLocaleString()}`, margin + 2, tickY + 3, 6.5, { color: C.muted });
      });

      values.forEach((value, i) => {
        const height = (value / maxValue) * (baseline - plotTop);
        const x = chartLeft + i * (barWidth + gap);
        addCommand(`${rgb(C.gold)} ${x.toFixed(2)} ${(pageHeight - baseline).toFixed(2)} ${barWidth.toFixed(2)} ${height.toFixed(2)} re f`);
        if (i === 0 || i === values.length - 1 || i % 5 === 0) {
          text(String(revenueChart[i]?.day || ""), x, baseline + 13, 6, { color: C.muted });
        }
      });
      y = top + chartHeight + 38;
    };

    const pdfTrainerRows = trainers.map((trainer) => {
      const allTrainerSessions = sessions.filter((s) => Number(s.trainer_id) === Number(trainer.trainerID));
      const rated = allTrainerSessions.filter((s) => Number(s.rating) > 0);
      const average = rated.length ? rated.reduce((sum, s) => sum + Number(s.rating), 0) / rated.length : 0;
      const clients = new Set(allTrainerSessions.map((s) => s.booked_by).filter(Boolean)).size;
      const selectedSessions = allTrainerSessions.filter((s) => inPeriod(s.start_time || s.created_at, selectedMonth, selectedYear));
      return {
        name: trainer.full_name || "Unnamed Trainer",
        specialization: trainer.specialization || trainer.expertise_area || "Trainer",
        email: trainer.email || "Not provided",
        phone: trainer.phone_number || trainer.phone || "Not provided",
        age: trainer.age || "Not provided",
        status: trainer.status || "Active",
        sessions: selectedSessions.length,
        totalSessions: allTrainerSessions.length,
        clients,
        rating: average,
        ratingCount: rated.length,
      };
    });

    const paidValue = paidPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const openBillingValue = openBills.reduce((sum, b) => sum + Number(b.total_amount ?? b.amount_due ?? 0), 0);
    const attendanceRate = periodSessions.length ? Math.round((paidAttendance / periodSessions.length) * 100) : 0;

    startPage();

    text("CAPRA FITNESS", margin, y, 11, { bold: true, color: C.gold });
    y += 23;
    text("SYSTEM PERFORMANCE REPORT", margin, y, 22, { bold: true, color: C.black });
    y += 19;
    text(`${months[selectedMonth]} ${selectedYear}`, margin, y, 10, { color: C.muted });
    y += 9;
    text(`Generated on ${new Date().toLocaleString()}`, margin, y + 13, 8, { color: C.muted });
    y += 35;
    line(margin, y, pageWidth - margin, y, 1.2, C.gold);
    y += 24;

    paragraph(
      `This report summarizes Capra Fitness system activity for ${months[selectedMonth]} ${selectedYear}. It combines membership records, session activity, attendance linked to confirmed payments, payment transactions, billing records, and trainer performance information. The figures are based on the records currently available in the system at the time this report was generated.`,
      93
    );

    metricStrip([
      { label: "TOTAL MEMBERS", value: String(totalMembers) },
      { label: "ACTIVE MEMBERS", value: String(activeMembers) },
      { label: "INACTIVE MEMBERS", value: String(inactiveMembers) },
      { label: "NEW MEMBERS THIS MONTH", value: String(newMembersForMonth) },
      { label: "TOTAL SESSIONS", value: String(periodSessions.length) },
      { label: "APPROVED SESSIONS", value: String(approvedSessions) },
      { label: "BOOKED SESSIONS", value: String(bookedSessions) },
      { label: "PAID CHECK-INS", value: String(paidAttendance) },
    ]);

    sectionTitle("Management Assessment", "Interpretation of the selected-period results.");
    paragraph(revenueInsight, 93);
    paragraph(
      `Attendance recorded from paid check-ins is ${paidAttendance}. The report uses attendance records associated with confirmed paid payments, so the figure reflects actual recorded check-ins rather than simply counting payment transactions.`,
      93
    );
    if (openBills.length > 0) {
      paragraph(`There are ${openBills.length} open billing record${openBills.length === 1 ? "" : "s"} representing ${money(openBillingValue)} in outstanding charges. Collection follow-up should be prioritized for these records.`, 93);
    } else {
      paragraph("No open billing records were found for the selected period. This indicates no currently recorded overdue balance in the billing dataset for this report period.", 93);
    }


    finishPage();
    startPage();
    sectionTitle("Revenue Analysis", `Paid revenue from ${revenueRangeLabel}.`);
    text(`Total paid revenue: ${money(totalRevenue)}`, margin, y, 13, { bold: true, color: C.gold });
    y += 23;
    drawRevenueChart();
    paragraph(
      `The bar graph above shows the distribution of confirmed paid revenue from ${revenueRangeLabel}. Total paid revenue reached ${money(totalRevenue)}, with revenue recorded on ${revenueDays} day${revenueDays === 1 ? "" : "s"}. The average daily revenue across the selected range was ${money(averageDailyRevenue)}.`,
      93
    );
    sectionTitle("Revenue Interpretation", "The narrative provides a concise interpretation of the selected-period revenue trend.");
    paragraph(revenueInsight, 93);
    paragraph(
      `Revenue performance is best interpreted together with bookings, sessions, and payment status. A high revenue value with low booking activity may indicate a small number of high-value sessions, while frequent bookings with weak revenue may indicate pricing or collection issues. The graph therefore serves as a performance indicator rather than a standalone measure of overall business health.`,
      93
    );
    metricStrip([
      { label: "PAID PAYMENTS", value: String(paidPayments.length) },
      { label: "PAID PAYMENT VALUE", value: money(paidValue) },
      { label: "PENDING PAYMENTS", value: String(pendingPayments.length) },
      { label: "OPEN BILLS", value: String(openBills.length) },
    ], 4);

  
    finishPage();
    startPage();
    sectionTitle("Membership & Operations", "Membership status and session activity for the selected reporting period.");
    paragraph(
      `Capra Fitness currently has ${totalMembers} recorded members. Of these, ${activeMembers} are marked active and ${inactiveMembers} are marked inactive. ${newMembersForMonth} new member${newMembersForMonth === 1 ? " was" : "s were"} recorded during ${months[selectedMonth]} ${selectedYear}. Active and inactive totals are current system-wide figures, while new members are limited to the selected month.`,
      93
    );
    metricStrip([
      { label: "TOTAL MEMBERS", value: String(totalMembers) },
      { label: "ACTIVE", value: String(activeMembers) },
      { label: "INACTIVE", value: String(inactiveMembers) },
      { label: `NEW IN ${months[selectedMonth].toUpperCase()}`, value: String(newMembersForMonth) },
    ]);

    sectionTitle("Sessions & Attendance", "Recorded activity during the selected month.");
    paragraph(
      `${periodSessions.length} session${periodSessions.length === 1 ? " was" : "s were"} recorded in the selected month. ${approvedSessions} were approved and ${bookedSessions} had a member booking. The system recorded ${paidAttendance} paid check-in${paidAttendance === 1 ? "" : "s"}. Using sessions as the operational denominator, the recorded paid check-in-to-session ratio is approximately ${attendanceRate}%. This is a descriptive system metric, not a utilization rate for gym capacity.`,
      93
    );
    metricStrip([
      { label: "TOTAL SESSIONS", value: String(periodSessions.length) },
      { label: "APPROVED", value: String(approvedSessions) },
      { label: "BOOKED", value: String(bookedSessions) },
      { label: "PAID CHECK-INS", value: String(paidAttendance) },
    ]);

    sectionTitle("Walk-in Activity", "Walk-in transactions recorded during the selected month.");
    paragraph(
      `${periodWalkIns.length} walk-in client${periodWalkIns.length === 1 ? " was" : "s were"} recorded during ${months[selectedMonth]} ${selectedYear}. ${paidWalkIns.length} walk-in payment${paidWalkIns.length === 1 ? " was" : "s were"} confirmed as paid, generating ${money(walkInRevenue)} in confirmed walk-in revenue. Walk-in clients are reported separately from registered members and do not increase the membership count.`,
      93
    );
    metricStrip([
      { label: "WALK-INS", value: String(periodWalkIns.length) },
      { label: "PAID WALK-INS", value: String(paidWalkIns.length) },
      { label: "WALK-IN REVENUE", value: money(walkInRevenue) },
    ], 3);

    sectionTitle("Payments & Billing", "Financial record status for the selected month.");
    paragraph(
      `${paidPayments.length} payment${paidPayments.length === 1 ? " was" : "s were"} marked paid, with a combined paid value of ${money(paidValue)}. ${pendingPayments.length} payment${pendingPayments.length === 1 ? " remains" : "s remain"} pending. ${openBills.length} open billing record${openBills.length === 1 ? " represents" : "s represent"} ${money(openBillingValue)} in outstanding charges.`,
      93
    );
    metricStrip([
      { label: "PAID PAYMENTS", value: String(paidPayments.length) },
      { label: "PENDING", value: String(pendingPayments.length) },
      { label: "OPEN BILLS", value: String(openBills.length) },
      { label: "PAID VALUE", value: money(paidValue) },
    ]);

    finishPage();
    startPage();
    sectionTitle("Trainer Performance", "Every trainer is included with contact details, workload, clients, and service ratings.");
    paragraph(
      "Trainer ratings are calculated from recorded session ratings in the system. The rating is an average of available ratings, while session and client counts describe recorded activity. Trainers without a recorded rating are shown as not rated rather than being assigned an artificial score.",
      93
    );

    if (!pdfTrainerRows.length) {
      text("No trainers were returned by the trainer report data source.", margin, y, 10, { color: C.muted });
      y += 20;
    } else {
      pdfTrainerRows.forEach((trainer) => {
        ensureSpace(174);
        const top = y;
        const height = 154;
        rect(margin, top, contentWidth, height, { fill: C.white, stroke: [0.86, 0.80, 0.66] });
        text(trainer.name, margin + 13, top + 21, 13, { bold: true, color: C.black });
        text(trainer.specialization, margin + 13, top + 36, 8.5, { color: C.gold });
        const ratingText = trainer.rating ? `${trainer.rating.toFixed(1)} / 5.0` : "Not rated";
        text(`Overall rating: ${ratingText}`, pageWidth - margin - 128, top + 21, 8.5, { bold: true, color: trainer.rating >= 4 ? C.green : C.gold });
        line(margin + 13, top + 48, pageWidth - margin - 13, top + 48, 0.45, [0.90, 0.90, 0.88]);

        const col1 = margin + 13;
        const col2 = margin + contentWidth / 2 + 5;
        keyValue("EMAIL", trainer.email, col1, top + 65, 205);
        keyValue("PHONE", trainer.phone, col2, top + 65, 205);
        keyValue("AGE", String(trainer.age), col1, top + 92, 205);
        keyValue("STATUS", String(trainer.status), col2, top + 92, 205);
        keyValue("SELECTED-MONTH SESSIONS", String(trainer.sessions), col1, top + 119, 205);
        keyValue("TOTAL RECORDED SESSIONS", String(trainer.totalSessions), col2, top + 119, 205);
        keyValue("RECORDED CLIENTS", String(trainer.clients), col1, top + 141, 205);
        keyValue("RATINGS USED", String(trainer.ratingCount), col2, top + 141, 205);
        y += height + 13;
      });
    }

    finishPage();

    const objects = [];
    const addObject = (body) => {
      const id = objects.length + 1;
      objects.push({ id, body });
      return id;
    };
    const pagesId = addObject("");
    const catalogId = addObject("");
    const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const pageIds = [];

    pages.forEach((pageCommands, index) => {
      const footer = [
        `${rgb(C.muted)}`,
        `BT /F1 7 Tf ${margin.toFixed(2)} ${(pageHeight - 24).toFixed(2)} Td (Capra Fitness System Report) Tj ET`,
        `BT /F1 7 Tf ${(pageWidth - margin - 48).toFixed(2)} ${(pageHeight - 24).toFixed(2)} Td (Page ${index + 1}) Tj ET`,
      ].join("\n");
      const stream = new TextEncoder().encode(`${pageCommands}\n${footer}`);
      const contentId = addObject({ dictionary: `<< /Length ${stream.length} >>`, stream });
      const pageId = addObject(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
        `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> ` +
        `/Contents ${contentId} 0 R >>`
      );
      pageIds.push(pageId);
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
      else {
        pushText(`${object.body.dictionary}\nstream\n`);
        pushBytes(object.body.stream);
        pushText("\nendstream\nendobj\n");
      }
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
      const pdfBytes = buildStructuredPdf();

      if (!pdfBytes || pdfBytes.length < 1500) {
        throw new Error("The generated PDF is empty or incomplete.");
      }

      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Capra_Fitness_System_Report_${months[selectedMonth]}_${selectedYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      try {
        await fetch(`${API_URL}/audit_api.php?action=generate_report`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ month: months[selectedMonth], year: selectedYear }),
        });
      } catch (auditError) {
        console.error("Report audit recording failed:", auditError);
      }

      addNotification?.(
        "Report Generated",
        "A structured PDF report was saved to your computer.",
        "success"
      );
      showFeedback?.(
        "success",
        "The report was saved as a PDF file and may be opened or printed as needed.",
        "Report Generated"
      );
    } catch (error) {
      console.error("PDF Generation Error:", error);
      addNotification?.("Report Failed", "Could not generate the PDF report.", "error");
      showFeedback?.(
        "error",
        `Could not generate the PDF report: ${error.message}`,
        "Report Failed"
      );
    } finally {
      setGenerating(false);
    }
  };

  const years = Array.from({ length: 8 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="relative space-y-6 animate-in fade-in duration-500">
      <div className="fixed inset-0 -z-10 bg-cover bg-center opacity-[0.08]" style={{ backgroundImage: `url(${bgImage})` }} />
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-zinc-400 text-sm mt-1">System performance report for {months[selectedMonth]} {selectedYear}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => changeMonth(-1)} className="p-2.5 rounded-lg border border-classic-gold/10 bg-black/30 text-zinc-300 hover:text-classic-gold"><ChevronLeft className="w-4 h-4" /></button>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="rounded-lg border border-classic-gold/10 bg-[#121212] text-white px-3 py-2 text-sm outline-none">
            {months.map((month, i) => <option key={month} value={i}>{month}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="rounded-lg border border-classic-gold/10 bg-[#121212] text-white px-3 py-2 text-sm outline-none">
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <button onClick={() => changeMonth(1)} className="p-2.5 rounded-lg border border-classic-gold/10 bg-black/30 text-zinc-300 hover:text-classic-gold"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={fetchReports} disabled={refreshing} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-classic-gold/10 text-classic-gold hover:bg-classic-gold/20 disabled:opacity-50 text-sm">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={generatePdf} disabled={generating || refreshing} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-classic-gold text-black hover:bg-light-gold disabled:opacity-50 text-sm font-medium">
            <FileDown className="w-4 h-4" /> {generating ? "Creating PDF..." : "Generate PDF"}
          </button>
        </div>
      </div>

      <div ref={reportRef} className="space-y-6 bg-[#0b0b0b] p-1 rounded-2xl">
        <section className="rounded-2xl border border-classic-gold/10 bg-black/40 p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Activity className="w-5 h-5 text-classic-gold" /> Revenue</h2>
              <p className="text-xs text-zinc-500">Paid revenue from {revenueRangeLabel}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <span>From</span>
                <input
                  aria-label="Revenue start date"
                  type="date"
                  value={revenueStartDate}
                  max={revenueEndDate}
                  onChange={(event) => { if (event.target.value) setRevenueStartDate(event.target.value); }}
                  className="rounded-lg border border-classic-gold/10 bg-[#121212] text-white px-2 py-2 text-sm outline-none"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <span>To</span>
                <input
                  aria-label="Revenue end date"
                  type="date"
                  value={revenueEndDate}
                  min={revenueStartDate}
                  onChange={(event) => { if (event.target.value) setRevenueEndDate(event.target.value); }}
                  className="rounded-lg border border-classic-gold/10 bg-[#121212] text-white px-2 py-2 text-sm outline-none"
                />
              </label>
            </div>
            <div className="text-right"><div className="text-xl font-bold text-classic-gold">{money(totalRevenue)}</div><div className="text-[10px] uppercase text-zinc-500">Paid revenue</div></div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={320}>
              <BarChart data={revenueChart} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="day" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} interval={Math.max(0, Math.ceil(revenueChart.length / 15) - 1)} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${Number(v).toLocaleString()}`} />
                <Tooltip contentStyle={{ background: "#161616", border: "1px solid rgba(212,175,55,.3)", borderRadius: 10, color: "#fff" }} formatter={(v) => [money(v), "Revenue"]} />
                <Bar dataKey="revenue" fill="#d4af37" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 rounded-xl border border-classic-gold/10 bg-classic-gold/5 p-4">
            <div className="flex items-center gap-2 text-classic-gold text-sm font-semibold mb-1">
              {revenueDays >= Math.max(1, Math.ceil(revenue.length * 0.2)) ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} Revenue insight
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{revenueInsight}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-classic-gold/10 bg-black/40 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2"><Users className="w-5 h-5 text-classic-gold" /><div><h2 className="text-lg font-semibold text-white">Member Overview</h2><p className="text-xs text-zinc-500">Current membership status and new registrations</p></div></div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'most checks in', label: 'Most Checks in' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setMemberFilter(value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${memberFilter === value ? 'border-classic-gold bg-classic-gold/15 text-classic-gold' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Metric icon={Users} label="Total members" value={totalMembers} sub="All current members" />
            <Metric icon={UserCheck} label="Active members" value={activeMembers} sub="All active members" />
            <Metric icon={Users} label="Inactive members" value={inactiveMembers} sub="All inactive members" />
            <Metric icon={UserRound} label="New members" value={newMembersForMonth} sub={`${months[selectedMonth]} ${selectedYear}`} />
          </div>
          <div className="mt-5 max-h-[320px] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredMemberList.map((member) => (
                <div key={member.memberID} className="rounded-xl border border-classic-gold/10 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-white font-semibold">{member.full_name || "Unknown member"}</div>
                      <div className="text-xs text-zinc-500">{member.email || "No email"}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] ${String(member.status || "").toLowerCase() === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"}`}>
                      {member.status || "Inactive"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                    <span>Check-ins</span>
                    <span className="text-classic-gold font-semibold">{member.checkInTotal || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-classic-gold/10 bg-black/40 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
            <div><h2 className="text-lg font-semibold text-white flex items-center gap-2"><UserRound className="w-5 h-5 text-classic-gold" /> Trainers</h2><p className="text-xs text-zinc-500">Every trainer with performance information</p></div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'most sessions', label: 'Most Sessions' },
                { value: 'least sessions', label: 'Least Sessions' },
                { value: 'high ratings', label: 'High Ratings' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTrainerFilter(value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${trainerFilter === value ? 'border-classic-gold bg-classic-gold/15 text-classic-gold' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-400"><span>{trainerSummary.total} trainers</span><span>{trainerSummary.sessions} sessions</span><span>{trainerSummary.average ? `${trainerSummary.average.toFixed(1)}/5 avg.` : "No ratings"}</span></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredTrainerList.length ? filteredTrainerList.map((trainer) => (
              <div key={`${trainer.name}-${trainer.email}`} className="rounded-2xl border border-classic-gold/10 bg-black/35 overflow-hidden">
                <div className="p-5 border-b border-classic-gold/10 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-classic-gold/10 flex items-center justify-center ring-1 ring-classic-gold/20">
                        <UserRound className="h-5 w-5 text-classic-gold" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white font-semibold truncate">{trainer.name}</h3>
                        <p className="text-classic-gold/70 text-xs">{trainer.specialization}</p>
                      </div>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${trainer.rating >= 4 ? 'bg-emerald-500/10 text-emerald-400' : trainer.rating > 0 ? 'bg-classic-gold/10 text-classic-gold' : 'bg-zinc-500/10 text-zinc-400'}`}>
                    {trainer.rating ? `${trainer.rating.toFixed(1)}/5` : 'Not rated'}
                  </span>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="text-zinc-500 text-xs mb-1 flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Email</div>
                    <div className="text-zinc-200 truncate">{trainer.email}</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="text-zinc-500 text-xs mb-1 flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> Phone</div>
                    <div className="text-zinc-200">{trainer.phone}</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="text-zinc-500 text-xs mb-1">Age</div>
                    <div className="text-zinc-200">{trainer.age}</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <div className="text-zinc-500 text-xs mb-1">Status</div>
                    <div className="text-zinc-200">{trainer.status}</div>
                  </div>
                </div>
                <div className="px-5 pb-5 grid grid-cols-3 gap-3">
                  <div className="text-center rounded-lg bg-white/[0.03] p-3">
                    <div className="text-white font-semibold">{trainer.totalSessions}</div>
                    <div className="text-[10px] uppercase text-zinc-500">Sessions</div>
                  </div>
                  <div className="text-center rounded-lg bg-white/[0.03] p-3">
                    <div className="text-white font-semibold">{trainer.clients.length}</div>
                    <div className="text-[10px] uppercase text-zinc-500">Clients</div>
                  </div>
                  <div className="text-center rounded-lg bg-white/[0.03] p-3">
                    <div className="flex justify-center items-center gap-1 text-white font-semibold">{trainer.rating ? trainer.rating.toFixed(1) : '—'}<Star className="w-3.5 h-3.5 text-classic-gold fill-classic-gold" /></div>
                    <div className="text-[10px] uppercase text-zinc-500">Rating</div>
                  </div>
                </div>
                {trainer.clients.length > 0 && (
                  <div className="px-5 pb-5">
                    <div className="rounded-xl border border-classic-gold/10 bg-white/[0.02] p-3">
                      <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 mb-2">Clients</div>
                      <div className="space-y-2">
                        {trainer.clients.slice(0, 4).map((client, index) => (
                          <div key={`${trainer.name}-${client}-${index}`} className="flex items-center justify-between text-xs text-zinc-300">
                            <span>{client}</span>
                            <span className="text-zinc-500">Availment</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )) : <div className="col-span-full py-10 text-center text-zinc-500">No trainers found.</div>}
          </div>
        </section>

        <section className="rounded-2xl border border-classic-gold/10 bg-black/40 p-5">
          <div className="flex items-center gap-2 mb-4"><Calendar className="w-5 h-5 text-classic-gold" /><div><h2 className="text-lg font-semibold text-white">Sessions & Attendance</h2><p className="text-xs text-zinc-500">Operational activity for the selected month</p></div></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric icon={Calendar} label="Total sessions" value={periodSessions.length} />
            <Metric icon={UserCheck} label="Approved" value={approvedSessions} />
            <Metric icon={Activity} label="Booked" value={bookedSessions} />
            <Metric icon={Users} label="Paid check-ins" value={paidAttendance} />
          </div>
        </section>

        <section className="rounded-2xl border border-classic-gold/10 bg-black/40 p-5">
          <div className="flex items-center gap-2 mb-4"><UserRound className="w-5 h-5 text-classic-gold" /><div><h2 className="text-lg font-semibold text-white">Walk-in Activity</h2><p className="text-xs text-zinc-500">Walk-in transactions recorded during the selected month</p></div></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Metric icon={UserRound} label="Walk-ins" value={periodWalkIns.length} sub="Recorded walk-in clients" />
            <Metric icon={UserCheck} label="Paid walk-ins" value={paidWalkIns.length} sub="Confirmed payments" />
            <Metric icon={TrendingUp} label="Walk-in revenue" value={money(walkInRevenue)} sub="Confirmed revenue" />
          </div>
        </section>

        <section className="rounded-2xl border border-classic-gold/10 bg-black/40 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2"><FileDown className="w-5 h-5 text-classic-gold" /><div><h2 className="text-lg font-semibold text-white">Payments & Billing</h2><p className="text-xs text-zinc-500">Financial records for the selected month</p></div></div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'paid', label: 'Paid' },
                { value: 'pending', label: 'Pendings' },
                { value: 'billed', label: 'Billed' },
                { value: 'total', label: 'Total' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPaymentFilter(value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${paymentFilter === value ? 'border-classic-gold bg-classic-gold/15 text-classic-gold' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric icon={FileDown} label="Paid payments" value={paidPayments.length} sub={money(paymentOverview.paidAmount)} />
            <Metric icon={Activity} label="Pending payments" value={pendingPayments.length} sub={money(paymentOverview.pendingAmount)} />
            <Metric icon={Calendar} label="Billed (unpaid bills)" value={openBills.length} sub={money(paymentOverview.billedAmount)} />
            <Metric icon={TrendingUp} label="Total" value={money(paymentOverview.totalAmount)} sub="Paid + pending + billed" />
          </div>
          <div className="mt-5 rounded-xl border border-classic-gold/10 bg-classic-gold/5 p-4">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Selected financial filter</div>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <div className="text-2xl font-bold text-white">{paymentSummaryValue.label}</div>
                <div className="text-xs text-zinc-400">{paymentSummaryValue.count} records</div>
              </div>
              <div className="text-2xl font-bold text-classic-gold">{money(paymentSummaryValue.value)}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}