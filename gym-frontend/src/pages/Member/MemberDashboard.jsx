import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LogoutModal from "../../components/LogoutModal";
import {
  Menu,
  LayoutDashboard,
  User,
  LogOut,
  Activity,
  Calendar,
  CalendarCheck,
  Weight,
  Ruler,
  Target,
  QrCode,
  X,
  PartyPopper,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Banknote,
  ShieldCheck,
} from "lucide-react";
import bgImage from "../../assets/Capra bg.jpg";
import logo from "../../assets/logo.png";
import MemberAttendance from "./MemberAttendance";
import MemberProfile from "./MemberProfile";
import MemberQRCode from "./MemberQRCode";
import AvailableSessions from "./AvailableSessions";
import NotificationBell from "../../components/NotificationBell";
import FeedbackModal from "../../components/memberModal/FeedbackModal";
import { getAuthHeaders } from "../../services/api";

function isPromoAvailable(promo, now = Date.now()) {
  const deadlineValue = String(promo?.availment_deadline || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineValue)) return false;

  const currentDate = new Date(now);
  const todayValue = [
    currentDate.getFullYear(),
    String(currentDate.getMonth() + 1).padStart(2, "0"),
    String(currentDate.getDate()).padStart(2, "0"),
  ].join("-");
  return todayValue <= deadlineValue;
}

