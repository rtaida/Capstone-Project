
import { useState, useEffect } from "react";
import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Filter,
  PhilippinePeso,
  Users,
} from "lucide-react";
import FeedbackModal from "../../components/memberModal/FeedbackModal";


const HeaderSkeleton = () => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <div className="h-8 bg-zinc-800 rounded animate-pulse w-48 mb-2"></div>
      <div className="h-4 bg-zinc-800 rounded animate-pulse w-72"></div>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 bg-zinc-800 rounded animate-pulse"></div>
      <div className="h-4 bg-zinc-800 rounded animate-pulse w-32"></div>
    </div>
  </div>
);

const FilterSkeleton = () => (
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 bg-zinc-800 rounded animate-pulse"></div>
      <div className="h-4 bg-zinc-800 rounded animate-pulse w-16"></div>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <div className="h-10 bg-zinc-800 rounded-full animate-pulse w-20"></div>
      <div className="h-10 bg-zinc-800 rounded-full animate-pulse w-20"></div>
    </div>
  </div>
);

const DateInputsSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
    <div className="rounded-2xl border border-classic-gold/10 bg-zinc-950/60 p-4">
      <div className="h-4 bg-zinc-800 rounded animate-pulse w-28 mb-2"></div>
      <div className="h-12 bg-zinc-800 rounded-2xl animate-pulse w-full"></div>
    </div>
    <div className="rounded-2xl border border-classic-gold/10 bg-zinc-950/60 p-4">
      <div className="h-4 bg-zinc-800 rounded animate-pulse w-24 mb-2"></div>
      <div className="h-12 bg-zinc-800 rounded-2xl animate-pulse w-full"></div>
    </div>
  </div>
);

