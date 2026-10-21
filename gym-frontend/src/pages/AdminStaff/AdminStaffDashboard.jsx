import FeedbackModal from "../../components/memberModal/FeedbackModal";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import LogoutModal from "../../components/LogoutModal";
import {
  Menu,
  LayoutDashboard,
  Users,
  Bell,
  LogOut,
  TrendingUp,
  AlertCircle,
  PhilippinePeso,
  QrCode,
  Calendar,
  CheckCheck,
  Trash2,
  X,
  Download,
  FileText,
  BarChart3,
  Star,
  UserCheck,
  DollarSign,
  ChevronDown,
  RefreshCw,
  Activity,
  Award,
  Trophy,
  Clock,
  Filter,
  Shield,
  CalendarCheck,
  BookOpen,
  CheckCircle,
  XCircle,
  CreditCard,
  Dumbbell,
} from "lucide-react";
import bgImage from "../../assets/Capra bg.jpg";
import logo from "../../assets/logo.png";
import AdminStaffAttendance from "./AdminStaffAttendance";
import Member from "./Member";
import AdminSession from "./AdminSession";
import AdminTrainer from "./AdminTrainer";
import AdminPayments from "./AdminPayments";
import AdminBilling from "./AdminBilling";
import AdminReports from "./AdminReports";
import AdminAuditTrail from "./AdminAuditTrail";
import NotificationBell from "../../components/NotificationBell";
import ConfirmActionModal from "../../components/ConfirmActionModal";
import { useNotifications } from "../../hooks/useNotifications";
import { clearAuthToken, getAuthHeaders, readStoredAuthToken } from "../../services/api";
import { supabase } from "../../lib/supabase";



