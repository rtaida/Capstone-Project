import { useState, useEffect, useMemo } from "react";
import {
  User,
  Mail,
  Phone,
  Edit2,
  Save,
  Weight,
  Ruler,
  Target,
  PhilippinePeso,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SuccessModal from "../../components/memberModal/SuccessModal";
import NothingChangeModal from "../../components/memberModal/NothingChangeModal";
import { getAuthHeaders } from "../../services/api";
import { buildMemberFullName, splitMemberName } from "../../utils/memberName";

const memberInputClass = "w-full min-w-0 min-h-11 mt-1 px-3 py-2.5 text-sm sm:text-base bg-zinc-900/50 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-classic-gold/50";

function MemberProfile({ memberData, memberId, onUpdate, refreshData }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showNothingChangeModal, setShowNothingChangeModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [nameError, setNameError] = useState("");
  const [originalData, setOriginalData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [promoPayments, setPromoPayments] = useState([]);
  const [paidSessionPayments, setPaidSessionPayments] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });

  const API_BASE = import.meta.env.VITE_API_URL || "/api";
  const [profileData, setProfileData] = useState({
    full_name: "",
    first_name: "",
    last_name: "",
    middle_initial: "",
    email: "",
    phone: "",
    weight: "",
    height: "",
    age: "",
    gender: "",
    payment_method: "",
  });

  
  const calculateBMI = (weight, height) => {
    if (!weight || !height || weight <= 0 || height <= 0) return null;
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    return bmi.toFixed(1);
  };

  const getBMICategory = (bmi) => {
    if (!bmi) return { label: "N/A", color: "text-zinc-400", bg: "bg-zinc-500/10" };
    if (bmi < 18.5) return { label: "Underweight", color: "text-blue-400", bg: "bg-blue-500/10" };
    if (bmi >= 18.5 && bmi < 25) return { label: "Normal", color: "text-emerald-400", bg: "bg-emerald-500/10" };
    if (bmi >= 25 && bmi < 30) return { label: "Overweight", color: "text-amber-400", bg: "bg-amber-500/10" };
    return { label: "Obese", color: "text-red-400", bg: "bg-red-500/10" };
  };

  const bmi = calculateBMI(profileData.weight, profileData.height);
  const bmiCategory = getBMICategory(bmi);

  useEffect(() => {
    if (!memberId) return;

    const loadAttendance = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/member_api.php?action=get_attendance&member_id=${encodeURIComponent(memberId)}`,
          { headers: getAuthHeaders() },
        );
        const data = await response.json();
        if (data.success) {
          setAttendanceRecords(data.records || []);
          setPromoPayments(data.promo_payments || []);
          setPaidSessionPayments(data.paid_session_payments || []);
        }
      } catch (error) {
        console.error("Error loading member activity:", error);
      }
    };

    loadAttendance();
  }, [memberId]);

  const paidAttendance = useMemo(
    () => attendanceRecords.filter(
      (record) => String(record.payment_status || "").toLowerCase() === "paid",
    ),
    [attendanceRecords],
  );

  const activityCharts = useMemo(() => {
    const monthMap = new Map();

    paidAttendance.forEach((record) => {
      const dateKey = String(record.attendance_date || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(dateKey)) return;

      const current = monthMap.get(dateKey) || {
        monthKey: dateKey,
        checkIns: 0,
        sessions: 0,
        expenses: 0,
      };
      current.checkIns += 1;
      current.sessions += record.sessions
        ? String(record.sessions).split(",").length
        : 1;
      current.expenses += Number(record.total_amount || 0);
      monthMap.set(dateKey, current);
    });

    promoPayments.forEach((payment) => {
      const dateKey = String(payment.payment_date || "").slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(dateKey)) return;
      const current = monthMap.get(dateKey) || {
        monthKey: dateKey,
        checkIns: 0,
        sessions: 0,
        expenses: 0,
      };
      current.expenses += Number(payment.amount || 0);
      monthMap.set(dateKey, current);
    });

    paidSessionPayments
      .filter((payment) => !payment.attendance_id)
      .forEach((payment) => {
        const dateKey = String(payment.payment_date || "").slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(dateKey)) return;
        const current = monthMap.get(dateKey) || {
          monthKey: dateKey,
          checkIns: 0,
          sessions: 0,
          expenses: 0,
        };
        current.expenses += Number(payment.amount || 0);
        monthMap.set(dateKey, current);
      });

    return [...monthMap.values()]
      .sort((first, second) => first.monthKey.localeCompare(second.monthKey))
      .slice(-6)
      .map((item) => ({
        ...item,
        month: new Date(`${item.monthKey}-01T00:00:00`).toLocaleDateString(
          "en-US",
          { month: "short" },
        ),
      }));
  }, [paidAttendance, promoPayments, paidSessionPayments]);

  const attendanceCalendar = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const recordsByDate = new Map();

    paidAttendance.forEach((record) => {
      const dateKey = String(record.attendance_date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
      const records = recordsByDate.get(dateKey) || [];
      records.push(record);
      recordsByDate.set(dateKey, records);
    });

    const paidSessionsByDate = new Map();
    paidSessionPayments.forEach((payment) => {
      const dateKey = String(payment.start_time || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
      const sessions = paidSessionsByDate.get(dateKey) || [];
      sessions.push(payment);
      paidSessionsByDate.set(dateKey, sessions);
    });

    return {
      year,
      month,
      daysInMonth,
      firstDay,
      recordsByDate,
      paidSessionsByDate,
    };
  }, [calendarMonth, paidAttendance, paidSessionPayments]);

  const changeCalendarMonth = (offset) => {
    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  };

  useEffect(() => {
    if (memberData) {
      const nameParts = splitMemberName(memberData);
      const newData = {
        ...nameParts,
        full_name: buildMemberFullName(nameParts),
        email: memberData.email || "",
        phone: memberData.phone || "",
        weight: memberData.weight || "",
        height: memberData.height || "",
        age: memberData.age || "",
        gender: memberData.gender || "",
        payment_method: memberData.payment_method || "",
        profile_photo: memberData.profile_photo || "",
      };
      setProfileData(newData);
      setOriginalData(newData);
      setPhotoPreview(newData.profile_photo);
    }
  }, [memberData]);

  const checkIfChangesMade = () => {
    return JSON.stringify(profileData) !== JSON.stringify(originalData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData((current) => {
      const next = { ...current, [name]: value };
      if (["first_name", "last_name", "middle_initial"].includes(name)) {
        next.full_name = buildMemberFullName(next);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!profileData.first_name.trim() || !profileData.last_name.trim()) {
      setNameError("First and last name are required.");
      return;
    }
    if (profileData.middle_initial.length > 1) {
      setNameError("Middle initial must be one character.");
      return;
    }
    setNameError("");
    if (!checkIfChangesMade()) {
      setIsEditing(false);
      setShowNothingChangeModal(true);
      return;
    }

    setIsSubmitting(true);

    try {
      if (onUpdate) {
        const result = await onUpdate(profileData);
        const savedPhoto = result?.profile_photo || profileData.profile_photo || memberData?.profile_photo || "";
        const nextProfile = { ...profileData, profile_photo: savedPhoto };
        setProfileData(nextProfile);
        setOriginalData(nextProfile);
        setPhotoPreview(savedPhoto);
        setIsEditing(false);
        setSuccessMessage("Profile updated successfully!");
        setShowSuccessModal(true);
        if (refreshData) refreshData();
      }
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Success"
        message={successMessage}
      />

      
      <NothingChangeModal
        isOpen={showNothingChangeModal}
        onClose={() => setShowNothingChangeModal(false)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
          <p className="text-zinc-400 text-sm mt-1">View and manage your personal information</p>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          disabled={isSubmitting}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all bg-classic-gold text-black hover:bg-light-gold ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <Edit2 className="w-4 h-4" />
          Edit Profile
        </button>
      </div>

      <div className="flex flex-col bg-black/40 backdrop-blur-md rounded-2xl border border-classic-gold/10 overflow-hidden">
        
        <div className="order-2 mx-6 mt-6">
          <div className={`p-4 rounded-xl ${bmiCategory.bg} border border-classic-gold/20`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Your BMI</p>
                <p className={`text-3xl font-bold ${bmiCategory.color}`}>{bmi || "—"}</p>
                <p className={`text-sm ${bmiCategory.color} mt-1`}>{bmiCategory.label}</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-classic-gold/10 flex items-center justify-center">
                <Target className="w-8 h-8 text-classic-gold" />
              </div>
            </div>
            <div className="mt-3 h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  bmi < 18.5
                    ? "bg-blue-500 w-1/4"
                    : bmi >= 18.5 && bmi < 25
                    ? "bg-emerald-500 w-2/4"
                    : bmi >= 25 && bmi < 30
                    ? "bg-amber-500 w-3/4"
                    : "bg-red-500 w-full"
                }`}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>Underweight</span>
              <span>Normal</span>
              <span>Overweight</span>
              <span>Obese</span>
            </div>
          </div>
        </div>

        <div className="order-3 px-6 pt-6 grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div className="rounded-xl border border-classic-gold/10 bg-black/30 p-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-white font-semibold text-sm">Attendance Calendar</h3>
                  <p className="text-zinc-500 text-xs">Your check-ins and sessions</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => changeCalendarMonth(-1)}
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-zinc-300 text-xs min-w-[92px] text-center">
                  {calendarMonth.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </span>
                <button
                  type="button"
                  onClick={() => changeCalendarMonth(1)}
                  className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-l border-t border-white/10">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="p-2 text-center text-[10px] uppercase tracking-wide text-zinc-500 border-r border-b border-white/10">
                  {day}
                </div>
              ))}
              {Array.from({ length: attendanceCalendar.firstDay }).map((_, index) => (
                <div key={`empty-${index}`} className="min-h-[68px] border-r border-b border-white/10 bg-black/10" />
              ))}
              {Array.from({ length: attendanceCalendar.daysInMonth }).map((_, index) => {
                const day = index + 1;
                const dateKey = `${attendanceCalendar.year}-${String(attendanceCalendar.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const records = attendanceCalendar.recordsByDate.get(dateKey) || [];
                const paidSessions = (attendanceCalendar.paidSessionsByDate.get(dateKey) || []).filter((payment) =>
                  !records.some((record) =>
                    String(record.sessions || "").toLowerCase().includes(String(payment.session_type || "").toLowerCase()),
                  ),
                );

                return (
                  <div
                    key={dateKey}
                    title={records.length || paidSessions.length
                      ? [...records.map((record) => record.sessions || "Gym attendance"), ...paidSessions.map((payment) => `${payment.session_type} (paid session)`)].join(", ")
                      : "No check-ins"}
                    className={`group min-h-[68px] p-2 border-r border-b border-white/10 transition-all duration-200 ${records.length || paidSessions.length
                      ? "bg-emerald-500/10 cursor-pointer hover:bg-emerald-400/25 hover:border-emerald-300/50 hover:shadow-inner"
                      : "bg-black/10 hover:bg-white/[0.04]"
                    }`}
                  >
                    <p className={`text-xs font-semibold ${records.length || paidSessions.length ? "text-emerald-300" : "text-zinc-500"}`}>{day}</p>
                    {records.map((record, recordIndex) => (
                      <p key={`${dateKey}-${recordIndex}`} className="mt-1 text-[10px] leading-tight text-classic-gold truncate" title={record.sessions || "Gym attendance"}>
                        {record.sessions || "Gym attendance"}
                      </p>
                    ))}
                    {paidSessions.map((payment) => (
                      <p key={`paid-session-${payment.payment_id}`} className="mt-1 text-[10px] leading-tight text-emerald-300 truncate" title={`${payment.session_type} paid`}>
                        {payment.session_type} · Paid
                      </p>
                    ))}
                    {records.length > 0 && (
                      <p className="mt-1 text-[9px] text-emerald-400">{records.length} check-in{records.length === 1 ? "" : "s"}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-classic-gold/10 bg-black/30 p-4">
            <div className="flex items-center gap-2 mb-4">
              <PhilippinePeso className="w-4 h-4 text-amber-400" />
              <div>
                <h3 className="text-white font-semibold text-sm">Total Expenses</h3>
                <p className="text-zinc-500 text-xs">Paid attendance expenses by month</p>
              </div>
            </div>
            <div className="h-52">
              {activityCharts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={208}>
                  <AreaChart data={activityCharts}>
                    <defs>
                      <linearGradient id="memberExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d4af37" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#d4af37" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="month" stroke="rgba(255,255,255,0.45)" fontSize={11} axisLine={false} tickLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.45)" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(value) => `₱${value}`} />
                    <Tooltip formatter={(value) => [`₱${Number(value).toFixed(2)}`, "Expenses"]} contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(212,175,55,0.3)" }} />
                    <Area type="monotone" dataKey="expenses" stroke="#d4af37" strokeWidth={2} fill="url(#memberExpenseGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="h-full flex items-center justify-center text-zinc-500 text-sm">No expenses recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="order-4 px-6 pt-4 pb-6 text-center">
          <p className="text-zinc-500 text-xs">
            Member since {memberData?.created_at ? new Date(memberData.created_at).toLocaleDateString() : "May 2026"}
          </p>
        </div>

        
        <div className="order-1 px-6 pt-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-classic-gold/40 to-classic-gold/10 flex items-center justify-center ring-2 ring-classic-gold/30 overflow-hidden">
              {profileData.profile_photo ? (
                <img src={profileData.profile_photo} alt="Member profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-classic-gold font-bold text-2xl">{profileData.full_name?.charAt(0).toUpperCase() || "M"}</span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{profileData.full_name || "Member"}</h2>
              <p className="text-classic-gold text-sm">Member #{memberId}</p>
              <p className={`text-xs mt-1 ${memberData?.status === "active" ? "text-emerald-400" : "text-red-400"}`}>
                {memberData?.status === "active" ? "Active Member" : "Inactive"}
              </p>
            </div>
          </div>
        </div>

        
        <div className="order-1 px-6 pb-6 mt-6">
          <h3 className="text-white font-semibold mb-4 pb-2 border-b border-classic-gold/10">
            Member Info
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-[1fr_1fr_6rem] gap-4">
              {[
                ["last_name", "Last name", 100],
                ["first_name", "First name", 100],
                ["middle_initial", "Middle initial", 1],
              ].map(([field, label, maxLength]) => (
                <div key={field}>
                  <label className="text-zinc-500 text-xs uppercase tracking-wider flex items-center gap-1">
                    {field === "first_name" && <User className="w-3 h-3" />}{label}
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name={field}
                      maxLength={maxLength}
                      value={profileData[field]}
                      onChange={(event) => handleChange({
                        target: {
                          name: field,
                          value: field === "middle_initial"
                            ? event.target.value.slice(0, 1).toLocaleUpperCase()
                            : event.target.value,
                        },
                      })}
                      className={memberInputClass}
                    />
                  ) : (
                    <p className="text-white mt-1">{profileData[field] || "Not set"}</p>
                  )}
                </div>
              ))}
              {nameError && <p className="sm:col-span-3 text-xs text-red-400">{nameError}</p>}
            </div>

            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email Address
              </label>
              {isEditing ? (
                <input
                  type="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleChange}
                  className={memberInputClass}
                />
              ) : (
                <p className="text-white mt-1">{profileData.email || "Not set"}</p>
              )}
            </div>

            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider flex items-center gap-1">
                <Phone className="w-3 h-3" /> Phone Number
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="phone"
                  value={profileData.phone}
                  onChange={handleChange}
                  className={memberInputClass}
                />
              ) : (
                <p className="text-white mt-1">{profileData.phone || "Not set"}</p>
              )}
            </div>

            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider flex items-center gap-1">
                <Weight className="w-3 h-3" /> Weight (kg)
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="weight"
                  value={profileData.weight}
                  onChange={handleChange}
                  className={memberInputClass}
                />
              ) : (
                <p className="text-white mt-1">{profileData.weight ? `${profileData.weight} kg` : "Not set"}</p>
              )}
            </div>

            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider flex items-center gap-1">
                <Ruler className="w-3 h-3" /> Height (cm)
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="height"
                  value={profileData.height}
                  onChange={handleChange}
                  className={memberInputClass}
                />
              ) : (
                <p className="text-white mt-1">{profileData.height ? `${profileData.height} cm` : "Not set"}</p>
              )}
            </div>

            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider">Age</label>
              {isEditing ? (
                <input
                  type="number"
                  name="age"
                  value={profileData.age}
                  onChange={handleChange}
                  className={memberInputClass}
                />
              ) : (
                <p className="text-white mt-1">{profileData.age ? `${profileData.age} years old` : "Not set"}</p>
              )}
            </div>

            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider">Gender</label>
              {isEditing ? (
                <select
                  name="gender"
                  value={profileData.gender}
                  onChange={handleChange}
                  className={memberInputClass}
                >
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              ) : (
                <p className="text-white mt-1">{profileData.gender || "Not set"}</p>
              )}
            </div>

            <div>
              <label className="text-zinc-500 text-xs uppercase tracking-wider">Payment Method</label>
              {isEditing ? (
                <select
                  name="payment_method"
                  value={profileData.payment_method}
                  onChange={handleChange}
                  className={memberInputClass}
                >
                  <option>Cash</option>
                </select>
              ) : (
                <p className="text-white mt-1">{profileData.payment_method || "Cash"}</p>
              )}
            </div>
          </div>

          
        </div>

        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8 sm:pt-10">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsEditing(false)}
            />
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-classic-gold/15 bg-[#111111] p-6 shadow-2xl shadow-black/50">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-white text-xl font-semibold">Edit profile</h3>
                  <p className="text-zinc-500 text-sm mt-1">Update your member information.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-zinc-500 hover:text-white"
                  aria-label="Close edit profile"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-zinc-300 mb-2 text-sm">Profile photo</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const photo = String(reader.result || "");
                        setPhotoPreview(photo);
                        setProfileData((current) => ({ ...current, profile_photo: photo }));
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3 py-2.5 text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-classic-gold file:px-3 file:py-1.5 file:font-semibold file:text-black"
                  />
                  {photoPreview && <img src={photoPreview} alt="Selected profile preview" className="mt-3 h-16 w-16 rounded-full object-cover ring-2 ring-classic-gold/30" />}
                </div>
                {[
                  ["last_name", "Last name", "text", 100],
                  ["first_name", "First name", "text", 100],
                  ["middle_initial", "Middle initial", "text", 1],
                  ["email", "Email", "email", ""],
                  ["phone", "Phone", "text", ""],
                  ["weight", "Weight (kg)", "number", ""],
                  ["height", "Height (cm)", "number", ""],
                  ["age", "Age", "number", ""],
                ].map(([name, label, type, maxLength]) => (
                  <div key={name}>
                    <label className="block text-zinc-300 mb-2 text-sm">{label}</label>
                    <input
                      type={type}
                      name={name}
                      maxLength={maxLength || undefined}
                      value={profileData[name]}
                      onChange={(event) => handleChange({
                        target: {
                          name,
                          value: name === "middle_initial"
                            ? event.target.value.slice(0, 1).toLocaleUpperCase()
                            : event.target.value,
                        },
                      })}
                      className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3 py-2.5 text-white outline-none focus:border-classic-gold"
                    />
                  </div>
                ))}
                {nameError && <p className="sm:col-span-2 text-xs text-red-400">{nameError}</p>}
                <div>
                  <label className="block text-zinc-300 mb-2 text-sm">Gender</label>
                  <select
                    name="gender"
                    value={profileData.gender}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3 py-2.5 text-white outline-none focus:border-classic-gold"
                  >
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-300 mb-2 text-sm">Payment method</label>
                  <select
                    name="payment_method"
                    value={profileData.payment_method}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3 py-2.5 text-white outline-none focus:border-classic-gold"
                  >
                    <option value="">Select</option>
                    <option>Cash</option>
                    <option>GCash</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800/70 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="rounded-xl bg-classic-gold px-5 py-2.5 text-sm font-semibold text-black hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberProfile;