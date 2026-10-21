import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LogoutModal from "../../components/LogoutModal";
import {
  Menu,
  LayoutDashboard,
  LogOut,
  Users,
  Calendar,
  Dumbbell,
  Clock,
  TrendingUp,
  Award,
  CheckCircle,
  X,
  UserCheck,
  UserX,
  Star,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  History,
  BadgeCheck,
  CircleX,
  UserRoundPen,
  Mail,
  Phone,
  BriefcaseBusiness,
} from "lucide-react";
import bgImage from "../../assets/Capra bg.jpg";
import logo from "../../assets/logo.png";
import TrainerSession from "./Session";
import TrainerHistory from "./History";
import TrainerMyProfile from "./MyProfile";
import NotificationBell from "../../components/NotificationBell";

const API_URL = import.meta.env.VITE_API_URL || "/api";

function normalizeSessionStatus(session, now = Date.now()) {
  const rawStatus = String(session?.status || "").trim().toLowerCase();
  if (["rejected", "terminated", "finished"].includes(rawStatus)) {
    return rawStatus;
  }

  const start = new Date(session?.start_time ?? 0);
  const end = new Date(session?.end_time ?? 0);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return rawStatus || "approved";
  }

  if (now >= end.getTime()) return "finished";
  if (now >= start.getTime()) return "ongoing";
  return "approved";
}

function getSessionDisplayStatus(session, now = Date.now()) {
  return normalizeSessionStatus(session, now);
}