import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function AdminStaffDashboard() {
  const [showLogout, setShowLogout] = useState(false);
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [members, setMembers] = useState([]);
  const [adminStaff, setAdminStaff] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [revenueBreakdown, setRevenueBreakdown] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [viewMode, setViewMode] = useState("month");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
  });
  const showFeedback = (type, message, title) =>
    setFeedback({ isOpen: true, type, message, title });
  const closeFeedback = () =>
    setFeedback((prev) => ({ ...prev, isOpen: false }));
  const [refreshing, setRefreshing] = useState(false);
  const [showClearNotificationsConfirm, setShowClearNotificationsConfirm] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [profileUser, setProfileUser] = useState(user);
  const userRole = user.role || "admin";
  const currentAdminProfile = adminStaff.find(
    (admin) =>
      (Number(admin.id) === Number(profileUser?.id) && Number(profileUser?.id) > 0) ||
      String(admin.email || "").toLowerCase() === String(profileUser?.email || "").toLowerCase(),
  );

  useEffect(() => {
    const syncProfileUser = (event) => {
      const nextUser = event.detail || JSON.parse(localStorage.getItem("user") || "{}");
      setProfileUser(nextUser);
    };
    window.addEventListener("admin-profile-updated", syncProfileUser);
    return () => window.removeEventListener("admin-profile-updated", syncProfileUser);
  }, []);

  const {
    unreadCount,
    addNotification,
    notifications,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
  } = useNotifications("admin");

  const API_URL = import.meta.env.VITE_API_URL || "/api";


  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);




  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const token = readStoredAuthToken();
      if (!token) {
        clearAuthToken();
        navigate("/login");
        return;
      }

      const authHeaders = getAuthHeaders();
      const [memberRes, adminStaffRes, sessionRes, attendanceRes] =
        await Promise.all([
          fetch(`${API_URL}/member_api.php?action=get`, { headers: authHeaders }),
          fetch(`${API_URL}/admin_trainer_api.php?action=get_all`, { headers: authHeaders }),
          fetch(`${API_URL}/trainer_api.php?action=get_all_sessions`, { headers: authHeaders }),
          fetch(`${API_URL}/member_api.php?action=get_attendance`, { headers: authHeaders }),
        ]);

      if ([memberRes, adminStaffRes, sessionRes, attendanceRes].some((response) => response.status === 401)) {
        clearAuthToken();
        navigate("/login");
        return;
      }

      const memberData = await memberRes.json();
      const adminStaffData = await adminStaffRes.json();
      const sessionData = await sessionRes.json();
      const attendanceData = await attendanceRes.json();

      if (memberData.success) setMembers(memberData.members || []);
      if (adminStaffData.success) {
        setAdminStaff(adminStaffData.admins || []);
        setTrainers(adminStaffData.trainers || []);
      }
      if (sessionData.success) setSessions(sessionData.sessions || []);
      if (attendanceData.success) {
        setAttendanceRecords(attendanceData.records || []);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      addNotification("Error", "Failed to load dashboard data", "error");
      showFeedback(
        "error",
        "Failed to load dashboard data.",
        "Dashboard Error",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_URL, navigate, addNotification]);




  const fetchRevenueData = useCallback(async () => {
    try {
      const token = readStoredAuthToken();
      if (!token) {
        clearAuthToken();
        navigate("/login");
        return;
      }

      const response = await fetch(
        `${API_URL}/member_api.php?action=get_revenue&month=${selectedMonth + 1}&year=${selectedYear}`,
        {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to load revenue data");
      }

      setRevenueData(data.revenue || []);
      setRevenueBreakdown(data.breakdown || []);
    } catch (error) {
      console.error("Error fetching revenue:", error);
      setRevenueData([]);
      setRevenueBreakdown([]);
    }
  }, [API_URL, selectedMonth, selectedYear]);




  useEffect(() => {
    fetchAllData();
  }, []);

  // Keep the 7-day billing rule automatic while the admin system is running.
  // The backend also runs this check whenever Payments or Billing is opened.
  useEffect(() => {
    const runBillingCheck = async () => {
      const token = readStoredAuthToken();

      if (!token) {
        clearAuthToken();
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/billing_api.php?action=process_overdue&days=7`,
          {
            method: "GET",
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response.status === 401) {
          clearAuthToken();
          navigate("/login");
          return;
        }
      } catch (error) {
        console.error("Automatic billing check failed:", error);
      }
    };

    runBillingCheck();
    const interval = window.setInterval(runBillingCheck, 60 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [API_URL]);

  useEffect(() => {
    fetchRevenueData();
  }, [fetchRevenueData]);




  const stats = {
    totalMembers: members.length,
    totalAdminStaff: adminStaff.length,
    activeMembers: members.filter((m) => m.status === "active").length,
    inactiveMembers: members.filter((m) => m.status === "inactive").length,
    pendingMembers: members.filter(
      (m) => m.approval_status === "pending_approval",
    ).length,
    totalTrainers: trainers.length,
    totalSessions: sessions.length,
    approvedSessions: sessions.filter((s) => s.status === "approved").length,
    pendingSessions: sessions.filter((s) => s.status === "pending").length,
    rejectedSessions: sessions.filter((s) => s.status === "rejected").length,
    bookedSessions: sessions.filter((s) => s.is_booked === true).length,
    availableSessions: sessions.filter(
      (s) => s.is_booked !== true && s.status === "approved",
    ).length,
  };

  const memberLeaderboard = useMemo(() => {
    const checkInCounts = attendanceRecords.reduce((counts, record) => {
      const memberId = Number(record.member_id);
      if (memberId > 0) counts[memberId] = (counts[memberId] || 0) + 1;
      return counts;
    }, {});

    return members
      .map((member) => ({
        ...member,
        checkInTotal: checkInCounts[Number(member.memberID)] || 0,
      }))
      .filter((member) => member.checkInTotal > 0)
      .sort((first, second) =>
        second.checkInTotal - first.checkInTotal ||
        String(first.full_name || "").localeCompare(String(second.full_name || "")),
      );
  }, [members, attendanceRecords]);

  const ratedSessions = sessions.filter((s) => s.rating && s.rating > 0);
  const avgRating =
    ratedSessions.length > 0
      ? ratedSessions.reduce((sum, s) => sum + parseFloat(s.rating), 0) /
      ratedSessions.length
      : 0;




  const totalMonthlyRevenue = revenueData.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0,
  );

  const getRevenueByType = (type) =>
    revenueBreakdown
      .filter((row) => row.payment_type === type)
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const monthlySessionRevenue = getRevenueByType("TRAINER_SESSION");
  const monthlyRegularRevenue = getRevenueByType("REGULAR_SESSION");

  const monthlySessionCount = revenueBreakdown
    .filter((row) => row.payment_type === "TRAINER_SESSION")
    .reduce((sum, row) => sum + Number(row.transactions || 0), 0);

  const monthlyAttendanceCount = attendanceRecords.filter((r) => {
    if (!r.attendance_date || r.payment_status !== "paid") return false;
    const date = new Date(r.attendance_date);
    return (
      date.getMonth() === selectedMonth && date.getFullYear() === selectedYear
    );
  }).length;

  const today = new Date();
  const todayAttendanceCount = attendanceRecords.filter((r) => {
    if (!r.attendance_date || r.payment_status !== "paid") return false;
    const date = new Date(r.attendance_date);
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }).length;

  const monthlyRevenue = revenueData.reduce(
    (sum, r) => sum + (r.amount || 0),
    0,
  );





  const getWeeklyRevenueData = () => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const weekCount = Math.ceil((firstDay.getDay() + daysInMonth) / 7);
    const weeks = Array.from({ length: weekCount }, (_, index) => ({
      name: `Week ${index + 1}`,
      value: 0,
    }));

    revenueData.forEach((row) => {
      const day = Number(row.date);
      if (day < 1 || day > daysInMonth) return;
      const weekIndex = Math.floor((firstDay.getDay() + day - 1) / 7);
      weeks[weekIndex].value += Number(row.amount || 0);
    });

    return weeks;
  };

  const getMonthlyRevenueData = () => {
    return revenueData;
  };

  const weeklyRevenueData = getWeeklyRevenueData();
  const monthlyRevenueData = getMonthlyRevenueData();
  const availableWeeks = weeklyRevenueData.map((_, index) => index + 1);
  const selectedWeeklyRevenueData =
    selectedWeek > 0
      ? weeklyRevenueData.filter(
          (_, index) => index + 1 === selectedWeek,
        )
      : weeklyRevenueData;




  const handleLogoutClick = () => setShowLogout(true);
  const handleConfirmLogout = async () => {
    setShowLogout(false);
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Supabase sign-out failed:", error);
        showFeedback("error", "Could not end the secure login session. Please try again.", "Logout Error");
        return;
      }
    }
    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    navigate("/login");
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchAllData();
    await fetchRevenueData();
    addNotification(
      "Refreshed",
      "Dashboard data updated successfully!",
      "success",
    );
    showFeedback(
      "success",
      "Dashboard data updated successfully!",
      "Dashboard Refreshed",
    );
  };

  const handleNotificationClick = async (id) => await markAsRead(id);
  const handleMarkAllAsRead = async () => await markAllAsRead();
  const handleClearAll = () => {
    setShowClearNotificationsConfirm(true);
  };
  const confirmClearAll = async () => {
    await clearAllNotifications();
    setShowClearNotificationsConfirm(false);
  };

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const changeMonth = (delta) => {
    let newMonth = selectedMonth + delta;
    let newYear = selectedYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    setSelectedWeek(0);
    setViewMode("month");
  };

  const changeWeek = (delta) => {
    const currentIndex = selectedWeek === 0 ? -1 : availableWeeks.indexOf(selectedWeek);
    const newIndex = currentIndex + delta;
    if (newIndex === -1) {
      setSelectedWeek(0);
    } else if (newIndex >= 0 && newIndex < availableWeeks.length) {
      setSelectedWeek(availableWeeks[newIndex]);
    }
  };

  const menuItems = [
    { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
    { id: "members", name: "Members", icon: Users },
    { id: "admin-trainer", name: "Admin & Trainer", icon: Shield },
    { id: "scanner", name: "QR Scanner", icon: QrCode },
    { id: "payments", name: "Payments", icon: CreditCard },
    { id: "billing", name: "Billing", icon: FileText },
    { id: "attendance", name: "Attendance", icon: Calendar },
    { id: "session", name: "Session", icon: CalendarCheck },
    { id: "reports", name: "Reports", icon: BarChart3 },
    { id: "audit-trail", name: "Audit Trail", icon: Activity },
  ];

  const renderContent = () => {
    switch (activeMenu) {
      case "payments":
        return <AdminPayments addNotification={addNotification} />;
      case "billing":
        return <AdminBilling addNotification={addNotification} />;
      case "attendance":
        return <AdminStaffAttendance addNotification={addNotification} />;
      case "session":
        return <AdminSession addNotification={addNotification} />;
      case "reports":
        return <AdminReports addNotification={addNotification} showFeedback={showFeedback} />;
      case "audit-trail":
        return <AdminAuditTrail />;
      case "notifications":
        return renderNotifications();
      case "members":
        return <Member addNotification={addNotification} />;
      case "admin-trainer":
        return <AdminTrainer addNotification={addNotification} />;
      default:
        return renderDashboard();
    }
  };

  const renderNotifications = () => (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-zinc-400 text-sm mt-1">
            View and manage all your notifications
          </p>
        </div>
        {notifications?.length > 0 && (
          <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto sm:justify-end">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-classic-gold/10 text-classic-gold hover:bg-classic-gold/20 transition-all text-sm font-medium"
              >
                <CheckCheck className="w-4 h-4" /> Mark All Read
              </button>
            )}
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" /> Clear All
            </button>
          </div>
        )}
      </div>
      <div className="w-full rounded-xl bg-black/40 backdrop-blur-md border border-classic-gold/10 overflow-hidden">
        <div className="p-4 border-b border-classic-gold/10 bg-classic-gold/5 flex items-center justify-between gap-3">
          <span className="text-white font-semibold">All Notifications</span>
          <span className="text-xs text-classic-gold">
            {unreadCount} unread
          </span>
        </div>
        <div className="divide-y divide-classic-gold/10 max-h-[calc(100vh-300px)] overflow-y-auto">
          {!notifications?.length ? (
            <div className="p-12 text-center">
              <Bell className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n.id)}
                className={`p-4 cursor-pointer hover:bg-classic-gold/5 transition-all ${!n.read ? "bg-classic-gold/5" : "opacity-75"}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full mt-1.5 ${!n.read ? "bg-classic-gold animate-pulse" : "bg-zinc-600"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`break-words text-sm ${!n.read ? "text-white font-medium" : "text-zinc-400"}`}
                    >
                      {n.message}
                    </p>
                    <p className="text-zinc-500 text-xs mt-1">
                      {n.time || new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="text-xs text-classic-gold bg-classic-gold/10 px-2 py-1 rounded">
                      New
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );




  const renderDashboard = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-classic-gold border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-zinc-400 text-lg">Loading dashboard data...</p>
          <p className="text-zinc-500 text-sm mt-1">
            Fetching real-time data from database
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-in fade-in duration-500">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-zinc-400 text-sm mt-1 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Last updated: {new Date().toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-classic-gold/10 text-classic-gold hover:bg-classic-gold/20 transition-all text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>


        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="bg-black/40 backdrop-blur-md border border-classic-gold/10 rounded-xl p-4 text-center hover:border-classic-gold/30 transition-all">
            <Users className="w-5 h-5 text-classic-gold mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{stats.totalMembers}</p>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider">
              Members
            </p>
          </div>
          <div className="bg-black/40 backdrop-blur-md border border-blue-500/10 rounded-xl p-4 text-center hover:border-blue-500/30 transition-all">
            <Shield className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{stats.totalAdminStaff}</p>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider">
              Admin/Staff
            </p>
          </div>
          <div className="bg-black/40 backdrop-blur-md border border-amber-500/10 rounded-xl p-4 text-center hover:border-amber-500/30 transition-all">
            <PhilippinePeso className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">₱{totalMonthlyRevenue.toLocaleString()}</p>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider">
              Total Revenue
            </p>
          </div>
          <div className="bg-black/40 backdrop-blur-md border border-emerald-500/10 rounded-xl p-4 text-center hover:border-emerald-500/30 transition-all">
            <CalendarCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{todayAttendanceCount}</p>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider">
              Today's Check-ins
            </p>
          </div>
          <div className="bg-black/40 backdrop-blur-md border border-cyan-500/10 rounded-xl p-4 text-center hover:border-cyan-500/30 transition-all">
            <CalendarCheck className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{monthlyAttendanceCount}</p>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider">
              Monthly Check-ins
            </p>
          </div>
          <div className="bg-black/40 backdrop-blur-md border border-purple-500/10 rounded-xl p-4 text-center hover:border-purple-500/30 transition-all">
            <Dumbbell className="w-5 h-5 text-purple-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-white">{stats.totalTrainers}</p>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider">
              Trainers
            </p>
          </div>
        </div>




        <div className="bg-black/40 backdrop-blur-md border border-classic-gold/10 rounded-xl overflow-hidden">
          <div className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-classic-gold" />
              <span className="text-zinc-400 text-sm font-medium">
                Filter by:
              </span>
            </div>

            <div className="flex gap-1 bg-zinc-900/50 rounded-lg p-1">
              <button
                onClick={() => {
                  setViewMode("month");
                  setSelectedWeek(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === "month"
                    ? "bg-classic-gold text-black"
                    : "text-zinc-400 hover:text-white"
                  }`}
              >
                Month
              </button>
              <button
                onClick={() => {
                  setViewMode("week");
                  setSelectedWeek(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === "week"
                    ? "bg-classic-gold text-black"
                    : "text-zinc-400 hover:text-white"
                  }`}
              >
                Week
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1 rounded bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-400 transition-colors"
              >
                <ChevronDown className="w-4 h-4 transform rotate-90" />
              </button>
              <span className="text-zinc-300 text-sm font-medium min-w-[100px] text-center">
                {months[selectedMonth]} {selectedYear}
              </span>
              <button
                onClick={() => changeMonth(1)}
                className="p-1 rounded bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-400 transition-colors"
              >
                <ChevronDown className="w-4 h-4 transform -rotate-90" />
              </button>
            </div>

            {viewMode === "week" && availableWeeks.length > 0 && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-zinc-500 text-xs">Week:</span>
                <button
                  onClick={() => changeWeek(-1)}
                  disabled={selectedWeek === 0}
                  className="p-1 rounded bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-400 transition-colors disabled:opacity-40"
                >
                  <ChevronDown className="w-3 h-3 transform rotate-90" />
                </button>
                <span className="text-zinc-300 text-sm font-medium min-w-[60px] text-center">
                  {selectedWeek === 0 ? "All weeks" : `Week ${selectedWeek}`}
                </span>
                <button
                  onClick={() => changeWeek(1)}
                  disabled={
                    selectedWeek === availableWeeks.length
                  }
                  className="p-1 rounded bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-400 transition-colors disabled:opacity-40"
                >
                  <ChevronDown className="w-3 h-3 transform -rotate-90" />
                </button>
                <span className="text-zinc-500 text-[10px]">
                  ({selectedWeek === 0 ? "All" : `${selectedWeek}/`}
                  {availableWeeks.length})
                </span>
              </div>
            )}
          </div>
          </div>

          <div className="h-px bg-classic-gold/10 mx-4" />

          <div className="grid grid-cols-1 divide-classic-gold/10">
          <div className={`${viewMode === "week" ? "p-5" : "hidden"}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-classic-gold" />
                Weekly Revenue
              </h3>
              <span className="text-zinc-500 text-[10px]">
                {months[selectedMonth]} {selectedYear}
              </span>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={200}>
                <BarChart data={selectedWeeklyRevenueData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 2000]}
                    tickCount={6}
                    tickFormatter={(value) => {
                      if (value === 0) return "₱0";
                      if (value >= 2000)
                        return `₱${(value / 1000).toFixed(0)}K`;
                      if (value >= 1000) {
                        const formatted = (value / 1000).toFixed(
                          value % 1000 === 0 ? 0 : 1,
                        );
                        return `₱${formatted}K`;
                      }
                      return `₱${value}`;
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid rgba(212,175,55,0.3)",
                      borderRadius: "10px",
                      padding: "10px 14px",
                    }}
                    labelStyle={{ color: "#d4af37", fontWeight: "bold" }}
                    formatter={(value) => [
                      `₱ ${value.toLocaleString()}`,
                      "Revenue",
                    ]}
                  />
                  <Bar
                    dataKey="value"
                    fill="#d4af37"
                    radius={[6, 6, 0, 0]}
                    label={{
                      position: "top",
                      fill: "#a1a1aa",
                      fontSize: 10,
                      formatter: (value) => {
                        if (value === 0) return "";
                        if (value >= 2000)
                          return `₱${(value / 1000).toFixed(0)}K`;
                        if (value >= 1000) {
                          const formatted = (value / 1000).toFixed(
                            value % 1000 === 0 ? 0 : 1,
                          );
                          return `₱${formatted}K`;
                        }
                        return `₱${value}`;
                      },
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${viewMode === "month" ? "p-5" : "hidden"}`}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-classic-gold" />
                Monthly Revenue ({months[selectedMonth]} {selectedYear})
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-[10px] bg-classic-gold/10 px-2 py-0.5 rounded-full">
                  Total: ₱{monthlyRevenue.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={200}>
                <AreaChart data={monthlyRevenueData}>
                  <defs>
                    <linearGradient
                      id="monthlyGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#d4af37" stopOpacity={0.4} />
                      <stop
                        offset="100%"
                        stopColor="#d4af37"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `Day ${value}`}
                    interval={2}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 2000]}
                    tickCount={6}
                    tickFormatter={(value) => {
                      if (value === 0) return "₱0";
                      if (value >= 2000)
                        return `₱${(value / 1000).toFixed(0)}K`;
                      if (value >= 1000) {
                        const formatted = (value / 1000).toFixed(
                          value % 1000 === 0 ? 0 : 1,
                        );
                        return `₱${formatted}K`;
                      }
                      return `₱${value}`;
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid rgba(212,175,55,0.3)",
                      borderRadius: "10px",
                      padding: "10px 14px",
                    }}
                    labelStyle={{ color: "#d4af37", fontWeight: "bold" }}
                    formatter={(value) => [
                      `₱ ${value.toLocaleString()}`,
                      "Revenue",
                    ]}
                    labelFormatter={(label) => `Day ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#d4af37"
                    strokeWidth={3}
                    fill="url(#monthlyGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between items-center mt-2">
              <p className="text-zinc-500 text-[10px]">
                {revenueData.filter((r) => r.amount > 0).length} days with
                revenue
              </p>
              <p className="text-zinc-500 text-[10px]">
                {viewMode === "week"
                  ? selectedWeek === 0
                    ? "All weeks view"
                    : `Week ${selectedWeek} view`
                  : `${months[selectedMonth]} ${selectedYear}`}
              </p>
            </div>
          </div>
          </div>
        </div>


        <div className="rounded-xl border border-classic-gold/10 bg-black/40 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Trophy className="h-4 w-4 text-classic-gold" />
              Member Leaderboards
            </h3>
            <span className="text-xs text-zinc-500">Via Check-ins</span>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {memberLeaderboard.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
                No member rankings yet
              </div>
            ) : (
              memberLeaderboard.slice(0, 10).map((member, index) => (
                <div
                  key={member.memberID}
                  className="flex items-center gap-3 rounded-lg border border-classic-gold/5 bg-black/20 px-3 py-2 transition-colors hover:bg-classic-gold/5"
                >
                  <span className="w-6 text-center text-sm font-semibold text-classic-gold">
                    {index + 1}
                  </span>
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-classic-gold/10 ring-1 ring-classic-gold/20">
                    {member.profile_photo ? (
                      <img
                        src={member.profile_photo}
                        alt={`${member.full_name} profile`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-classic-gold">
                        {String(member.full_name || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                    {member.full_name}
                  </p>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {member.checkInTotal} check-in{member.checkInTotal === 1 ? "" : "s"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="max-h-[28rem] rounded-xl border border-classic-gold/10 bg-black/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-classic-gold" />
              Total Members
            </h3>
            <span className="text-zinc-500 text-xs">{members.length} members</span>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[#111]/95 backdrop-blur-sm">
                <tr className="border-b border-classic-gold/10">
                  <th className="text-left text-zinc-500 font-medium py-2 px-3 text-xs uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left text-zinc-500 font-medium py-2 px-3 text-xs uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left text-zinc-500 font-medium py-2 px-3 text-xs uppercase tracking-wider">
                    Join Date
                  </th>
                  <th className="text-left text-zinc-500 font-medium py-2 px-3 text-xs uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center text-zinc-500 py-8">
                      No members yet
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr
                      key={member.memberID}
                      className="border-b border-classic-gold/5 hover:bg-classic-gold/5 transition-all"
                    >
                      <td className="py-2 px-3 text-zinc-300">
                        {member.full_name}
                      </td>
                      <td className="py-2 px-3 text-zinc-400">
                        {member.email}
                      </td>
                      <td className="py-2 px-3 text-zinc-400">
                        {member.created_at
                          ? new Date(member.created_at).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${member.status === "active" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                        >
                          {member.status || "active"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };
  return (
    <>
      <FeedbackModal
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={closeFeedback}
      />
      <ConfirmActionModal
        isOpen={showClearNotificationsConfirm}
        title="Clear all notifications?"
        message="This will permanently remove every notification for this account."
        confirmLabel="Clear all"
        onConfirm={confirmClearAll}
        onClose={() => setShowClearNotificationsConfirm(false)}
      />
      <div className="relative min-h-screen overflow-hidden">
        <div
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: "brightness(0.10)",
          }}
        />

        <LogoutModal
          isOpen={showLogout}
          onClose={() => setShowLogout(false)}
          onConfirm={handleConfirmLogout}
        />

        <div className="relative z-10 flex h-screen">
          {isMobile && sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <aside
            className={`fixed lg:sticky lg:top-0 lg:h-screen top-0 left-0 h-full z-50 flex flex-col bg-[#0a0a0a]/95 backdrop-blur-2xl border-r border-classic-gold/10 transition-all duration-300 ${isMobile ? (sidebarOpen ? "translate-x-0" : "-translate-x-full") : "translate-x-0"} w-[260px] flex-shrink-0`}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-classic-gold/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-classic-gold/10 flex items-center justify-center rounded-lg">
                  <img
                    src={logo}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-classic-gold font-bold text-lg tracking-tight">
                  Capra Fitness
                </span>
              </div>
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-md text-zinc-400 hover:text-classic-gold hover:bg-classic-gold/10 transition-colors lg:hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              {menuItems.map((item) => {
                const isActive = activeMenu === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === "scanner") {
                        navigate("/scanner");
                        if (isMobile) setSidebarOpen(false);
                        return;
                      }
                      setActiveMenu(item.id);
                      if (isMobile) setSidebarOpen(false);
                    }}
                    className={`group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200 relative ${isActive ? "bg-classic-gold text-black shadow-lg shadow-classic-gold/20" : "text-zinc-400 hover:bg-classic-gold/10 hover:text-classic-gold"}`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-black/20 rounded-r-full" />
                    )}
                    <item.icon
                      className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-black" : ""}`}
                      strokeWidth={2}
                    />
                    <span className="text-sm font-medium truncate flex-1 text-left">
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-classic-gold/10 mt-auto">
              <button
                onClick={handleLogoutClick}
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-red-400/90 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 group"
              >
                <LogOut className="w-[18px] h-[18px] flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <header className="sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-classic-gold/10">
              <div className="flex items-center justify-between h-16 px-4 md:px-6">
                <div className="flex items-center gap-4">
                  {isMobile && (
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="p-2 rounded-lg text-zinc-400 hover:text-classic-gold hover:bg-classic-gold/10 transition-all"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 md:gap-3">
                  <NotificationBell userRole={userRole} />
                  <div className="hidden md:block w-px h-8 bg-classic-gold/10" />
                  <button
                    type="button"
                    onClick={() => setActiveMenu("admin-trainer")}
                    title="Open Admin & Trainer"
                    className="group flex items-center gap-3 pl-1 rounded-lg p-1 transition-colors hover:bg-classic-gold/10 focus:outline-none focus:ring-2 focus:ring-classic-gold/50"
                  >
                    <div className="text-right hidden sm:block">
                      <p className="text-zinc-400 text-xs">Welcome back,</p>
                      <p className="text-classic-gold text-sm font-semibold truncate max-w-[120px]">
                        {user?.fullName || user?.name || "Admin"}
                      </p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-classic-gold/30 to-classic-gold/5 flex items-center justify-center ring-1 ring-classic-gold/20 overflow-hidden group-hover:ring-classic-gold/60">
                      {currentAdminProfile?.profile_photo || profileUser?.profile_photo ? (
                        <img src={currentAdminProfile?.profile_photo || profileUser.profile_photo} alt="Admin profile" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-5 h-5 text-classic-gold" />
                      )}
                    </div>
                  </button>
                </div>
              </div>
            </header>

            <main className="dashboard-main flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-5 lg:p-8">
              {renderContent()}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}

export default AdminStaffDashboard;