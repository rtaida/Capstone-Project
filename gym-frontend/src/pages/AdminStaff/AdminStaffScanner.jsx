import { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  X,
  User,
  Mail,
  Phone,
  Calendar as CalendarIcon,
  Loader2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Camera,
  ScanLine,
  ShieldCheck,
  Dumbbell,
  UserIcon,
  Users,
  Clock,
  Check,
} from "lucide-react";
import DuplicateCheckInModal from "../../components/memberModal/DuplicateCheckInModal";
import SuccessModal from "../../components/memberModal/SuccessModal";
import { getAuthHeaders } from "../../services/api";

const animationStyles = `
  @keyframes modalFadeIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-50px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(50px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse-brown-gold {
    0%, 100% { box-shadow: 0 0 0 0 rgba(201, 168, 76, 0.4); }
    50% { box-shadow: 0 0 0 12px rgba(201, 168, 76, 0); }
  }
  .modal-animation { animation: modalFadeIn 0.3s ease-out forwards; }
  .slide-in-left { animation: slideInLeft 0.4s ease-out forwards; }
  .slide-in-right { animation: slideInRight 0.4s ease-out forwards; }
  .fade-in-up { animation: fadeInUp 0.4s ease-out forwards; }
  .delay-100 { animation-delay: 0.1s; opacity: 0; animation-fill-mode: forwards; }
  .delay-200 { animation-delay: 0.2s; opacity: 0; animation-fill-mode: forwards; }
  .delay-300 { animation-delay: 0.3s; opacity: 0; animation-fill-mode: forwards; }
  .delay-400 { animation-delay: 0.4s; opacity: 0; animation-fill-mode: forwards; }
  .pulse-verify { animation: pulse-brown-gold 1.5s ease-in-out infinite; }
  .strikethrough { text-decoration: line-through; text-decoration-color: #ef4444; }
`;




const API_BASE = import.meta.env.VITE_API_URL || "/api";
const WALK_IN_PRICE = 80;

const isScheduledTrainerSessionValid = (session) => {
  if (!session?.end_time) return false;

  const status = String(session.status || "approved").toLowerCase();
  if (["terminated", "finished", "rejected"].includes(status)) {
    return false;
  }

  const now = new Date();
  const end = new Date(session.end_time);
  return end >= now;
};

const useAvailableSessions = () => {
  const [availableSessions, setAvailableSessions] = useState([]);
  const [sessionCatalog, setSessionCatalog] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const fetchAvailableSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const [sessionsResponse, catalogResponse] = await Promise.all([
        fetch(
          `${API_BASE}/trainer_api.php?action=get_available_sessions`,
          { headers: getAuthHeaders(), cache: "no-store" },
        ),
        fetch(
          `${API_BASE}/trainer_api.php?action=get_session_catalog`,
          { headers: getAuthHeaders(), cache: "no-store" },
        ),
      ]);

      const [sessionData, catalogData] = await Promise.all([
        sessionsResponse.json(),
        catalogResponse.json(),
      ]);

      if (!sessionData.success) {
        throw new Error(
          sessionData.message || "Unable to load available sessions.",
        );
      }

      const sessions = (sessionData.sessions || []).filter((session) => {
        const bookingCount = Number(session.booking_count || 0);
        const maxParticipants = Number(session.max_participants || 1);
        const isFull = bookingCount >= maxParticipants;
        return !isFull;
      });
      setAvailableSessions(sessions);

      if (!catalogData.success) {
        throw new Error(
          catalogData.message || "Unable to load session pricing.",
        );
      }

      setSessionCatalog(
        (catalogData.session_types || []).filter(
          (item) => Number(item.is_active) === 1 || item.is_active === true,
        ),
      );
    } catch (error) {
      console.error("Error fetching sessions/pricing:", error);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableSessions();
  }, [fetchAvailableSessions]);

  return {
    availableSessions,
    sessionCatalog,
    loadingSessions,
    fetchAvailableSessions,
  };
};




const checkSessionBookedBy = async (sessionId) => {
  try {
    const response = await fetch(
      `${API_BASE}/trainer_api.php?action=get_session_booked_members&session_id=${sessionId}`,
    );
    const data = await response.json();
    if (data.success && data.total > 0) {
      return {
        booked: true,
        memberName: data.members?.[0]?.full_name || "Someone",
        count: data.total,
      };
    }
    return { booked: false, memberName: null, count: 0 };
  } catch (error) {
    console.error("Error checking session bookings:", error);
    return { booked: false, memberName: null, count: 0 };
  }
};




