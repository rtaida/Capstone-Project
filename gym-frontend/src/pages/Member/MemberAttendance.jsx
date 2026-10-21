import { useState, useEffect, useMemo } from "react";
import {
  CalendarDays,
  CalendarCheck,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  PhilippinePeso,
} from "lucide-react";
import { getAuthHeaders } from "../../services/api";

function MemberAttendance() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const memberId = user?.memberID || user?.id;
  const API_BASE = import.meta.env.VITE_API_URL || "/api";

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [promoAvailments, setPromoAvailments] = useState([]);
  const [promoPayments, setPromoPayments] = useState([]);
  const [paidSessionPayments, setPaidSessionPayments] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!memberId) {
        setLoading(false);
        setAttendanceRecords([]);
        setPaidSessionPayments([]);
        return;
      }

      setLoading(true);
      setError("");

      const month = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;

      try {
        const response = await fetch(
          `${API_BASE}/member_api.php?action=get_attendance&member_id=${encodeURIComponent(memberId)}&month=${month}`,
          { headers: getAuthHeaders() },
        );
        const data = await response.json();

        if (data.success) {
          setAttendanceRecords(data.records || []);
          setPromoAvailments(data.promo_availments || []);
          setPromoPayments(data.promo_payments || []);
          setPaidSessionPayments(data.paid_session_payments || []);
        } else {
          setError(data.message || "Unable to load attendance records.");
          setAttendanceRecords([]);
          setPromoAvailments([]);
          setPromoPayments([]);
          setPaidSessionPayments([]);
        }
      } catch (error) {
        console.error(error);
        setError("Network error while fetching attendance.");
        setAttendanceRecords([]);
        setPromoAvailments([]);
        setPromoPayments([]);
        setPaidSessionPayments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [memberId, calendarMonth]);

  const paidRecords = attendanceRecords.filter(
    (record) => String(record.payment_status || "").toLowerCase() === "paid",
  );
  const attendanceCount = paidRecords.length;
  const selectedMonthKey = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
  const totalAmount = paidRecords.reduce((sum, record) => sum + Number(record.total_amount || 0), 0)
    + promoPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    + paidSessionPayments
      .filter((payment) => !payment.attendance_id && String(payment.payment_date || "").slice(0, 7) === selectedMonthKey)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const totalSessions = attendanceRecords.reduce(
    (sum, record) => sum + (record.sessions ? record.sessions.split(",").length : 1),
    0
  ) + paidSessionPayments.filter((payment) =>
    !payment.attendance_id && String(payment.start_time || "").slice(0, 7) === selectedMonthKey,
  ).length;

  const calendarData = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const recordsByDate = new Map();
    paidRecords.forEach((record) => {
      const key = String(record.attendance_date || "").slice(0, 10);
      const records = recordsByDate.get(key) || [];
      records.push(record);
      recordsByDate.set(key, records);
    });
    const promosByDate = new Map();
    promoAvailments.forEach((promo) => {
      const start = new Date(`${String(promo.availed_at || "").slice(0, 10)}T00:00:00`);
      const end = new Date(`${String(promo.expiration_date || "").slice(0, 10)}T00:00:00`);
      for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        const promos = promosByDate.get(key) || [];
        promos.push(promo);
        promosByDate.set(key, promos);
      }
    });
    const paidSessionsByDate = new Map();
    paidSessionPayments.forEach((payment) => {
      const key = String(payment.start_time || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      const sessions = paidSessionsByDate.get(key) || [];
      sessions.push(payment);
      paidSessionsByDate.set(key, sessions);
    });
    return {
      year,
      month,
      firstDay: new Date(year, month, 1).getDay(),
      daysInMonth: new Date(year, month + 1, 0).getDate(),
      recordsByDate,
      promosByDate,
      paidSessionsByDate,
    };
  }, [calendarMonth, paidRecords, promoAvailments, paidSessionPayments]);

  const changeMonth = (offset) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const stats = [
    { label: "Records", value: attendanceCount, icon: CheckCircle, color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
    { label: "Total Expenses", value: `₱${totalAmount.toFixed(2)}`, icon: PhilippinePeso, color: "text-amber-400", bgColor: "bg-amber-500/10" },
    { label: "Sessions", value: totalSessions, icon: CalendarCheck, color: "text-classic-gold", bgColor: "bg-classic-gold/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Attendance History</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Track your check-ins and attendance records, {user?.fullName?.split(" ")[0] || "Member"}.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-black/40 backdrop-blur-md rounded-xl border border-classic-gold/10 p-4 hover:border-classic-gold/30 transition-all">
            <div className={`p-2 rounded-lg w-fit ${stat.bgColor}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-white mt-2">{stat.value}</p>
            <p className="text-zinc-400 text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-black/40 backdrop-blur-md border border-classic-gold/10 p-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-classic-gold" />
            <div>
              <h2 className="text-white font-semibold">Attendance Calendar</h2>
              <p className="text-zinc-400 text-sm">Check-ins and sessions you attended</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => changeMonth(-1)} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10" aria-label="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-zinc-200 text-sm min-w-[110px] text-center">
              {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button type="button" onClick={() => changeMonth(1)} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10" aria-label="Next month">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="py-12 text-center text-zinc-400">Loading attendance records...</p>
        ) : error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 text-red-200">{error}</p>
        ) : (
          <div className="grid grid-cols-7 border-l border-t border-white/10">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="p-2 text-center text-[10px] uppercase text-zinc-500 border-r border-b border-white/10">{day}</div>
            ))}
            {Array.from({ length: calendarData.firstDay }).map((_, index) => (
              <div key={`empty-${index}`} className="min-h-[82px] border-r border-b border-white/10 bg-black/10" />
            ))}
            {Array.from({ length: calendarData.daysInMonth }).map((_, index) => {
              const day = index + 1;
              const dateKey = `${calendarData.year}-${String(calendarData.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const records = calendarData.recordsByDate.get(dateKey) || [];
              const promos = calendarData.promosByDate.get(dateKey) || [];
              const paidSessions = (calendarData.paidSessionsByDate.get(dateKey) || []).filter((payment) =>
                !records.some((record) =>
                  String(record.sessions || "").toLowerCase().includes(String(payment.session_type || "").toLowerCase()),
                ),
              );
              const hasActivity = records.length > 0 || promos.length > 0 || paidSessions.length > 0;
              return (
                <div key={dateKey} title={hasActivity ? [...records.map((record) => record.sessions || "Gym attendance"), ...paidSessions.map((payment) => `${payment.session_type} (paid session)`), ...promos.map((promo) => `${promo.promo_name} (valid until ${promo.expiration_date})`)].join(", ") : "No check-ins"} className={`min-h-[82px] p-2 border-r border-b border-white/10 transition-all ${records.length || paidSessions.length ? "bg-emerald-500/10 cursor-pointer hover:bg-emerald-400/25" : promos.length ? "bg-[#8f6b31]/15 cursor-pointer hover:bg-[#8f6b31]/25" : "bg-black/10 hover:bg-white/[0.04]"}`}>
                  <p className={records.length || paidSessions.length ? "text-emerald-300 font-semibold" : promos.length ? "text-[#d9a75b] font-semibold" : "text-zinc-500"}>{day}</p>
                  {records.map((record, recordIndex) => (
                    <p key={recordIndex} className="mt-1 text-[10px] leading-tight text-classic-gold truncate">{record.sessions || "Gym attendance"}</p>
                  ))}
                  {paidSessions.map((payment) => (
                    <p key={`paid-session-${payment.payment_id}`} className="mt-1 text-[10px] leading-tight text-emerald-300 truncate" title={`${payment.session_type} paid`}>
                      {payment.session_type} · Paid
                    </p>
                  ))}
                  {promos.map((promo) => (
                    <p key={`promo-${promo.id}`} className="mt-1 rounded bg-[#8f6b31]/30 px-1 py-0.5 text-[10px] leading-tight text-[#f1c875] truncate" title={`${promo.promo_name} valid until ${promo.expiration_date}`}>
                      {promo.promo_name}
                    </p>
                  ))}
                  {records.length > 0 && <p className="mt-1 text-[9px] text-emerald-400">{records.length} check-in{records.length === 1 ? "" : "s"}</p>}
                  {paidSessions.length > 0 && <p className="mt-1 text-[9px] text-emerald-400">Paid session</p>}
                  {promos.length > 0 && <p className="mt-1 text-[9px] text-[#d9a75b]">Promo availed</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberAttendance;