function TrainerDashboard() {
  const [showLogout, setShowLogout] = useState(false);
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [dashboardClock, setDashboardClock] = useState(Date.now());
  const [profileFocus, setProfileFocus] = useState("");
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    expertise_area: "",
    profile_photo: "",
  });

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const trainerId = user?.id;
  const [dashboardSessions, setDashboardSessions] = useState([]);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const firstName = String(user?.fullName || user?.full_name || "").trim().split(/\s+/)[0] || "Trainer";

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

  useEffect(() => {
    const loadTrainerProfile = async () => {
      const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token") || localStorage.getItem("authToken") || "";

      // Seed the form immediately from the login payload, then replace it with
      // the authoritative trainer record from SQL Server.
      setProfileForm({
        full_name: savedUser?.fullName || savedUser?.full_name || "",
        email: savedUser?.email || "",
        phone_number: savedUser?.phone_number || savedUser?.phone || "",
        expertise_area: savedUser?.expertise_area || savedUser?.specialization || "",
        profile_photo: savedUser?.profile_photo || "",
      });

      if (!trainerId || !token) return;

      try {
        const response = await fetch(
          `${API_URL}/trainer_api.php?action=get_trainer_profile`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();

        if (!response.ok || !data.success || !data.profile) return;

        const profile = data.profile;
        const updatedUser = {
          ...savedUser,
          id: Number(profile.trainerID),
          fullName: profile.full_name || "",
          full_name: profile.full_name || "",
          email: profile.email || "",
          phone_number: profile.phone_number || "",
          expertise_area: profile.expertise_area || "",
          profile_photo: profile.profile_photo || "",
        };

        localStorage.setItem("user", JSON.stringify(updatedUser));
        setProfileForm({
          full_name: profile.full_name || "",
          email: profile.email || "",
          phone_number: profile.phone_number || "",
          expertise_area: profile.expertise_area || "",
          profile_photo: profile.profile_photo || "",
        });
      } catch (error) {
        console.error("Error loading trainer profile:", error);
      }
    };

    loadTrainerProfile();
  }, [trainerId, setProfileForm]);

  useEffect(() => {
    if (!trainerId) return;
    const fetchDashboardSessions = async () => {
      try {
        const token = localStorage.getItem("auth_token") || localStorage.getItem("token") || localStorage.getItem("authToken") || "";
        const response = await fetch(
          `${API_URL}/trainer_api.php?action=get_trainer_sessions&trainer_id=${encodeURIComponent(trainerId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();
        if (data.success) setDashboardSessions(data.sessions || []);
      } catch (error) {
        console.error("Error fetching trainer dashboard sessions:", error);
      }
    };
    fetchDashboardSessions();
    const interval = setInterval(fetchDashboardSessions, 30000);
    return () => clearInterval(interval);
  }, [trainerId]);

  useEffect(() => {
    const timer = window.setInterval(() => setDashboardClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogoutClick = () => setShowLogout(true);
  const handleConfirmLogout = () => {
    setShowLogout(false);
    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    navigate("/login");
  };

  const menuItems = [
    { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
    { id: "my-profile", name: "My Profile", icon: Users },
    { id: "sessions", name: "Sessions", icon: Clock },
    { id: "history", name: "History", icon: History },
  ];

  const totalBookedClients = dashboardSessions.reduce(
    (sum, session) => sum + Number(session.booking_count || 0),
    0,
  );
  const activeClients = Math.max(0, totalBookedClients);
  const inactiveClients = Math.max(0, totalBookedClients > 0 ? totalBookedClients - activeClients : 0);
  const approvedSessions = dashboardSessions.filter((session) => {
    const status = normalizeSessionStatus(session, dashboardClock);
    return status === "approved" || status === "ongoing";
  });
  const finishedSessions = dashboardSessions.filter(
    (session) => normalizeSessionStatus(session, dashboardClock) === "finished",
  );
  const rejectedSessions = dashboardSessions.filter((session) => normalizeSessionStatus(session, dashboardClock) === "rejected");
  const terminatedSessions = dashboardSessions.filter((session) => normalizeSessionStatus(session, dashboardClock) === "terminated");
  const upcomingSessionCount = approvedSessions.filter(
    (session) => new Date(session.start_time) > new Date()
  ).length;
  const scheduledHours = approvedSessions.reduce((total, session) => {
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);
    const hours = (end - start) / 3600000;
    return total + (Number.isFinite(hours) && hours > 0 ? hours : 0);
  }, 0);

  const stats = [
    {
      label: "Finished Sessions",
      value: finishedSessions.length,
      icon: Calendar,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
    },
    {
      label: "Approved Sessions",
      value: approvedSessions.length,
      icon: CheckCircle,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
    },
    {
      label: "Upcoming Sessions",
      value: upcomingSessionCount,
      icon: Clock,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
    },
    {
      label: "Scheduled Hours",
      value: scheduledHours.toFixed(1),
      icon: TrendingUp,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
    },
  ];

  const upcomingClasses = dashboardSessions
    .filter((session) => String(session.status || "").toLowerCase() === "approved" && new Date(session.start_time) > new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 4);

  const approvedSessionsThisWeek = dashboardSessions.filter((session) => {
    if (String(session.status || "").toLowerCase() !== "approved") return false;
    const date = new Date(session.start_time);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return date >= weekStart && date < weekEnd;
  }).length;

  const upcomingCalendarData = (() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const sessionsByDate = new Map();

    dashboardSessions
      .filter((session) => {
        const start = new Date(session.start_time);
        const displayStatus = getSessionDisplayStatus(session, dashboardClock);
        const storedStatus = String(session.status || "").toLowerCase();
        return ["approved", "ongoing", "finished"].includes(storedStatus) && ["approved", "ongoing", "finished"].includes(displayStatus) && !Number.isNaN(start.getTime());
      })
      .forEach((session) => {
        const start = new Date(session.start_time);
        const dateKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
        const dateSessions = sessionsByDate.get(dateKey) || [];
        sessionsByDate.set(dateKey, [...dateSessions, session]);
      });

    return {
      year,
      month,
      firstDay: new Date(year, month, 1).getDay(),
      daysInMonth: new Date(year, month + 1, 0).getDate(),
      sessionsByDate,
    };
  })();

  const changeCalendarMonth = (offset) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const renderContent = () => {
    switch (activeMenu) {
      case "sessions":
        return <TrainerSession />;
      case "history":
        return <TrainerHistory dashboardSessions={dashboardSessions} />;
      case "my-profile":
        return (
          <TrainerMyProfile
            dashboardSessions={dashboardSessions}
            user={user}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            focusSection={profileFocus}
          />
        );
      default:
        return (
          <div className="space-y-6 animate-in fade-in duration-500">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight capitalize">
                  {activeMenu === "sessions"
                    ? "Trainer Sessions"
                    : "Trainer Dashboard"}
                </h1>
                <p className="text-zinc-400 text-sm mt-1">
                  Welcome back, Coach{" "}
                  {firstName}
                  ! Manage your classes and clients here.
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-zinc-500 text-xs uppercase tracking-wider">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className={`
                group relative overflow-hidden rounded-xl 
                bg-black/40 backdrop-blur-md border ${stat.borderColor}
                p-5 transition-all duration-300
                hover:bg-black/50 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20
              `}
                >
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <span className="text-zinc-600 text-xs font-mono">
                      #{String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="text-zinc-400 text-sm">{stat.label}</p>
                    <p className="text-white text-2xl font-bold mt-1 tracking-tight">
                      {stat.value}
                    </p>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              ))}
            </div>


            <div className="grid grid-cols-1 gap-6">
              <div className="min-h-[250px] rounded-xl bg-black/40 backdrop-blur-md border border-classic-gold/10 p-5">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-classic-gold" />
                    Sessions
                  </h3>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-200">
                        {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </p>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => changeCalendarMonth(-1)} aria-label="Previous month" className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white">
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setCalendarMonth(new Date())} className="rounded-lg px-2.5 py-1.5 text-[11px] text-classic-gold transition hover:bg-classic-gold/10">
                          Today
                        </button>
                        <button type="button" onClick={() => changeCalendarMonth(1)} aria-label="Next month" className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 border-l border-t border-white/10">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className="border-b border-r border-white/10 p-2 text-center text-[10px] uppercase text-zinc-500">{day}</div>
                      ))}
                      {Array.from({ length: upcomingCalendarData.firstDay }).map((_, index) => (
                        <div key={`empty-${index}`} className="min-h-[68px] border-b border-r border-white/10 bg-black/10" />
                      ))}
                      {Array.from({ length: upcomingCalendarData.daysInMonth }).map((_, index) => {
                        const day = index + 1;
                        const dateKey = `${upcomingCalendarData.year}-${String(upcomingCalendarData.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const daySessions = upcomingCalendarData.sessionsByDate.get(dateKey) || [];
                        const hasSessions = daySessions.length > 0;
                        return (
                          <div key={dateKey} className={`min-h-[68px] border-b border-r border-white/10 p-2 transition-colors duration-200 ${hasSessions ? "group relative cursor-help bg-emerald-500/10 hover:bg-emerald-400/20" : "bg-black/10 hover:bg-white/[0.04]"}`}>
                            <div>
                              <p className={hasSessions ? "font-semibold text-emerald-300" : "text-zinc-500"}>{day}</p>
                            {hasSessions && (
                              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-classic-gold/30 bg-[#111]/95 p-3 text-left shadow-xl group-hover:block">
                                <p className="mb-2 text-xs font-semibold text-white">Session details</p>
                                {daySessions.map((session) => (
                                  <div key={session.id} className="border-t border-white/10 py-1.5 first:border-t-0 first:pt-0">
                                    <p className="truncate text-xs text-classic-gold">{session.session_type || "Session"}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-400">
                                      <span className="inline-flex items-center gap-1">
                                        <Clock className="h-3 w-3 text-classic-gold" />
                                        {new Date(session.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                      </span>
                                      <span className="inline-flex items-center gap-1">
                                        <Users className="h-3 w-3 text-classic-gold" />
                                        {Number(session.booking_count || 0)} member{Number(session.booking_count || 0) === 1 ? "" : "s"}
                                      </span>
                                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${getSessionDisplayStatus(session, dashboardClock) === "ongoing" ? "bg-blue-500/15 text-blue-300" : getSessionDisplayStatus(session, dashboardClock) === "finished" ? "bg-zinc-500/15 text-zinc-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                                        {getSessionDisplayStatus(session, dashboardClock)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            </div>
                            {hasSessions && <div className="mt-2 flex flex-wrap gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" /><span className="text-[9px] text-emerald-300">{daySessions.length} session{daySessions.length === 1 ? "" : "s"}</span></div>}
                          </div>
                        );
                      })}
                    </div>
                    {upcomingClasses.length === 0 && (
                      <p className="mt-3 text-center text-xs text-zinc-500">No upcoming sessions. Existing sessions remain marked on the calendar.</p>
                    )}
                  </div>
              </div>

            </div>


            <div className="rounded-xl bg-black/40 backdrop-blur-md border border-classic-gold/10 p-6 relative overflow-hidden transition-all duration-300 hover:border-classic-gold/30 hover:bg-black/50 hover:shadow-lg hover:shadow-classic-gold/5">
              <div className="absolute top-0 right-0 w-64 h-64 bg-classic-gold/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-white text-lg font-semibold mb-2">
                  Transform lives, one session at a time!
                </h2>
                <p className="text-zinc-400 text-sm max-w-xl">
                  You currently have {stats[1].value} approved session{stats[1].value === 1 ? "" : "s"} in the system. Keep your schedule organized and your clients informed.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => setActiveMenu("sessions")}
                    className="px-4 py-2 bg-classic-gold/20 text-classic-gold text-sm font-medium rounded-lg border border-classic-gold/30 hover:bg-classic-gold/30 transition-all"
                  >
                    Manage Classes
                  </button>
                  <button
                    onClick={() => {
                      setProfileFocus("client-overview");
                      setActiveMenu("my-profile");
                    }}
                    className="px-4 py-2 text-zinc-400 text-sm font-medium rounded-lg border border-zinc-700 hover:text-white hover:border-zinc-500 transition-all"
                  >
                    View Clients
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}


        <aside
          className={`
            fixed lg:sticky lg:top-0 lg:h-screen
            top-0 left-0 h-full z-50
            flex flex-col
            bg-[#0a0a0a]/95 backdrop-blur-2xl
            border-r border-classic-gold/10
            transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
            ${isMobile ? (sidebarOpen ? "translate-x-0" : "-translate-x-full") : "translate-x-0"}
            w-[260px] flex-shrink-0
          `}
        >

          <div className="flex items-center justify-between px-5 py-4 border-b border-classic-gold/10">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-classic-gold/10 flex items-center justify-center">
                <img src={logo} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-classic-gold font-bold text-lg tracking-tight">
                Capra Fitness
              </span>
            </div>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-md text-zinc-400 hover:text-classic-gold hover:bg-classic-gold/10 transition-colors md:hidden"
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
                    setActiveMenu(item.id);
                    if (isMobile) setSidebarOpen(false);
                  }}
                  className={`
                    group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg
                    transition-all duration-200 relative
                    ${isActive ? "bg-classic-gold text-black shadow-lg shadow-classic-gold/20" : "text-zinc-400 hover:bg-classic-gold/10 hover:text-classic-gold"}
                  `}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-black/20 rounded-r-full" />
                  )}
                  <item.icon
                    className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-black" : "text-zinc-400"}`}
                    strokeWidth={2}
                  />
                  <span className="text-sm font-medium truncate">
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
                <NotificationBell userRole="trainer" recipientId={trainerId} />

                <div className="hidden md:block w-px h-8 bg-classic-gold/10" />


                <button
                  type="button"
                  onClick={() => setActiveMenu("my-profile")}
                  title="Open My Profile"
                  className="group flex items-center gap-3 pl-1 rounded-lg p-1 transition-colors hover:bg-classic-gold/10 focus:outline-none focus:ring-2 focus:ring-classic-gold/50"
                >
                  <div className="text-right hidden sm:block">
                    <p className="text-zinc-400 text-xs">Welcome back,</p>
                    <p className="text-classic-gold text-sm font-semibold truncate max-w-[120px]">
                      Coach {firstName}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-classic-gold/30 to-classic-gold/5 flex items-center justify-center ring-1 ring-classic-gold/20 group-hover:ring-classic-gold/60 overflow-hidden">
                    {user?.profile_photo ? (
                      <img src={user.profile_photo} alt="Trainer profile" className="w-full h-full object-cover" />
                    ) : (
                      <Dumbbell className="w-5 h-5 text-classic-gold" />
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
  );
}

export default TrainerDashboard;