const WalkInModal = memo(function WalkInModal({ show, onClose, onSubmit, submitting, price }) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  useEffect(() => {
    if (show) {
      setClientName("");
      setClientEmail("");
      setPaymentMethod("Cash");
    }
  }, [show]);

  if (!show) return null;
  const submit = async (event) => {
    event.preventDefault();
    if (!clientName.trim()) return;
    await onSubmit({ clientName: clientName.trim(), clientEmail: clientEmail.trim(), paymentMethod });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={!submitting ? onClose : undefined} />
      <div className="relative w-full max-w-md bg-[#121212] border border-[#d9a75b]/20 rounded-2xl shadow-2xl overflow-hidden modal-animation">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d9a75b]/10 bg-gradient-to-r from-[#a86e2a]/20 to-transparent">
          <div className="flex items-center gap-3"><UserIcon className="w-5 h-5 text-[#d9a75b]" /><h2 className="text-white text-lg font-semibold">Walk-in Registration</h2></div>
          <button type="button" onClick={onClose} disabled={submitting} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div><label className="block text-xs text-zinc-400 mb-2">Client Name</label><input required maxLength={150} value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-black/70 px-4 py-3 text-white outline-none focus:border-[#d9a75b]/50" placeholder="Enter client name" /></div>
          <div><label className="block text-xs text-zinc-400 mb-2">Client Email</label><input required maxLength={254} type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="w-full rounded-xl border border-zinc-800 bg-black/70 px-4 py-3 text-white outline-none focus:border-[#d9a75b]/50" placeholder="client@example.com" /></div>
          <div className="rounded-xl border border-[#d9a75b]/15 bg-[#d9a75b]/5 p-4"><div className="text-xs text-zinc-400">Session Type</div><div className="mt-1 text-white font-semibold">Walk-in Regular Session</div><div className="mt-2 text-[#d9a75b] text-xl font-bold">₱{Number(price || 0).toFixed(2)}</div><div className="text-[11px] text-zinc-500 mt-1">Fixed walk-in rate.</div></div>
          <div><label className="block text-xs text-zinc-400 mb-2">Payment Method</label><div className="flex gap-2"><button type="button" onClick={() => setPaymentMethod("Cash")} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[#d9a75b] text-black">Cash</button></div></div>
          <div className="flex gap-3 pt-2"><button type="button" onClick={onClose} disabled={submitting} className="flex-1 py-2.5 rounded-xl border border-zinc-800 text-zinc-300 hover:bg-zinc-900">Cancel</button><button type="submit" disabled={submitting || !clientName.trim() || !clientEmail.trim() || Number(price || 0) <= 0} className="flex-1 py-2.5 rounded-xl bg-[#d9a75b] text-black font-semibold disabled:opacity-50">{submitting ? "Saving..." : "Save Walk-in"}</button></div>
        </form>
      </div>
    </div>
  );
});

const MemberDetailsModal = memo(function MemberDetailsModal({
  show,
  member,
  isSubmitting,
  paymentMethod,
  onPaymentMethodChange,
  sessionSelection,
  onSessionToggle,
  selectedSessionLabel,
  totalAmount,
  regularSessionPrice,
  availableSessions,
  loadingSessions,
  sessionBookings,
  currentBookedSession,
  onClose,
  onSubmit,
}) {
  if (!show || !member) return null;

  const formatDateTime = (datetime) => {
    if (!datetime) return "N/A";
    const date = new Date(datetime);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (datetime) => {
    if (!datetime) return "N/A";
    const date = new Date(datetime);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isSessionCompleted = (endTime) => {
    return new Date(endTime) < new Date();
  };

  const isSessionUpcoming = (startTime) => {
    return new Date(startTime) > new Date();
  };

  const isBookedSessionEligible = isScheduledTrainerSessionValid(currentBookedSession);

  const isBookedSessionToday = isBookedSessionEligible && currentBookedSession?.start_time
    ? (() => {
      const now = new Date();
      const start = new Date(currentBookedSession.start_time);
      const end = new Date(currentBookedSession.end_time);
      return start <= now && now <= end;
    })()
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={!isSubmitting ? onClose : undefined}
      />
      <div className="relative bg-[#121212] border border-[#d9a75b]/20 rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[90vh] flex flex-col modal-animation">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d9a75b]/10 bg-gradient-to-r from-[#a86e2a]/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#d9a75b]/20 flex items-center justify-center">
              <User className="w-5 h-5 text-[#d9a75b]" />
            </div>
            <h2 className="text-[#ffffff] text-lg font-semibold">
              Member Details & Attendance
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-lg text-[#ffffff] hover:text-[#ffffff] hover:bg-[#202020] transition-all disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>


        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">

          <div className="rounded-2xl border border-[#d9a75b]/10 bg-gradient-to-br from-[#000000]/90 to-[#121212]/90 p-4 slide-in-left">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#ffffff] text-sm">Member Information</p>
                <p className="text-[#ffffff] text-xl font-semibold mt-1">
                  {member.full_name}
                </p>
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <Mail className="w-4 h-4 text-[#ffffff]" />
                  <span className="text-[#ffffff]">{member.email}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <Phone className="w-4 h-4 text-[#ffffff]" />
                  <span className="text-[#ffffff]">
                    {member.phone || "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <CalendarIcon className="w-4 h-4 text-[#ffffff]" />
                  <span className="text-[#ffffff]">
                    Age: {member.age || "N/A"}
                  </span>
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${member.status === "active"
                    ? "bg-[#22c55e]/20 text-[#4ade80]"
                    : "bg-[#8B3A3A]/30 text-[#D47676]"
                  }`}
              >
                {member.status || "active"}
              </div>
            </div>
          </div>


          {currentBookedSession && (
            <div className="rounded-2xl border border-[#d9a75b]/30 bg-gradient-to-br from-[#a86e2a]/20 to-[#000000]/70 p-4 slide-in-right delay-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-[#d9a75b]" />
                  <p className="text-[#ffffff] text-sm font-semibold">
                    Current Booked Session
                  </p>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isBookedSessionToday
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-amber-500/15 text-amber-400"
                    }`}
                >
                  {isBookedSessionToday ? "UPCOMING" : "RESERVED"}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[#d9a75b] font-semibold text-sm">{currentBookedSession.session_type}</span>
                    <span className="bg-emerald-500/15 text-emerald-400 text-[10px] px-2 py-1 rounded-full font-medium">
                      {isBookedSessionToday ? "Upcoming" : "Reserved"}
                    </span>
                  </div>
                  <span className="text-[#d9a75b] font-bold text-lg">
                    ₱{Number(currentBookedSession.price || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-[#ffffff]/80">
                  <UserIcon className="w-4 h-4 text-[#ffffff]/70" />
                  <span>Trainer: {currentBookedSession.trainer_name || "Unknown Trainer"}</span>
                </div>

                <div className="flex items-center justify-between text-sm text-[#ffffff]/70 gap-3 flex-wrap">
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {formatDateTime(currentBookedSession.start_time)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {formatTime(currentBookedSession.start_time)} - {formatTime(currentBookedSession.end_time)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-[#ffffff]/70">
                  <Users className="w-4 h-4" />
                  <span>
                    Capacity: {Number(currentBookedSession.booking_count || 0)}/{Number(currentBookedSession.max_participants || 1)} filled • {Math.max(0, Number(currentBookedSession.max_participants || 1) - Number(currentBookedSession.booking_count || 0))} left
                  </span>
                </div>
              </div>

              <p className="text-[#ffffff]/50 text-xs mt-3">
                {isBookedSessionToday
                  ? "The trainer-session charge is handled separately in Payments. Only the Regular Session gym fee is included in today's check-in total."
                  : "This booking remains reserved for its scheduled date, and its charge is handled separately in Payments. A Regular Session fee applies to today's gym check-in."}
              </p>
            </div>
          )}


          <div className="rounded-2xl border border-[#d9a75b]/10 bg-[#000000]/70 p-4 slide-in-right delay-100">
            <p className="text-[#ffffff] text-sm mb-3">Payment Method</p>
            {currentBookedSession && isBookedSessionEligible ? (
              <div className="rounded-xl bg-[#121212] px-4 py-2 text-sm text-[#ffffff] border border-[#202020]">
                Existing booking payment:{" "}
                <span className="text-[#d9a75b] font-semibold">
                  {currentBookedSession.payment_method || "Cash"}
                </span>
              </div>
            ) : (
              <div className="flex gap-3">
                {["Cash"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => onPaymentMethodChange(method)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 hover:scale-105 ${paymentMethod === method
                        ? "bg-[#d9a75b] text-[#121212] shadow-lg shadow-[#d9a75b]/20"
                        : "bg-[#121212] text-[#ffffff] hover:bg-[#202020]"
                      }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            )}
          </div>


          {(!currentBookedSession || !isBookedSessionEligible) && (
            <div className="rounded-2xl border border-[#d9a75b]/10 bg-[#000000]/70 p-4 slide-in-left delay-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[#ffffff] text-sm">
                  Session Check-In
                </p>
                {loadingSessions && (
                  <Loader2 className="w-4 h-4 text-[#d9a75b] animate-spin" />
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-[#d9a75b]/10">
                <button
                  type="button"
                  onClick={() => onSessionToggle("regular")}
                  className={`w-full rounded-xl border px-4 py-2 text-left text-sm transition-all duration-200 hover:scale-[1.02] ${sessionSelection["regular"]
                      ? "border-[#d9a75b] bg-[#d9a75b]/10 text-[#ffffff] shadow-lg shadow-[#d9a75b]/10"
                      : "border-[#202020] bg-[#000000]/80 text-[#ffffff] hover:border-[#202020]"
                    }`}
                >
                  <div className="flex justify-between">
                    <span>Regular Session</span>
                    <span className="text-[#d9a75b]">
                      ₱{regularSessionPrice.toFixed(2)}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}


          <div className="rounded-2xl bg-gradient-to-r from-[#a86e2a]/30 to-[#d9a75b]/10 border border-[#d9a75b]/20 p-4 fade-in-up delay-300">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[#ffffff] text-sm">Selected Sessions</p>
                <p className="text-[#ffffff] text-sm mt-1">
                  {selectedSessionLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[#ffffff] text-sm">Total Amount</p>
                <p className="text-[#d9a75b] text-2xl font-bold">
                  ₱{totalAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>


        <div className="px-6 py-4 border-t border-[#d9a75b]/10 flex gap-3 bg-[#000000]/60 fade-in-up delay-400">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-[#202020] text-[#ffffff] rounded-xl font-medium hover:bg-[#202020] transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-[#d9a75b] text-[#121212] rounded-xl font-semibold hover:bg-[#d9a75b] transition-all hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#d9a75b]/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirm Check In
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});




const ErrorModalComponent = memo(function ErrorModalComponent({
  show,
  errorMessage,
  onClose,
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-[#121212] border border-[#8B3A3A]/30 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#8B3A3A]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8B3A3A]/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#e60f0f]" />
            </div>
            <h2 className="text-[#ffffff] text-lg font-semibold">Error</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#ffffff] hover:text-[#ffffff] hover:bg-[#202020]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-6 text-center">
          <AlertTriangle className="w-12 h-12 text-[#e60f0f] mx-auto mb-3" />
          <p className="text-[#ffffff]">{errorMessage}</p>
        </div>
        <div className="px-6 py-4 border-t border-[#8B3A3A]/20">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#e60f0f] text-[#ffffff] rounded-xl font-semibold hover:bg-[#ff0000]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});




function AdminStaffScanner({ addNotification }) {

  const [cameraActive, setCameraActive] = useState(false);
  const [scanText, setScanText] = useState("");
  const [member, setMember] = useState(null);
  const [currentBookedSession, setCurrentBookedSession] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [sessionSelection, setSessionSelection] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("idle");
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManualPanelOpen, setIsManualPanelOpen] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [duplicateMemberName, setDuplicateMemberName] = useState("");
  const [isScanning, setIsScanning] = useState(true);
  const [lastScannedValue, setLastScannedValue] = useState("");
  const [sessionBookings, setSessionBookings] = useState({});
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);


  const {
    availableSessions,
    sessionCatalog,
    loadingSessions,
    fetchAvailableSessions,
  } = useAvailableSessions();

  const regularSessionCatalogItem = sessionCatalog.find(
    (item) =>
      String(item.session_name || "")
        .trim()
        .toLowerCase() === "regular session",
  );
  const regularSessionPrice = Number(regularSessionCatalogItem?.price ?? 0);


  const fetchSessionBookings = useCallback(async () => {
    if (availableSessions.length === 0) return;

    setLoadingBookings(true);
    const bookings = {};

    for (const session of availableSessions) {
      try {
        const response = await fetch(
          `${API_BASE}/trainer_api.php?action=get_session_booked_members&session_id=${session.id}`,
        );
        const data = await response.json();
        if (data.success) {
          bookings[session.id] = {
            booked: data.total > 0,
            memberName:
              data.members && data.members.length > 0
                ? data.members[0].full_name
                : "Someone",
            count: data.total || 0,
          };
        } else {
          bookings[session.id] = { booked: false, memberName: null, count: 0 };
        }
      } catch (error) {
        console.error("Error fetching booking for session", session.id, error);
        bookings[session.id] = { booked: false, memberName: null, count: 0 };
      }
    }

    setSessionBookings(bookings);
    setLoadingBookings(false);
  }, [availableSessions]);


  useEffect(() => {
    fetchSessionBookings();
  }, [availableSessions]);


  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanningRef = useRef(false);
  const modalOpenRef = useRef(false);
  const scanFrameRef = useRef(null);


  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = animationStyles;
    document.head.appendChild(styleElement);
    return () => document.head.removeChild(styleElement);
  }, []);


  useEffect(() => {
    if (!window.jsQR) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/jsqr@1.4.0/dist/jsQR.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);


  useEffect(() => {
    const isSecureContext =
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!isSecureContext) {
      setPermissionError(true);
      setVerificationStatus("error");
      setStatusMessage(
        "Camera access requires a secure connection. Open the app with HTTPS on the local network and try again.",
      );
      return;
    }

    const requestPermission = async () => {
      try {
        await startCamera();
      } catch (error) {
        console.error("Auto-start camera error:", error);
      }
    };

    const timer = window.setTimeout(() => {
      void requestPermission();
    }, 400);

    return () => {
      window.clearTimeout(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);


  useEffect(() => {
    modalOpenRef.current =
      showMemberModal ||
      showDuplicateModal ||
      showSuccessModal ||
      showErrorModal;

    if (
      !showMemberModal &&
      !showDuplicateModal &&
      !showSuccessModal &&
      !showErrorModal
    ) {
      setVerificationStatus("scanning");
      setStatusMessage("Scanning for QR code...");
      scanningRef.current = false;
      const timer = setTimeout(() => {
        scanningRef.current = false;
        if (scanFrameRef.current) {
          requestAnimationFrame(scanFrameRef.current);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showMemberModal, showDuplicateModal, showSuccessModal, showErrorModal]);


  const startCamera = async () => {
    const isSecureContext =
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      setPermissionError(true);
      setVerificationStatus("error");
      setStatusMessage("This browser does not support camera scanning here.");
      return;
    }

    if (!isSecureContext) {
      setPermissionError(true);
      setVerificationStatus("error");
      setStatusMessage(
        "Camera access requires HTTPS on the local network. Open the app using https://192.168.100.154:5173 or https://localhost:5173 and try again.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((error) => {
          if (error?.name !== "AbortError") {
            throw error;
          }
        });
        setCameraActive(true);
        setVerificationStatus("scanning");
        setStatusMessage("Scanning for QR code...");
        setPermissionError(false);
        requestAnimationFrame(scanFrameRef.current);
      }
    } catch (error) {
      console.error("Camera error:", error);
      setPermissionError(true);
      setVerificationStatus("error");
      setStatusMessage("Camera permission denied or unavailable on this device. Please allow access and retry.");
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setVerificationStatus("idle");
    setStatusMessage("");
  }, []);


  const scanFrame = useCallback(() => {
    if (!isScanning || modalOpenRef.current || scanningRef.current) {
      requestAnimationFrame(scanFrameRef.current);
      return;
    }
    if (!videoRef.current || videoRef.current.readyState !== 4) {
      requestAnimationFrame(scanFrameRef.current);
      return;
    }
    if (!window.jsQR) {
      requestAnimationFrame(scanFrameRef.current);
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(imageData.data, imageData.width, imageData.height);

    if (code && code.data && !scanningRef.current && !modalOpenRef.current) {
      if (code.data === lastScannedValue) {
        requestAnimationFrame(scanFrameRef.current);
        return;
      }
      scanningRef.current = true;
      setLastScannedValue(code.data);
      handleScannedValue(code.data);
      return;
    }
    requestAnimationFrame(scanFrameRef.current);
  }, [isScanning, lastScannedValue]);

  scanFrameRef.current = scanFrame;


  const checkDuplicateAttendance = async (memberId) => {
    try {
      const response = await fetch(
        `${API_BASE}/member_api.php?action=get_attendance&member_id=${memberId}`,
      );
      const data = await response.json();
      if (data.success && data.records) {
        const today = new Date().toISOString().split("T")[0];
        return data.records.some((record) => {
          const recordDate = new Date(record.attendance_date)
            .toISOString()
            .split("T")[0];
          return recordDate === today;
        });
      }
      return false;
    } catch (error) {
      console.error("Error checking duplicate attendance:", error);
      return false;
    }
  };


  const fetchCurrentBookedSession = async (memberId) => {
    try {
      const response = await fetch(
        `${API_BASE}/member_api.php?action=get_current_booked_session&member_id=${encodeURIComponent(memberId)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      return data.success ? data.session || null : null;
    } catch (error) {
      console.error("Error fetching current booked session:", error);
      return null;
    }
  };


  const handleScannedValue = useCallback(
    async (value) => {
      if (modalOpenRef.current) {
        scanningRef.current = false;
        return;
      }

      setScanText(value);
      setErrorMessage("");
      setVerificationStatus("verifying");
      setStatusMessage("Verifying member details...");

      if (!value) {
        setErrorMessage("No code detected.");
        setShowErrorModal(true);
        setVerificationStatus("error");
        scanningRef.current = false;
        return;
      }

      let parsed = null;
      try {
        parsed = JSON.parse(value);
      } catch (error) { }

      const memberId =
        parsed?.member_id || parsed?.memberID || parsed?.id || value;
      if (!memberId) {
        setErrorMessage("Invalid QR code.");
        setShowErrorModal(true);
        setVerificationStatus("error");
        scanningRef.current = false;
        return;
      }

      try {
        const isDuplicate = await checkDuplicateAttendance(memberId);

        if (isDuplicate) {
          const memberResponse = await fetch(
            `${API_BASE}/member_api.php?action=get_one&id=${encodeURIComponent(memberId)}`,
          );
          const memberData = await memberResponse.json();
          if (memberData.success) {
            setDuplicateMemberName(memberData.member.full_name);
          }
          setShowDuplicateModal(true);
          setVerificationStatus("verified");
          scanningRef.current = false;
          return;
        }

        const response = await fetch(
          `${API_BASE}/member_api.php?action=get_one&id=${encodeURIComponent(memberId)}`,
        );
        const data = await response.json();
        if (data.success) {
          await fetchAvailableSessions();
          const bookedSession = await fetchCurrentBookedSession(
            data.member.memberID,
          );
          setMember(data.member);
          setCurrentBookedSession(bookedSession);
          const bookedSessionIsValid = isScheduledTrainerSessionValid(bookedSession);
          setSessionSelection(
            bookedSessionIsValid
              ? { [`session_${bookedSession.id}`]: true }
              : { regular: true },
          );
          setVerificationStatus("verified");
          setStatusMessage("Member verified successfully.");
          setShowMemberModal(true);
        } else {
          setErrorMessage(data.message || "Member not found.");
          setShowErrorModal(true);
          setVerificationStatus("error");
          scanningRef.current = false;
        }
      } catch (error) {
        console.error(error);
        setErrorMessage("Unable to verify member.");
        setShowErrorModal(true);
        setVerificationStatus("error");
        scanningRef.current = false;
      }
    },
    [fetchAvailableSessions],
  );


  const handleManualSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!scanText.trim()) {
        setErrorMessage("Please enter a member ID");
        setShowErrorModal(true);
        return;
      }

      if (modalOpenRef.current) return;

      const memberId = scanText.trim();
      setVerificationStatus("verifying");
      setStatusMessage("Verifying member details...");

      try {
        const isDuplicate = await checkDuplicateAttendance(memberId);

        if (isDuplicate) {
          const memberResponse = await fetch(
            `${API_BASE}/member_api.php?action=get_one&id=${encodeURIComponent(memberId)}`,
          );
          const memberData = await memberResponse.json();
          if (memberData.success) {
            setDuplicateMemberName(memberData.member.full_name);
          }
          setShowDuplicateModal(true);
          setVerificationStatus("verified");
          return;
        }

        const response = await fetch(
          `${API_BASE}/member_api.php?action=get_one&id=${encodeURIComponent(memberId)}`,
        );
        const data = await response.json();
        if (data.success) {
          await fetchAvailableSessions();
          const bookedSession = await fetchCurrentBookedSession(
            data.member.memberID,
          );
          setMember(data.member);
          setCurrentBookedSession(bookedSession);
          const bookedSessionIsValid = isScheduledTrainerSessionValid(bookedSession);
          setSessionSelection(
            bookedSessionIsValid
              ? { [`session_${bookedSession.id}`]: true }
              : { regular: true },
          );
          setVerificationStatus("verified");
          setStatusMessage("Member verified successfully.");
          setShowMemberModal(true);
        } else {
          setErrorMessage(data.message || "Member not found.");
          setShowErrorModal(true);
          setVerificationStatus("error");
        }
      } catch (error) {
        console.error(error);
        setErrorMessage("Unable to verify member.");
        setShowErrorModal(true);
        setVerificationStatus("error");
      }
    },
    [scanText, fetchAvailableSessions],
  );


  const handleWalkInSubmit = useCallback(async ({ clientName, clientEmail, paymentMethod }) => {
    setWalkInSubmitting(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const createdBy = Number(user?.adminID || user?.admin_id || user?.id || 0);
      const response = await fetch(`${API_BASE}/member_api.php?action=create_walk_in`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ client_name: clientName, email: clientEmail, payment_method: paymentMethod, created_by: createdBy }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to save walk-in.");
      setShowWalkInModal(false);
      setSuccessMessage(`Walk-in recorded successfully. Payment of ₱${Number(data.amount || 0).toFixed(2)} is pending staff confirmation.`);
      setShowSuccessModal(true);
      addNotification?.("Walk-in Payment", `${clientName}'s walk-in payment is pending confirmation.`, "success");
    } catch (error) {
      console.error("Walk-in error:", error);
      setErrorMessage(error.message || "Unable to save walk-in.");
      setShowErrorModal(true);
    } finally {
      setWalkInSubmitting(false);
    }
  }, [addNotification]);

  const handleSessionToggle = useCallback((key) => {
    setSessionSelection((prev) => {
      if (key === "regular") {
        const next = Object.keys(prev).reduce((acc, currentKey) => {
          if (currentKey !== "regular") {
            acc[currentKey] = false;
          }
          return acc;
        }, {});
        next[key] = !prev[key];
        return next;
      }

      const isSelecting = !prev[key];
      const next = { ...prev };
      Object.keys(next).forEach((currentKey) => {
        if (currentKey !== key) {
          delete next[currentKey];
        }
      });

      if (isSelecting) {
        next[key] = true;
      } else {
        delete next[key];
      }

      return next;
    });
  }, []);



  const bookedSessionIsValid = isScheduledTrainerSessionValid(currentBookedSession);

  const bookedSessionIsToday = bookedSessionIsValid && currentBookedSession?.start_time
    ? (() => {
      const now = new Date();
      const start = new Date(currentBookedSession.start_time);
      const end = new Date(currentBookedSession.end_time);
      return start <= now && now <= end;
    })()
    : false;

  const selectedPaymentItems = bookedSessionIsValid && currentBookedSession
    ? [
      {
        type: "TRAINER_SESSION",
        session_id: Number(currentBookedSession.id),
        label: currentBookedSession.session_type,
        displayAmount: 0,
        existingPaymentId: currentBookedSession.payment_id || null,
        paymentStatus: String(currentBookedSession.payment_status || "").toLowerCase(),
      },
      {
        type: "REGULAR_SESSION",
        label: member?.active_promo_name
          ? `${member.active_promo_name} (Promo until ${member.active_promo_expiration})`
          : "Regular Session",
        displayAmount: member?.active_promo_name ? 0 : regularSessionPrice,
      },
    ]
    : (() => {
        const selectedTrainerItems = Object.entries(sessionSelection)
          .filter(([key, selected]) => selected && key !== "regular")
          .map(([key]) => {
            const session = availableSessions.find(
              (s) => `session_${s.id}` === key,
            );
            return session
              ? {
                type: "TRAINER_SESSION",
                session_id: Number(session.id),
                label: session.session_type,
                displayAmount: Number(session.price || 0),
              }
              : null;
          })
          .filter(Boolean);

        if (selectedTrainerItems.length > 0) {
          return selectedTrainerItems;
        }

        if (sessionSelection.regular) {
          return [{
            type: "REGULAR_SESSION",
            label: member?.active_promo_name
              ? `${member.active_promo_name} (Promo until ${member.active_promo_expiration})`
              : "Regular Session",
            displayAmount: member?.active_promo_name ? 0 : regularSessionPrice,
          }];
        }

        return [{
          type: "REGULAR_SESSION",
          label: member?.active_promo_name
            ? `${member.active_promo_name} (Promo until ${member.active_promo_expiration})`
            : "Regular Session",
          displayAmount: member?.active_promo_name ? 0 : regularSessionPrice,
        }];
      })();

  const effectivePaymentItems = selectedPaymentItems;

  const selectedSessions = effectivePaymentItems.map((item) =>
    item.type === "REGULAR_SESSION" ? (item.label || "Regular Session") : item.label,
  );

  const totalAmount = effectivePaymentItems.reduce(
    (sum, item) =>
      sum +
      (item.type === "REGULAR_SESSION"
        ? (member?.active_promo_name ? 0 : regularSessionPrice)
        : Number(item.displayAmount || 0)),
    0,
  );

  const selectedSessionLabel =
    selectedSessions.length > 0 ? selectedSessions.join(", ") : "None";


  const handleSubmitAttendance = useCallback(async () => {
    if (!member) {
      setErrorMessage("Please verify a member first.");
      setShowErrorModal(true);
      return;
    }

    if (
      selectedPaymentItems.some((item) => item.type === "REGULAR_SESSION") &&
      regularSessionPrice <= 0
    ) {
      setErrorMessage(
        "Regular Session pricing is unavailable. Please refresh the scanner and try again.",
      );
      setShowErrorModal(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${API_BASE}/member_api.php?action=record_attendance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            member_id: member.memberID,
            payment_method: paymentMethod,
            items: effectivePaymentItems.map(
              ({ type, session_id, existingPaymentId }) => ({
                type,
                ...(session_id ? { session_id } : {}),
                ...(existingPaymentId
                  ? { existing_payment_id: existingPaymentId }
                  : {}),
              }),
            ),
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
        setShowMemberModal(false);
        setSuccessMessage(
          `Check-in confirmed successfully for ${member.full_name}!`,
        );
        setShowSuccessModal(true);

        if (addNotification) {
          addNotification(
            "Check-In Confirmed",
            `${member.full_name} checked in successfully`,
            "success",
          );
        }

        setMember(null);
        setCurrentBookedSession(null);
        setScanText("");
        setLastScannedValue("");
        setSessionSelection({});
        setPaymentMethod("Cash");
        scanningRef.current = false;


        fetchSessionBookings();
      } else {
        if (
          data.message &&
          data.message.toLowerCase().includes("already checked in")
        ) {
          setShowMemberModal(false);
          setDuplicateMemberName(member.full_name);
          setShowDuplicateModal(true);
        } else {
          setErrorMessage(data.message || "Unable to save attendance.");
          setShowErrorModal(true);
        }
        scanningRef.current = false;
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Network error.");
      setShowErrorModal(true);
      scanningRef.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    member,
    paymentMethod,
    selectedPaymentItems,
    effectivePaymentItems,
    selectedSessionLabel,
    totalAmount,
    regularSessionPrice,
    currentBookedSession,
    bookedSessionIsToday,
    addNotification,
    fetchSessionBookings,
  ]);


  const closeMemberModal = useCallback(() => {
    setShowMemberModal(false);
    setMember(null);
    setCurrentBookedSession(null);
    setScanText("");
    setLastScannedValue("");
    setSessionSelection({});
    setPaymentMethod("Cash");
    scanningRef.current = false;
    setTimeout(() => {
      if (scanFrameRef.current) {
        requestAnimationFrame(scanFrameRef.current);
      }
    }, 100);
  }, []);


  const closeErrorModal = useCallback(() => {
    setShowErrorModal(false);
    setLastScannedValue("");
    scanningRef.current = false;
    if (scanFrameRef.current) {
      requestAnimationFrame(scanFrameRef.current);
    }
  }, []);


  const getStatusConfig = () => {
    switch (verificationStatus) {
      case "scanning":
        return {
          icon: <ScanLine className="w-4 h-4 text-[#d9a75b] animate-pulse" />,
          label: "Scanner Active",
          text: "Scanning for QR code...",
          color: "text-[#d9a75b]",
          bgColor: "bg-[#d9a75b]/10",
          borderColor: "border-[#d9a75b]/20",
        };
      case "verifying":
        return {
          icon: <Loader2 className="w-4 h-4 text-[#d9a75b] animate-spin" />,
          label: "Processing",
          text: "Verifying member details...",
          color: "text-[#d9a75b]",
          bgColor: "bg-[#a86e2a]/20",
          borderColor: "border-[#d9a75b]/20",
        };
      case "verified":
        return {
          icon: <ShieldCheck className="w-4 h-4 text-[#d9a75b]" />,
          label: "Verified",
          text: "Member verified",
          color: "text-[#d9a75b]",
          bgColor: "bg-[#d9a75b]/10",
          borderColor: "border-[#d9a75b]/20",
        };
      case "error":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-[#D47676]" />,
          label: "Error",
          text: statusMessage || "Error occurred",
          color: "text-[#D47676]",
          bgColor: "bg-[#D47676]/10",
          borderColor: "border-[#D47676]/20",
        };
      default:
        return {
          icon: <ScanLine className="w-4 h-4 text-[#ffffff]" />,
          label: "Status",
          text: "Camera idle",
          color: "text-[#ffffff]",
          bgColor: "bg-[#202020]/50",
          borderColor: "border-[#202020]/50",
        };
    }
  };

  const statusConfig = getStatusConfig();




  return (
    <div className="relative h-[calc(100vh-120px)] w-full">

      <div className="absolute inset-0 bg-black rounded-2xl overflow-hidden border border-[#d9a75b]/20">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {!cameraActive && !permissionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <Loader2 className="w-12 h-12 text-[#d9a75b] animate-spin" />
          </div>
        )}

        {permissionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <button
              onClick={startCamera}
              className="px-6 py-3 bg-[#d9a75b] text-[#121212] rounded-xl font-semibold hover:bg-[#d9a75b] transition-all hover:scale-105"
            >
              Allow Camera Access
            </button>
          </div>
        )}
      </div>


      {cameraActive && (
        <button
          onClick={stopCamera}
          className="absolute bottom-4 right-4 z-20 p-3 rounded-xl bg-black/70 backdrop-blur-md border border-[#d9a75b]/20 text-[#ffffff] hover:bg-black/90 transition-all hover:scale-105"
        >
          <Camera className="w-5 h-5" />
        </button>
      )}


      {!cameraActive && !permissionError && (
        <button
          onClick={startCamera}
          className="absolute bottom-4 right-4 z-20 p-3 rounded-xl bg-black/70 backdrop-blur-md border border-[#d9a75b]/20 text-[#ffffff] hover:bg-black/90 transition-all hover:scale-105"
        >
          <Camera className="w-5 h-5" />
        </button>
      )}


      <div className="absolute top-4 left-4 z-20 w-80">
        <div className="bg-[#000000]/90 backdrop-blur-xl rounded-2xl border border-[#d9a75b]/20 overflow-hidden">
          <button
            onClick={() => setIsManualPanelOpen(!isManualPanelOpen)}
            className="w-full px-4 py-3 bg-[#a86e2a]/20 flex items-center justify-between transition-all hover:bg-[#a86e2a]/30"
          >
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-[#d9a75b]" />
              <span className="text-[#ffffff] font-semibold text-sm">
                Manual Entry
              </span>
            </div>
            {isManualPanelOpen ? (
              <ChevronUp className="w-4 h-4 text-[#ffffff]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#ffffff]" />
            )}
          </button>

          {isManualPanelOpen && (
            <div className="p-4">
              <p className="text-[#ffffff] text-xs mb-3">
                Enter member ID manually if QR scan fails
              </p>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={scanText}
                  onChange={(e) => setScanText(e.target.value)}
                  placeholder="Enter Member ID (e.g., 1, 23, 45)"
                  className="flex-1 rounded-xl border border-[#202020] bg-[#000000]/80 px-3 py-2 text-[#ffffff] text-sm outline-none focus:border-[#d9a75b]/50 transition-all placeholder-[#ffffff]/30"
                />
                <button
                  type="submit"
                  disabled={verificationStatus === "verifying"}
                  className="px-4 py-2 rounded-xl bg-[#d9a75b] text-[#121212] text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {verificationStatus === "verifying" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Verify"
                  )}
                </button>
              </form>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(true)}
                  className="flex-1 py-2 rounded-xl border border-[#d9a75b]/30 bg-[#d9a75b]/10 text-[#d9a75b] text-sm font-semibold hover:bg-[#d9a75b]/20 transition-all"
                >
                  Walk-in
                </button>
              </div>

              <div
                className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border ${statusConfig.borderColor} ${statusConfig.bgColor}`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${verificationStatus === "scanning"
                      ? "bg-emerald-500 animate-pulse"
                      : verificationStatus === "verifying"
                        ? "bg-emerald-500 animate-pulse"
                        : verificationStatus === "verified"
                          ? "bg-emerald-600"
                          : verificationStatus === "error"
                            ? "bg-red-500"
                            : "bg-zinc-700"
                    }`}
                />
                <span className={`text-xs ${statusConfig.color}`}>
                  {verificationStatus === "scanning" &&
                    "Camera is active - scanning for QR codes"}
                  {verificationStatus === "verifying" &&
                    "Verifying member details..."}
                  {verificationStatus === "verified" &&
                    "Member verified - processing complete"}
                  {verificationStatus === "error" &&
                    "An error occurred - ready to retry"}
                  {verificationStatus === "idle" && "Camera is off"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>


      <WalkInModal
        show={showWalkInModal}
        onClose={() => setShowWalkInModal(false)}
        onSubmit={handleWalkInSubmit}
        submitting={walkInSubmitting}
        price={WALK_IN_PRICE}
      />

      <MemberDetailsModal
        show={showMemberModal}
        member={member}
        isSubmitting={isSubmitting}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        sessionSelection={sessionSelection}
        onSessionToggle={handleSessionToggle}
        selectedSessionLabel={selectedSessionLabel}
        totalAmount={totalAmount}
        regularSessionPrice={regularSessionPrice}
        availableSessions={availableSessions}
        loadingSessions={loadingSessions || loadingBookings}
        sessionBookings={sessionBookings}
        currentBookedSession={currentBookedSession}
        onClose={closeMemberModal}
        onSubmit={handleSubmitAttendance}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          setLastScannedValue("");
          scanningRef.current = false;
          if (scanFrameRef.current) {
            requestAnimationFrame(scanFrameRef.current);
          }
        }}
        title="Success"
        message={successMessage}
      />

      <ErrorModalComponent
        show={showErrorModal}
        errorMessage={errorMessage}
        onClose={closeErrorModal}
      />

      <DuplicateCheckInModal
        isOpen={showDuplicateModal}
        onClose={() => {
          setShowDuplicateModal(false);
          setLastScannedValue("");
          scanningRef.current = false;
          if (scanFrameRef.current) {
            requestAnimationFrame(scanFrameRef.current);
          }
        }}
        memberName={duplicateMemberName}
      />
    </div>
  );
}

export default AdminStaffScanner;