function MemberDashboard() {
  const [showLogout, setShowLogout] = useState(false);
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const API_BASE = import.meta.env.VITE_API_URL || "/api";
  const API_URL = `${API_BASE}/member_api.php`;
  const BACKEND_ROOT = API_BASE.replace(/\/api$/i, "");
  const [isMobile, setIsMobile] = useState(false);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [memberData, setMemberData] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [bookedSessions, setBookedSessions] = useState([]);
  const [promos, setPromos] = useState([]);
  const [promoIndex, setPromoIndex] = useState(0);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoConfirmation, setPromoConfirmation] = useState(null);
  const [promoClock, setPromoClock] = useState(Date.now());
  const [promoFeedback, setPromoFeedback] = useState({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
  });
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const memberId = user?.id;

  
  const calculateBMI = (weight, height) => {
    if (!weight || !height || weight <= 0 || height <= 0) return null;
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    return bmi.toFixed(1);
  };

  const getBMICategory = (bmi) => {
    if (!bmi)
      return { label: "N/A", color: "text-zinc-400", bg: "bg-zinc-500/10" };
    if (bmi < 18.5)
      return {
        label: "Underweight",
        color: "text-blue-400",
        bg: "bg-blue-500/10",
      };
    if (bmi >= 18.5 && bmi < 25)
      return {
        label: "Normal",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
      };
    if (bmi >= 25 && bmi < 30)
      return {
        label: "Overweight",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
      };
    return { label: "Obese", color: "text-red-400", bg: "bg-red-500/10" };
  };

  const bmi = calculateBMI(memberData?.weight, memberData?.height);
  const bmiCategory = getBMICategory(bmi);
  const paidAttendance = attendanceRecords.filter(
    (record) => String(record.payment_status || "").toLowerCase() === "paid",
  );
  const availedSessions = [
    ...bookedSessions
      .filter((session) => ["pending", "paid"].includes(String(session.enrollment_status || "").toLowerCase()))
      .map((session) => ({
        key: `booking-${session.id}`,
        label: session.session_type || "Trainer Session",
        date: session.start_time,
        amount: Number(session.price || 0),
        isPaid: String(session.trainer_payment_status || "").toLowerCase() === "paid",
      })),
    ...paidAttendance.map((record, index) => ({
      key: `attendance-${record.id || index}`,
      label: record.sessions || "Gym Session",
      date: record.attendance_date,
      amount: Number(record.total_amount || 0),
      isPaid: true,
    })),
  ];

  
  const fetchMemberData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}?action=get_one&id=${encodeURIComponent(memberId || 0)}&email=${encodeURIComponent(user?.email || "")}`,
        { headers: getAuthHeaders() },
      );
      const data = await response.json();
      if (data.success) {
        setMemberData(data.member);

        const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
        const nextUser = {
          ...savedUser,
          id: Number(data.member?.memberID || savedUser.id || memberId || 0),
          memberID: Number(data.member?.memberID || savedUser.memberID || memberId || 0),
          fullName: data.member?.full_name || savedUser.fullName || savedUser.full_name || "",
          email: data.member?.email || savedUser.email || "",
          profile_photo: data.member?.profile_photo || savedUser.profile_photo || "",
        };
        localStorage.setItem("user", JSON.stringify(nextUser));

        if (data.member?.memberID && Number(data.member.memberID) !== Number(memberId)) {
          localStorage.setItem("user", JSON.stringify({
            ...nextUser,
            id: Number(data.member.memberID),
            memberID: Number(data.member.memberID),
          }));
        }
      }

      const attendanceResponse = await fetch(
        `${API_URL}?action=get_attendance&member_id=${encodeURIComponent(memberId || 0)}`,
        { headers: getAuthHeaders() },
      );
      const attendanceData = await attendanceResponse.json();
      if (attendanceData.success) {
        setAttendanceRecords(attendanceData.records || []);
      }

      const bookingsResponse = await fetch(
        `${API_BASE}/trainer_api.php?action=get_my_sessions&member_id=${encodeURIComponent(memberId || 0)}&member_email=${encodeURIComponent(user?.email || "")}`,
        { headers: getAuthHeaders() },
      );
      const bookingsData = await bookingsResponse.json();
      if (bookingsData.success) setBookedSessions(bookingsData.sessions || []);

      const promosResponse = await fetch(
        `${API_BASE}/trainer_api.php?action=get_promos`,
        { headers: getAuthHeaders(), cache: "no-store" },
      );
      const promosData = await promosResponse.json();
      if (promosData.success) setPromos(promosData.promos || []);
    } catch (error) {
      console.error("Error fetching member data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (memberId) {
      fetchMemberData();
    }
  }, [memberId]);

  useEffect(() => {
    const timer = window.setInterval(() => setPromoClock(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const activePromoCount = promos.filter((promo) => isPromoAvailable(promo, promoClock)).length;
    if (activePromoCount < 2) return undefined;
    const timer = window.setInterval(() => {
      setPromoIndex((current) => (current + 1) % activePromoCount);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [promos, promoClock]);

  const availPromo = async (promo) => {
    if (!promo?.id || promoLoading) return;
    setPromoLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/trainer_api.php?action=avail_promo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            promo_id: Number(promo.id),
            payment_method: "Cash",
          }),
        },
      );
      const data = await response.json();
      if (data.success) {
        setPromoFeedback({
          isOpen: true,
          type: "success",
          title: "Payment Request Submitted",
          message: `${promo.promo_name} is reserved with a pending cash payment. Please settle the payment with gym staff. The ${promo.duration_days}-day promo becomes active after payment confirmation.`,
        });
        await fetchMemberData();
      } else {
        setPromoFeedback({
          isOpen: true,
          type: "error",
          title: "Promo Unavailable",
          message: data.message || "Unable to avail promotion.",
        });
      }
    } catch (error) {
      console.error("Avail promo error:", error);
      setPromoFeedback({
        isOpen: true,
        type: "error",
        title: "Promo Error",
        message: "Unable to avail this promotion right now.",
      });
    } finally {
      setPromoLoading(false);
    }
  };

  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
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

  const handleUpdateProfile = async (profileData) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      const memberIdForUpdate = Number(currentUser.memberID || currentUser.id || memberId || 0);
      const response = await fetch(
        `${API_BASE}/member_api.php?action=update_profile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            member_id: memberIdForUpdate,
            ...profileData,
          }),
        },
      );
      const data = await response.json();
      if (data.success) {
        const savedPhoto = data.profile_photo || profileData.profile_photo || currentUser.profile_photo || "";
        const updatedUser = {
          ...currentUser,
          fullName: profileData.full_name,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          middle_initial: profileData.middle_initial,
          email: profileData.email,
          memberID: memberIdForUpdate,
          id: memberIdForUpdate,
          profile_photo: savedPhoto,
        };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setMemberData((current) => ({
          ...(current || {}),
          ...profileData,
          profile_photo: savedPhoto,
          memberID: memberIdForUpdate,
          full_name: profileData.full_name,
          email: profileData.email,
        }));
        await fetchMemberData();
        return data;
      }

      return data;
    } catch (error) {
      console.error("Error saving profile:", error);
      throw error;
    }
  };

  const menuItems = [
    { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
    { id: "profile", name: "My Profile", icon: User },
    { id: "attendance", name: "Attendance", icon: Calendar },
    { id: "qrcode", name: "My QR Code", icon: QrCode },
    { id: "sessions", name: "Available Sessions", icon: CalendarCheck },
  ];

  const stats = [
    {
      label: "Weight",
      value: memberData?.weight ? `${memberData.weight} kg` : "—",
      icon: Weight,
      color: "text-classic-gold",
      bgColor: "bg-classic-gold/10",
    },
    {
      label: "Height",
      value: memberData?.height ? `${memberData.height} cm` : "—",
      icon: Ruler,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "BMI",
      value: bmi || "—",
      icon: Target,
      color: bmiCategory.color,
      bgColor: bmiCategory.bg,
    },
    {
      label: "Total Check-ins",
      value: paidAttendance.length,
      icon: CalendarCheck,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
    },
  ];

  const availablePromos = promos.filter((promo) => isPromoAvailable(promo, promoClock));
  const currentPromo = availablePromos[promoIndex % Math.max(availablePromos.length, 1)] || null;
  const promoImage = currentPromo?.image_url
    ? (/^https?:\/\//i.test(currentPromo.image_url)
      ? currentPromo.image_url
      : `${BACKEND_ROOT}/${String(currentPromo.image_url).replace(/^\/+/, "")}`)
    : "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1400&q=85";

  const renderContent = () => {
    switch (activeMenu) {
      case "qrcode":
        return (
          <MemberQRCode
            memberData={memberData}
            memberId={memberId}
            user={user}
          />
        );
      case "profile":
        return (
          <MemberProfile
            memberData={memberData}
            memberId={memberId}
            onUpdate={handleUpdateProfile}
            refreshData={fetchMemberData}
          />
        );
      case "attendance":
        return <MemberAttendance />;

      case "sessions":
        return <AvailableSessions memberId={memberId} />;
      case "dashboard":
      default:
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Member Dashboard
                </h1>
                <p className="text-zinc-400 text-sm mt-1">
                  Welcome back,{" "}
                  {memberData?.full_name || user?.fullName || "Member"}! Track
                  your fitness journey here.
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

            {currentPromo ? (
              <div className="group relative overflow-hidden rounded-2xl border border-classic-gold/30 bg-black/60 min-h-[220px] transition-all duration-300 hover:-translate-y-1 hover:border-[#d9a75b]/80 hover:shadow-xl hover:shadow-[#8f6b31]/20">
                <img src={promoImage} alt={currentPromo.promo_name} className="absolute inset-0 w-full h-full object-cover opacity-45 transition-transform duration-700 group-hover:scale-105" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/25" />
                <div className="relative z-10 flex min-h-[220px] items-center justify-between gap-5 p-6 sm:p-8">
                  <div className="max-w-xl">
                    <div className="flex items-center gap-2 text-classic-gold text-xs font-semibold uppercase tracking-[0.2em]"><PartyPopper className="w-4 h-4" /> Limited promotion</div>
                    <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">{currentPromo.promo_name}</h2>
                    <p className="mt-2 text-zinc-300 text-sm">Avail by {currentPromo.availment_deadline} for {currentPromo.duration_days} days. Your expiration date starts when you avail this promo.</p>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => setPromoConfirmation(currentPromo)} disabled={promoLoading} className="inline-flex items-center gap-2 rounded-xl bg-classic-gold px-4 py-2.5 text-sm font-bold text-black transition hover:bg-light-gold disabled:opacity-60">
                        Avail Now <ArrowRight className="w-4 h-4" />
                      </button>
                      <span className="text-classic-gold text-xl font-bold">₱{Number(currentPromo.price || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  {availablePromos.length > 1 && (
                    <div className="hidden sm:flex items-center gap-2">
                      <button type="button" aria-label="Previous promotion" onClick={() => setPromoIndex((promoIndex - 1 + availablePromos.length) % availablePromos.length)} className="w-10 h-10 rounded-full border border-white/20 bg-black/30 text-white flex items-center justify-center hover:border-classic-gold"><ChevronLeft className="w-5 h-5" /></button>
                      <button type="button" aria-label="Next promotion" onClick={() => setPromoIndex((promoIndex + 1) % availablePromos.length)} className="w-10 h-10 rounded-full border border-white/20 bg-black/30 text-white flex items-center justify-center hover:border-classic-gold"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-classic-gold/20 bg-black/40 px-6 text-center">
                <div>
                  <PartyPopper className="mx-auto h-8 w-8 text-zinc-600" />
                  <p className="mt-3 text-sm font-semibold text-zinc-300">No promo available</p>
                  <p className="mt-1 text-xs text-zinc-500">Check back later for new promotions.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="group relative overflow-hidden rounded-xl bg-black/40 backdrop-blur-md border border-classic-gold/10 p-5 transition-all duration-300 hover:bg-black/50 hover:scale-[1.02]"
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
                </div>
              ))}
            </div>

            
            <div
              className={`group p-4 rounded-xl ${bmiCategory.bg} border border-classic-gold/20 transition-all duration-300 hover:-translate-y-0.5 hover:border-classic-gold/40 hover:shadow-lg hover:shadow-classic-gold/5`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-sm">Body Mass Index (BMI)</p>
                  <p className={`text-2xl font-bold ${bmiCategory.color}`}>
                    {bmi || "—"}
                  </p>
                  <p className={`text-sm ${bmiCategory.color}`}>
                    {bmiCategory.label}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-classic-gold/10 flex items-center justify-center">
                  <Target className="w-6 h-6 text-classic-gold" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl bg-black/40 backdrop-blur-md border border-classic-gold/10 p-5 transition-all duration-300 hover:border-classic-gold/30 hover:bg-black/50 hover:shadow-lg hover:shadow-classic-gold/5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-classic-gold" />
                  Recent Check-ins
                </h3>
                <div className="space-y-3">
                  {paidAttendance.length > 0 ? (
                    paidAttendance.slice(0, 4).map((record, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg transition-all duration-200 hover:bg-zinc-900/80 hover:border-classic-gold/20 hover:-translate-y-0.5"
                      >
                        <div>
                          <p className="text-white text-sm font-medium">
                            {record.sessions || "Gym attendance"}
                          </p>
                          <p className="text-zinc-500 text-xs">
                            {record.attendance_date
                              ? new Date(record.attendance_date).toLocaleDateString()
                              : "Recorded attendance"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-classic-gold text-xs">
                            Check-in
                          </p>
                          <p className="text-zinc-500 text-xs">
                            ₱{Number(record.total_amount || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-500 text-sm text-center py-6">
                      No check-ins recorded yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-black/40 backdrop-blur-md border border-classic-gold/10 p-5 transition-all duration-300 hover:border-classic-gold/30 hover:bg-black/50 hover:shadow-lg hover:shadow-classic-gold/5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-classic-gold" />
                  Sessions You Availed
                </h3>
                <div className="space-y-3">
                  {availedSessions.length > 0 ? (
                    availedSessions.slice(0, 4).map((session) => (
                      <div key={session.key} className="p-3 bg-zinc-900/50 rounded-lg transition-all duration-200 hover:bg-zinc-900/80 hover:border-classic-gold/20 hover:-translate-y-0.5">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-white text-sm font-medium">
                            {session.label}
                          </p>
                          <span className={`text-xs ${session.isPaid ? "text-emerald-400" : "text-amber-400"}`}>
                            {session.isPaid ? "Paid" : "Unpaid"}
                          </span>
                        </div>
                        <p className="text-zinc-500 text-xs">
                          {session.date ? new Date(session.date).toLocaleDateString() : "Scheduled session"}
                        </p>
                        <p className="text-zinc-600 text-xs mt-1">
                          ₱{session.amount.toFixed(2)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-500 text-sm text-center py-6">
                      No sessions availed yet.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-black/40 backdrop-blur-md border border-classic-gold/10 p-6 text-center transition-all duration-300 hover:border-classic-gold/30 hover:bg-black/50 hover:shadow-lg hover:shadow-classic-gold/5">
              <h2 className="text-white text-lg font-semibold">
                Keep pushing forward,{" "}
                {memberData?.full_name?.split(" ")[0] || "Champion"}!
              </h2>
              <p className="text-zinc-400 text-sm mt-2">
                Your consistency is paying off!
              </p>
            </div>
          </div>
        );
    }
  };

  if (loading && !memberData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-classic-gold"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {promoConfirmation && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close payment details"
            onClick={() => !promoLoading && setPromoConfirmation(null)}
            className="absolute inset-0 cursor-default bg-black/80 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-classic-gold/30 bg-[#111111] shadow-2xl">
            <div className="flex items-start justify-between border-b border-classic-gold/10 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-classic-gold">Payment details</p>
                <h2 className="mt-1 text-xl font-bold text-white">Confirm promotion</h2>
              </div>
              <button type="button" onClick={() => setPromoConfirmation(null)} disabled={promoLoading} aria-label="Close" className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/10 hover:text-white disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-classic-gold/20 bg-classic-gold/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">{promoConfirmation.promo_name}</p>
                    <p className="mt-1 text-xs text-zinc-400">Valid for {promoConfirmation.duration_days} days after payment confirmation</p>
                  </div>
                  <p className="whitespace-nowrap text-lg font-bold text-classic-gold">₱{Number(promoConfirmation.price || 0).toFixed(2)}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-zinc-500">Availment deadline</p><p className="mt-1 text-zinc-200">{promoConfirmation.availment_deadline}</p></div>
                  <div><p className="text-zinc-500">Activation</p><p className="mt-1 text-zinc-200">After staff confirms payment</p></div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-zinc-300">Payment method</p>
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-emerald-500/15 p-2"><Banknote className="h-5 w-5 text-emerald-400" /></span>
                    <div><p className="text-sm font-semibold text-white">Cash</p><p className="text-xs text-zinc-400">Pay at the gym front desk</p></div>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                </div>
              </div>

              <p className="text-xs leading-relaxed text-zinc-500">Confirming creates a pending payment request. Your promotion will not be active until gym staff confirms the cash payment.</p>
            </div>

            <div className="flex gap-3 border-t border-classic-gold/10 px-5 py-4">
              <button type="button" onClick={() => setPromoConfirmation(null)} disabled={promoLoading} className="flex-1 rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-50">Cancel</button>
              <button type="button" onClick={async () => { const promo = promoConfirmation; setPromoConfirmation(null); await availPromo(promo); }} disabled={promoLoading} className="flex-1 rounded-xl bg-classic-gold px-4 py-3 text-sm font-bold text-black transition hover:bg-light-gold disabled:opacity-60">
                {promoLoading ? "Submitting..." : "Confirm Cash Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
      <FeedbackModal
        {...promoFeedback}
        onClose={() => setPromoFeedback((previous) => ({ ...previous, isOpen: false }))}
      />
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
          className={`
            fixed md:sticky md:top-0 md:h-screen
            top-0 left-0 h-full z-50
            flex flex-col
            bg-[#0a0a0a]/95 backdrop-blur-2xl
            border-r border-classic-gold/10
            transition-all duration-300
            ${isMobile ? (sidebarOpen ? "translate-x-0" : "-translate-x-full") : "translate-x-0"}
            w-[280px] flex-shrink-0
          `}
        >
          <div className="flex items-center justify-between px-5 py-5 border-b border-classic-gold/10">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="w-8 h-8" />
              
              <span className="text-classic-gold font-bold text-lg">
                Capra Fitness
              </span>
            </div>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-zinc-400 hover:text-classic-gold"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
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
                    flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 relative
                    ${
                      isActive
                        ? "bg-classic-gold text-black shadow-lg shadow-classic-gold/20"
                        : "text-zinc-400 hover:bg-classic-gold/10 hover:text-classic-gold"
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  
                  <span className="text-sm font-medium">{item.name}</span>
                  {isActive && (
                    
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-black/20 rounded-r-full" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-classic-gold/10">
            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-red-400/90 hover:text-red-300 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-5 h-5" />
              
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
                    className="p-2 rounded-lg text-zinc-400 hover:text-classic-gold"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                )}
                
              </div>

              <div className="flex items-center gap-3">
                <NotificationBell userRole="member" recipientId={memberId} />

                <div className="hidden md:block w-px h-8 bg-classic-gold/10" />

                <button
                  type="button"
                  onClick={() => setActiveMenu("profile")}
                  title="Open My Profile"
                  className="group flex items-center gap-3 pl-1 rounded-lg p-1 transition-colors hover:bg-classic-gold/10 focus:outline-none focus:ring-2 focus:ring-classic-gold/50"
                >
                  <div className="text-right hidden sm:block">
                    <p className="text-zinc-400 text-xs">Welcome back,</p>
                    <p className="text-classic-gold text-sm font-semibold truncate max-w-[120px]">
                      {memberData?.full_name?.split(" ")[0] || "Member"}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-classic-gold/30 to-classic-gold/5 ring-1 ring-classic-gold/20 group-hover:ring-classic-gold/60 flex items-center justify-center overflow-hidden">
                    {memberData?.profile_photo ? (
                      <img src={memberData.profile_photo} alt="Member profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-classic-gold" />
                    )}
                  </div>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
}

export default MemberDashboard;