const TableSkeleton = () => (
  <div className="overflow-x-auto rounded-3xl border border-classic-gold/10 bg-zinc-950/60 p-4">
    <table className="min-w-full text-left text-sm text-zinc-300">
      <thead>
        <tr className="border-b border-classic-gold/10">
          <th className="px-4 py-3">
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-16"></div>
          </th>
          <th className="px-4 py-3">
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-20"></div>
          </th>
          <th className="px-4 py-3">
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-20"></div>
          </th>
          <th className="px-4 py-3">
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-20"></div>
          </th>
          <th className="px-4 py-3">
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-20"></div>
          </th>
        </tr>
      </thead>
      <tbody>
        {[...Array(5)].map((_, index) => (
          <tr key={index} className="border-b border-classic-gold/10">
            <td className="px-4 py-3">
              <div className="h-4 bg-zinc-800 rounded animate-pulse w-24"></div>
            </td>
            <td className="px-4 py-3">
              <div className="h-4 bg-zinc-800 rounded animate-pulse w-32"></div>
            </td>
            <td className="px-4 py-3">
              <div className="h-4 bg-zinc-800 rounded animate-pulse w-20"></div>
            </td>
            <td className="px-4 py-3">
              <div className="h-4 bg-zinc-800 rounded animate-pulse w-16"></div>
            </td>
            <td className="px-4 py-3">
              <div className="h-4 bg-zinc-800 rounded animate-pulse w-24"></div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SummarySkeleton = () => (
  <div className="space-y-4 rounded-3xl bg-black/40 border border-classic-gold/10 p-6">
    <div className="rounded-3xl bg-zinc-950/70 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-5 h-5 bg-zinc-800 rounded animate-pulse"></div>
        <div className="h-6 bg-zinc-800 rounded animate-pulse w-40"></div>
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-2xl bg-zinc-900/70 p-4"
          >
            <div>
              <div className="h-3 bg-zinc-800 rounded animate-pulse w-20 mb-2"></div>
              <div className="h-8 bg-zinc-800 rounded animate-pulse w-24"></div>
            </div>
            <div className="w-6 h-6 bg-zinc-800 rounded animate-pulse"></div>
          </div>
        ))}
        <div className="rounded-2xl bg-zinc-900/70 p-4 border border-classic-gold/10">
          <div className="h-3 bg-zinc-800 rounded animate-pulse w-24 mb-3"></div>
          <div className="space-y-3">
            {[...Array(4)].map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-2xl bg-black/40 p-3"
              >
                <div className="h-4 bg-zinc-800 rounded animate-pulse w-24"></div>
                <div className="h-4 bg-zinc-800 rounded animate-pulse w-8"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);


const MainContainerSkeleton = () => (
  <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
    
    <div className="rounded-3xl bg-black/40 border border-classic-gold/10 p-6">
      <FilterSkeleton />
      <DateInputsSkeleton />
      <TableSkeleton />
    </div>

    
    <SummarySkeleton />
  </div>
);

function AdminStaffAttendance() {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [filterType, setFilterType] = useState("date");
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({
    isOpen: false,
    type: "error",
    title: "Attendance Error",
    message: "",
  });

  const showFeedback = (type, message, title) => {
    setFeedback({
      isOpen: true,
      type,
      title: title || (type === "success" ? "Success" : "Error"),
      message,
    });
  };

  const closeFeedback = () => {
    setFeedback((prev) => ({ ...prev, isOpen: false }));
  };

  const API_BASE = import.meta.env.VITE_API_URL || "/api";

  const fetchAttendance = async () => {
    setLoading(true);
    setError("");

    const queryKey = filterType === "date" ? "date" : "month";
    const queryValue = filterType === "date" ? selectedDate : selectedMonth;
    const query = queryValue
      ? `&${queryKey}=${encodeURIComponent(queryValue)}`
      : "";

    try {
      const response = await fetch(
        `${API_BASE}/member_api.php?action=get_attendance${query}`,
      );
      const data = await response.json();
      if (data.success) {
        setAttendanceRecords(data.records || []);
      } else {
        const message = data.message || "Unable to load attendance records.";
        setError(message);
        showFeedback("error", message, "Attendance Error");
      }
    } catch (error) {
      console.error(error);
      const message = "Network error while fetching attendance records.";
      setError(message);
      showFeedback("error", message, "Attendance Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [filterType, selectedMonth, selectedDate]);

  
  
  

  
  const getFilteredRecords = () => {
    if (filterType === "date") {
      
      return attendanceRecords.filter((record) => {
        if (!record.attendance_date) return false;
        const recordDate = record.attendance_date.slice(0, 10);
        return recordDate === selectedDate;
      });
    } else {
      
      return attendanceRecords.filter((record) => {
        if (!record.attendance_date) return false;
        const recordMonth = record.attendance_date.slice(0, 7);
        return recordMonth === selectedMonth;
      });
    }
  };

  const filteredRecords = getFilteredRecords();

  
  const totalRevenue = filteredRecords.reduce(
    (sum, record) => sum + Number(record.total_amount || 0),
    0,
  );

  
  const totalSessions = filteredRecords.reduce((sum, record) => {
    if (record.sessions) {
      
      if (record.sessions.includes(",")) {
        return sum + record.sessions.split(",").length;
      }
      return sum + 1;
    }
    return (
      sum + (record.session_count ? parseInt(record.session_count, 10) : 1)
    );
  }, 0);

  
  const attendanceByDate = filteredRecords.reduce((acc, record) => {
    const dateKey = record.attendance_date
      ? record.attendance_date.slice(0, 10)
      : "";
    if (!dateKey) return acc;
    acc[dateKey] = (acc[dateKey] || 0) + 1;
    return acc;
  }, {});

  const dateGroups = Object.entries(attendanceByDate).sort((a, b) => {
    
    return a[0] < b[0] ? 1 : -1;
  });

  
  const selectedDateCheckins =
    filterType === "date" ? filteredRecords.length : 0;

  
  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <HeaderSkeleton />
        <MainContainerSkeleton />
      </div>
    );
  }

  
  if (error) {
    return (
      <>
        <FeedbackModal
          isOpen={feedback.isOpen}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          onClose={closeFeedback}
        />
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Attendance Records
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                View recorded member attendance and payments with filter by day
                or month.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <Calendar className="w-5 h-5 text-classic-gold" />
              Filter history and review totals.
            </div>
          </div>
          <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-6 text-red-200">
            {error}
          </div>
        </div>
      </>
    );
  }

  
  return (
    <>
      <FeedbackModal
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={closeFeedback}
      />
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Attendance Records
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              View recorded member attendance and payments with filter by day or
              month.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Calendar className="w-5 h-5 text-classic-gold" />
            {filterType === "month"
              ? `Showing ${new Date(selectedMonth).toLocaleString("default", { month: "long", year: "numeric" })}`
              : `Showing ${new Date(selectedDate).toLocaleDateString()}`}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="rounded-3xl bg-black/40 border border-classic-gold/10 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="flex items-center gap-2 text-zinc-300">
                <Filter className="w-4 h-4 text-classic-gold" />
                <span className="text-sm">Filter by</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setFilterType("month")}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    filterType === "month"
                      ? "bg-classic-gold text-black"
                      : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setFilterType("date")}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    filterType === "date"
                      ? "bg-classic-gold text-black"
                      : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  Date
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl border border-classic-gold/10 bg-zinc-950/60 p-4">
                <label className="text-zinc-400 text-sm">Selected month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black/60 px-4 py-3 text-white outline-none focus:border-classic-gold/50 transition-all"
                />
              </div>
              <div className="rounded-2xl border border-classic-gold/10 bg-zinc-950/60 p-4">
                <label className="text-zinc-400 text-sm">Selected date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black/60 px-4 py-3 text-white outline-none focus:border-classic-gold/50 transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-classic-gold/10 bg-zinc-950/60 p-4">
              <table className="min-w-full text-left text-sm text-zinc-300">
                <thead>
                  <tr className="border-b border-classic-gold/10 text-zinc-400">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Sessions</th>
                    <th className="px-4 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-4 py-6 text-center text-zinc-500"
                      >
                        No attendance records found for this{" "}
                        {filterType === "month" ? "month" : "date"}.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record, index) => (
                      <tr
                        key={index}
                        className="border-b border-classic-gold/10 hover:bg-white/5 transition"
                      >
                        <td className="px-4 py-3 text-white">
                          {record.attendance_date
                            ? new Date(
                                record.attendance_date,
                              ).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3">
                          {record.member_full_name ||
                            record.member_name ||
                            "Unknown"}
                        </td>
                        <td className="px-4 py-3">
                          {record.payment_method || "N/A"}
                        </td>
                        <td className="px-4 py-3">
                          {record.sessions || "Regular Session"}
                        </td>
                        <td className="px-4 py-3 text-classic-gold font-medium">
                          ₱{Number(record.total_amount || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl bg-black/40 border border-classic-gold/10 p-6">
            <div className="rounded-3xl bg-zinc-950/70 p-5">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-5 h-5 text-classic-gold" />
                <h2 className="text-white text-lg font-semibold">
                  Attendance Summary
                </h2>
                <span className="text-xs text-zinc-500 ml-auto">
                  {filterType === "month"
                    ? new Date(selectedMonth).toLocaleString("default", {
                        month: "short",
                        year: "numeric",
                      })
                    : new Date(selectedDate).toLocaleDateString()}
                </span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-zinc-900/70 p-4">
                  <div>
                    <p className="text-zinc-400 text-sm">Records</p>
                    <p className="text-white text-2xl font-semibold">
                      {filteredRecords.length}
                    </p>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-900/70 p-4">
                  <div>
                    <p className="text-zinc-400 text-sm">Total Revenue</p>
                    <p className="text-white text-2xl font-semibold">
                      ₱{totalRevenue.toFixed(2)}
                    </p>
                  </div>
                  <PhilippinePeso className="w-6 h-6 text-amber-400" />
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-900/70 p-4">
                  <div>
                    <p className="text-zinc-400 text-sm">Sessions Recorded</p>
                    <p className="text-white text-2xl font-semibold">
                      {totalSessions}
                    </p>
                  </div>
                  <Calendar className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-zinc-900/70 p-4 border border-classic-gold/10">
                  <div>
                    <p className="text-zinc-400 text-sm">Check-ins</p>
                    {filterType === "date" ? (
                      <p className="text-white text-2xl font-semibold mt-2">
                        {selectedDateCheckins}
                      </p>
                    ) : dateGroups.length === 0 ? (
                      <p className="text-zinc-500 mt-2">
                        No check-ins found for this month.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                      {dateGroups.slice(0, 6).map(([date, count]) => (
                        <div
                          key={date}
                          className="flex items-center justify-between rounded-2xl bg-black/40 p-3"
                        >
                          <span className="text-white">
                            {new Date(date).toLocaleDateString()}
                          </span>
                          <span className="text-classic-gold font-semibold">
                            {count} check-in{count === 1 ? "" : "s"}
                          </span>
                        </div>
                      ))}
                      {dateGroups.length > 6 && (
                        <div className="text-zinc-400 text-sm">
                          +{dateGroups.length - 6} more day
                          {dateGroups.length - 6 === 1 ? "" : "s"} with
                          check-ins
                        </div>
                      )}
                      </div>
                    )}
                  </div>
                  <CalendarCheck className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default AdminStaffAttendance;
