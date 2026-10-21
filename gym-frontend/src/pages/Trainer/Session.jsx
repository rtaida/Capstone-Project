import { useState, useEffect } from "react";
import {
  Clock,
  TrendingUp,
  Activity,
  Star,
  PlusCircle,
  Edit2,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Calendar,
  DollarSign,
  Award,
  CheckCircle2,
  Users,
  Timer,
  CalendarDays,
  Ban,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import SuccessModal from "../../components/memberModal/SuccessModal";
import FeedbackModal from "../../components/memberModal/FeedbackModal";
import NothingChangeModal from "../../components/memberModal/NothingChangeModal";
import ConfirmActionModal from "../../components/ConfirmActionModal";

function TrainerSession() {
  const [sessionType, setSessionType] = useState("Weight Lifting");
  const [sessionDate, setSessionDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [sessions, setSessions] = useState([]);
  const [sessionTypes, setSessionTypes] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditWarningModal, setShowEditWarningModal] = useState(false);
  const [showDeleteWarningModal, setShowDeleteWarningModal] = useState(false);
  const [warningSession, setWarningSession] = useState(null);
  const [warningMessage, setWarningMessage] = useState("");
  const [expandedSessions, setExpandedSessions] = useState({});
  const [bookedMembersCache, setBookedMembersCache] = useState({});
  const [loadingMembers, setLoadingMembers] = useState({});

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [successTitle, setSuccessTitle] = useState("Success");

  const [showNothingChangeModal, setShowNothingChangeModal] = useState(false);
  const [nothingChangeMessage, setNothingChangeMessage] = useState("");
  const [terminateSessionConfirm, setTerminateSessionConfirm] = useState(null);
  const [feedback, setFeedback] = useState({ isOpen: false, type: "error", title: "Error", message: "" });
  const showFeedback = (message, title = "Error") => setFeedback({ isOpen: true, type: "error", title, message });
  const closeFeedback = () => setFeedback((prev) => ({ ...prev, isOpen: false }));

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const trainerId = user?.id;

  const API_URL =
    `${import.meta.env.VITE_API_URL || "/api"}/trainer_api.php`;

  const getAuthHeaders = () => {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("auth_token") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("authToken") ||
      sessionStorage.getItem("auth_token") ||
      "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchSessionTypes = async () => {
    try {
      const response = await fetch(`${API_URL}?action=get_session_catalog`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        const active = (data.session_types || []).filter((item) => {
          const isActive = Number(item.is_active) === 1 || item.is_active === true;
          const normalizedName = String(item.session_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const isSystemType = ["pickleball", "regularsession", "walkinregularsession"].includes(normalizedName);
          return isActive && !isSystemType;
        });
        setSessionTypes(active);
        if (active.length && !active.some((item) => item.session_name === sessionType)) {
          setSessionType(active[0].session_name);
        }
      }
    } catch (error) {
      console.error("Error fetching session types:", error);
    }
  };

  const selectedSessionType = sessionTypes.find((item) => item.session_name === sessionType);
  const selectedSessionPrice = Number(selectedSessionType?.price ?? 0);

  const fetchTrainerSessions = async () => {
    if (!trainerId) {
      console.log("No trainer ID found");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const url = `${API_URL}?action=get_trainer_sessions&trainer_id=${encodeURIComponent(trainerId)}`;
      console.log("Fetching sessions from:", url);

      const response = await fetch(url, { headers: getAuthHeaders() });
      const data = await response.json();
      console.log("API Response:", data);

      if (data.success) {
        setSessions(data.sessions || []);
        
        data.sessions?.forEach(session => {
          fetchBookedMembers(session.id);
        });
      } else {
        showFeedback(data.message || "Unable to load sessions.", "Unable to Load Sessions");
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
      showFeedback("Network error while loading trainer sessions.", "Unable to Load Sessions");
    } finally {
      setLoading(false);
    }
  };

  
  const fetchBookedMembers = async (sessionId) => {
    if (bookedMembersCache[sessionId]) return; 

    setLoadingMembers(prev => ({ ...prev, [sessionId]: true }));

    try {
      const response = await fetch(
        `${API_URL}?action=get_session_booked_members&session_id=${sessionId}`,
        { headers: getAuthHeaders() },
      );
      const data = await response.json();

      if (data.success) {
        setBookedMembersCache(prev => ({
          ...prev,
          [sessionId]: {
            members: data.members || [],
            total: data.total || 0
          }
        }));
      }
    } catch (error) {
      console.error("Error fetching booked members:", error);
    } finally {
      setLoadingMembers(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const checkSessionBookings = async (sessionId) => {
    try {
      const response = await fetch(
        `${API_URL}?action=get_session_booked_members&session_id=${sessionId}`,
        { headers: getAuthHeaders() },
      );
      const data = await response.json();
      return data.success ? (data.total || 0) : 0;
    } catch (error) {
      console.error("Error checking bookings:", error);
      return 0;
    }
  };

  useEffect(() => {
    fetchSessionTypes();
    fetchTrainerSessions();
  }, [trainerId]);

  const toggleExpand = (sessionId) => {
    setExpandedSessions(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
    
    if (!expandedSessions[sessionId] && !bookedMembersCache[sessionId]) {
      fetchBookedMembers(sessionId);
    }
  };

  const checkIfChangesMade = () => {
    if (!editingSession) return false;

    const originalStartDateTime = new Date(editingSession.start_time);
    const originalDate = originalStartDateTime.toISOString().split("T")[0];
    const originalStartTime = originalStartDateTime.toTimeString().slice(0, 5);
    const originalEndTime = new Date(editingSession.end_time)
      .toTimeString()
      .slice(0, 5);

    const hasChanges =
      sessionType !== (editingSession.session_type || "") ||
      sessionDate !== originalDate ||
      startTime !== originalStartTime ||
      endTime !== originalEndTime ||
      Number(maxParticipants) !== Number(editingSession.max_participants || 1);

    return hasChanges;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!trainerId) {
      showFeedback("Trainer login required.", "Authentication Required");
      return;
    }

    if (!sessionDate || !startTime || !endTime) {
      showFeedback("Please select date, start time, and end time.", "Missing Session Details");
      return;
    }

    if (!Number.isInteger(Number(maxParticipants)) || Number(maxParticipants) < 1) {
      showFeedback("Max participants must be a whole number of at least 1.", "Invalid Participant Limit");
      return;
    }

    if (startTime >= endTime) {
      showFeedback("End time must be after start time.", "Invalid Session Time");
      return;
    }

    const startDateTime = `${sessionDate} ${startTime}:00`;
    const endDateTime = `${sessionDate} ${endTime}:00`;
    const now = new Date();
    if (new Date(startDateTime) <= now || new Date(endDateTime) <= now) {
      showFeedback("The selected time/date has already passed. Please create another session.", "Past Session Time");
      return;
    }

    const payload = {
      trainer_id: trainerId,
      session_type: sessionType,
      start_time: startDateTime,
      end_time: endDateTime,
      price: selectedSessionPrice,
      max_participants: Number(maxParticipants),
    };

    try {
      const response = await fetch(`${API_URL}?action=create_trainer_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.success) {
        resetForm();
        fetchTrainerSessions();
        setSuccessTitle("Session Created");
        setSuccessMessage(
          `"${sessionType}" session has been created and is waiting for admin approval!`,
        );
        setShowSuccessModal(true);
      } else {
        showFeedback(data.message || "Unable to create session.", "Session Creation Failed");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error(error);
      showFeedback("Network error while creating session.", "Session Creation Failed");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleEditClick = async (session) => {
    const bookingCount = await checkSessionBookings(session.id);

    if (bookingCount > 0) {
      setWarningSession(session);
      setWarningMessage(
        `This session has ${bookingCount} member(s) booked. You cannot edit it because members have already signed up.`,
      );
      setShowEditWarningModal(true);
      return;
    }

    setIsEditing(true);
    setEditingSession(session);

    const startDateTime = new Date(session.start_time);
    const sessionDateValue = startDateTime.toISOString().split("T")[0];
    const startTimeValue = startDateTime.toTimeString().slice(0, 5);
    const endTimeValue = new Date(session.end_time).toTimeString().slice(0, 5);

    setSessionType(session.session_type);
    setSessionDate(sessionDateValue);
    setStartTime(startTimeValue);
    setEndTime(endTimeValue);
    setMaxParticipants(Number(session.max_participants || 1));

    document
      .getElementById("create-form")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDeleteClick = async (session) => {
    const bookingCount = await checkSessionBookings(session.id);

    if (bookingCount > 0) {
      setWarningSession(session);
      setWarningMessage(
        `This session has ${bookingCount} member(s) booked. You cannot delete it because members have already signed up.`,
      );
      setShowDeleteWarningModal(true);
      return;
    }

    setDeleteConfirm(session);
    setShowDeleteModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!trainerId) {
      showFeedback("Trainer login required.", "Authentication Required");
      return;
    }

    if (!sessionDate || !startTime || !endTime) {
      showFeedback("Please select date, start time, and end time.", "Missing Session Details");
      return;
    }

    if (!Number.isInteger(Number(maxParticipants)) || Number(maxParticipants) < 1) {
      showFeedback("Max participants must be a whole number of at least 1.", "Invalid Participant Limit");
      return;
    }

    if (startTime >= endTime) {
      showFeedback("End time must be after start time.", "Invalid Session Time");
      return;
    }

    const startDateTime = `${sessionDate} ${startTime}:00`;
    const endDateTime = `${sessionDate} ${endTime}:00`;
    const now = new Date();
    if (new Date(startDateTime) <= now || new Date(endDateTime) <= now) {
      showFeedback("The selected time/date has already passed. Please create another session.", "Past Session Time");
      return;
    }

    if (!checkIfChangesMade()) {
      resetForm();
      setNothingChangeMessage("No changes were made to the session.");
      setShowNothingChangeModal(true);
      return;
    }

    const payload = {
      session_id: editingSession.id,
      trainer_id: trainerId,
      session_type: sessionType,
      start_time: startDateTime,
      end_time: endDateTime,
      price: selectedSessionPrice,
      max_participants: Number(maxParticipants),
    };

    try {
      const response = await fetch(`${API_URL}?action=update_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.success) {
        resetForm();
        fetchTrainerSessions();
        setSuccessTitle("Session Updated");
        setSuccessMessage(
          `"${sessionType}" session has been updated successfully!`,
        );
        setShowSuccessModal(true);
      } else {
        showFeedback(data.message || "Unable to update session.", "Session Update Failed");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error(error);
      showFeedback("Network error while updating session.", "Session Update Failed");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_URL}?action=delete_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ session_id: deleteConfirm.id }),
      });
      const data = await response.json();
      if (data.success) {
        setShowDeleteModal(false);
        setDeleteConfirm(null);
        fetchTrainerSessions();
        setSuccessTitle("Session Deleted");
        setSuccessMessage(
          `"${deleteConfirm.session_type}" session has been deleted successfully!`,
        );
        setShowSuccessModal(true);
      } else {
        showFeedback(data.message || "Unable to delete session.", "Session Deletion Failed");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error(error);
      showFeedback("Network error while deleting session.", "Session Deletion Failed");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  const updateSessionStatus = async (session, action) => {
    if (action === "trainer_terminate_session") {
      const status = String(session?.status || "").toLowerCase();
      setTerminateSessionConfirm({
        session,
        title: "Terminate Booking?",
        message: status === "ongoing"
          ? "This session has already started. This will cancel the booking and mark the session as terminated."
          : "This session has not started yet. This will cancel the booking and mark the session as terminated.",
      });
      return;
    }

    const reason = action === "finish_session"
      ? "Session ended earlier than the scheduled time."
      : "Session started by trainer.";

    try {
      const response = await fetch(`${API_URL}?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          session_id: session.id,
          reason,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update session status.");
      }
      await fetchTrainerSessions();
      const actionTitle = action === "start_session"
        ? "Session Started"
        : action === "finish_session"
          ? "Session Finished"
          : "Session Terminated";
      setSuccessTitle(actionTitle);
      setSuccessMessage(data.message);
      setShowSuccessModal(true);
    } catch (error) {
      showFeedback(error.message || "Unable to update session status.", "Session Status Failed");
    }
  };

  const confirmTerminateSession = async () => {
    if (!terminateSessionConfirm?.session) return;

    const session = terminateSessionConfirm.session;
    const reason = "Terminated by trainer.";

    try {
      const response = await fetch(`${API_URL}?action=trainer_terminate_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          session_id: session.id,
          reason,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to terminate session.");
      }
      setTerminateSessionConfirm(null);
      await fetchTrainerSessions();
      setSuccessTitle("Session Terminated");
      setSuccessMessage(data.message);
      setShowSuccessModal(true);
    } catch (error) {
      setTerminateSessionConfirm(null);
      showFeedback(error.message || "Unable to terminate session.", "Session Termination Failed");
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingSession(null);
    setSessionType("Weight Lifting");
    setSessionDate("");
    setStartTime("");
    setEndTime("");
    setMaxParticipants("");
  };

  const cancelEdit = () => {
    resetForm();
  };

  
  const completedRatings = sessions.filter(
    (session) => Number(session.rating || 0) > 0,
  );

  const isUpcoming = (startTime) => {
    return new Date(startTime) > new Date();
  };

  const isSessionEnded = (session) => {
    const now = new Date();
    const end = new Date(session?.end_time || 0);
    return !Number.isNaN(end.getTime()) && now >= end;
  };

  const isSessionOngoing = (session) => {
    const now = new Date();
    const start = new Date(session?.start_time || 0);
    const end = new Date(session?.end_time || 0);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= now && now <= end;
  };

  const isWithinSessionGracePeriod = (session) => {
    const end = new Date(session?.end_time || 0);
    return !Number.isNaN(end.getTime()) && new Date() <= new Date(end.getTime() + 3 * 60 * 60 * 1000);
  };

  function isSessionVisibleInMySessions(session) {
    const status = String(session?.status || "").toLowerCase();
    if (status === "pending") return true;
    if (status === "finished" || status === "terminated" || status === "rejected") return false;
    if (status === "approved") {
      return !isSessionEnded(session) && isWithinSessionGracePeriod(session);
    }
    if (status === "ongoing") return !isSessionEnded(session) && isWithinSessionGracePeriod(session);
    return false;
  }

  const visibleSessions = (sessions || []).filter((session) => isSessionVisibleInMySessions(session));

  const formatDateTime = (datetime) => {
    if (!datetime) return "N/A";
    const date = new Date(datetime);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (datetime) => {
    if (!datetime) return "N/A";
    const date = new Date(datetime);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getSessionStatus = (session) => {
    const status = String(session?.status || "").toLowerCase();

    if (["terminated", "finished", "rejected"].includes(status)) return status;
    if (status === "pending") return "pending";
    if (isSessionEnded(session)) return "finished";
    if (isSessionOngoing(session)) return "ongoing";
    return "approved";
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "terminated":
        return {
          text: "Terminated",
          color: "bg-red-500/15 text-red-300 border border-red-500/20",
          icon: <X className="w-3 h-3" />,
        };
      case "rejected":
        return {
          text: "Rejected",
          color: "bg-red-500/15 text-red-300 border border-red-500/20",
          icon: <X className="w-3 h-3" />,
        };
      case "pending":
        return {
          text: "Pending",
          color: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/20",
          icon: <Clock className="w-3 h-3" />,
        };
      case "ongoing":
        return {
          text: "Ongoing",
          color: "bg-blue-500/15 text-blue-300 border border-blue-500/20",
          icon: <Activity className="w-3 h-3" />,
        };
      case "approved":
        return {
          text: "Approved",
          color: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
          icon: <CheckCircle2 className="w-3 h-3" />,
        };
      case "finished":
        return {
          text: "Finished",
          color: "bg-zinc-500/15 text-zinc-300 border border-zinc-500/20",
          icon: <CheckCircle2 className="w-3 h-3" />,
        };
      default:
        return {
          text: "Approved",
          color: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
          icon: <CheckCircle2 className="w-3 h-3" />,
        };
    }
  };

  
  const EditWarningModal = () => {
    if (!showEditWarningModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
          onClick={() => setShowEditWarningModal(false)}
        />
        <div className="relative bg-[#111111] border border-amber-500/30 rounded-2xl w-full max-w-md shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between px-6 py-4 border-b border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Ban className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-white text-lg font-semibold">
                Cannot Edit Session
              </h2>
            </div>
            <button
              onClick={() => setShowEditWarningModal(false)}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-6 py-6 text-center">
            <Users className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <p className="text-zinc-300 mb-2">
              This session has members who have already booked it.
            </p>
            <p className="text-amber-400 text-sm font-semibold">
              {warningSession?.session_type}
            </p>
            <p className="text-zinc-500 text-xs mt-2">{warningMessage}</p>
          </div>
          <div className="px-6 py-4 border-t border-amber-500/20">
            <button
              onClick={() => setShowEditWarningModal(false)}
              className="w-full py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  };

  const DeleteWarningModal = () => {
    if (!showDeleteWarningModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
          onClick={() => setShowDeleteWarningModal(false)}
        />
        <div className="relative bg-[#111111] border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between px-6 py-4 border-b border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <Ban className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-white text-lg font-semibold">
                Cannot Delete Session
              </h2>
            </div>
            <button
              onClick={() => setShowDeleteWarningModal(false)}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-6 py-6 text-center">
            <Users className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-zinc-300 mb-2">
              This session has members who have already booked it.
            </p>
            <p className="text-red-400 text-sm font-semibold">
              {warningSession?.session_type}
            </p>
            <p className="text-zinc-500 text-xs mt-2">{warningMessage}</p>
          </div>
          <div className="px-6 py-4 border-t border-red-500/20">
            <button
              onClick={() => setShowDeleteWarningModal(false)}
              className="w-full py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  };

  const DeleteModal = () => {
    if (!showDeleteModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
          onClick={() => setShowDeleteModal(false)}
        />
        <div className="relative bg-[#111111] border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between px-6 py-4 border-b border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-white text-lg font-semibold">
                Delete Session
              </h2>
            </div>
            <button
              onClick={() => setShowDeleteModal(false)}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-6 py-6 text-center">
            <Trash2 className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-zinc-300 mb-2">
              Are you sure you want to delete this session?
            </p>
            <p className="text-red-400 text-sm font-semibold">
              {deleteConfirm?.session_type}
            </p>
            <p className="text-zinc-500 text-xs mt-2">
              {formatDateTime(deleteConfirm?.start_time)} at{" "}
              {formatTime(deleteConfirm?.start_time)}
            </p>
          </div>
          <div className="px-6 py-4 border-t border-red-500/20 flex gap-3">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="flex-1 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <FeedbackModal
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={closeFeedback}
      />
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successTitle}
        message={successMessage}
      />

      <NothingChangeModal
        isOpen={showNothingChangeModal}
        onClose={() => setShowNothingChangeModal(false)}
        onConfirm={() => setShowNothingChangeModal(false)}
      />

      <ConfirmActionModal
        isOpen={Boolean(terminateSessionConfirm)}
        title={terminateSessionConfirm?.title || "Terminate Booking?"}
        message={terminateSessionConfirm?.message || "This will cancel the booking and mark the session as terminated."}
        confirmLabel="Terminate"
        onConfirm={confirmTerminateSession}
        onClose={() => setTerminateSessionConfirm(null)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Trainer Sessions</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Create sessions - they will be reviewed by admin before going live
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div
          className="rounded-3xl bg-black/40 backdrop-blur-md border border-classic-gold/10 p-6"
          id="create-form"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-lg font-semibold">
              {isEditing ? "Edit Session" : "Create a New Session"}
            </h3>
            {isEditing && (
              <button
                onClick={cancelEdit}
                className="text-zinc-400 hover:text-white transition-colors text-sm flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Cancel Edit
              </button>
            )}
          </div>
          <form
            onSubmit={isEditing ? handleUpdate : handleSubmit}
            className="space-y-4"
          >
            <div>
              <label className="block text-zinc-300 mb-2">
                Session Category
              </label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                className="w-full rounded-3xl border border-zinc-700 bg-black/60 px-4 py-3 text-white outline-none focus:border-classic-gold transition-all"
              >
                {sessionTypes.map((item) => (
                  <option key={item.id} value={item.session_name}>
                    {item.session_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-300 mb-2">Session Date</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full rounded-3xl border border-zinc-700 bg-black/60 px-4 py-3 text-white outline-none focus:border-classic-gold transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-300 mb-2">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-3xl border border-zinc-700 bg-black/60 px-4 py-3 text-white outline-none focus:border-classic-gold transition-all"
                />
              </div>
              <div>
                <label className="block text-zinc-300 mb-2">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-3xl border border-zinc-700 bg-black/60 px-4 py-3 text-white outline-none focus:border-classic-gold transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-300 mb-2">Max Participants</label>
              <input
                required
                type="number"
                min="1"
                step="1"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                className="w-full rounded-3xl border border-zinc-700 bg-black/60 px-4 py-3 text-white outline-none focus:border-classic-gold transition-all"
              />
            </div>

            <div className="rounded-3xl bg-gradient-to-r from-classic-gold/10 to-transparent border border-classic-gold/20 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Session price</span>
                <span className="font-semibold text-classic-gold text-lg">
                  ₱{selectedSessionPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-zinc-400">Duration</span>
                <span className="font-semibold text-white">
                  {startTime && endTime
                    ? `${((new Date(`2000-01-01 ${endTime}`) - new Date(`2000-01-01 ${startTime}`)) / 3600000).toFixed(1)} hours`
                    : "Not set"}
                </span>
              </div>
            </div>

            {message && (
              <div
                className={`text-sm p-3 rounded-2xl ${
                  message.includes("successfully")
                    ? "bg-green-500/20 text-green-400 border border-green-500/20"
                    : "bg-red-500/20 text-red-400 border border-red-500/20"
                }`}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-classic-gold to-yellow-500 px-6 py-3 text-sm font-semibold text-black transition-all hover:scale-105 transform duration-200 shadow-lg shadow-classic-gold/20"
            >
              {isEditing ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Update Session
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  Create Session
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      
      <div className="rounded-3xl bg-black/40 backdrop-blur-md border border-classic-gold/10 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white text-lg font-semibold">My Sessions</h2>
            <p className="text-zinc-400 text-sm">
              Active sessions - {visibleSessions.length} session
              {visibleSessions.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Activity className="w-5 h-5 text-classic-gold" />
        </div>

        {loading ? (
          <div className="rounded-3xl border border-classic-gold/10 bg-zinc-950/60 p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-classic-gold" />
            <div className="text-zinc-400">Loading sessions...</div>
          </div>
        ) : visibleSessions.length === 0 ? (
          <div className="rounded-3xl border border-classic-gold/10 bg-zinc-950/60 p-12 text-center">
            <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No active sessions yet.</p>
            <p className="text-zinc-500 text-sm mt-1">
              Create your first session above or check the History tab.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleSessions.map((sessionItem) => {
              const status = getSessionStatus(sessionItem);
              const statusBadge = getStatusBadge(status);
              const isExpanded = expandedSessions[sessionItem.id] || false;
              const bookedData = bookedMembersCache[sessionItem.id];
              const isLoadingMembers = loadingMembers[sessionItem.id] || false;
              const hasBookings = bookedData && bookedData.total > 0;

              return (
                <div
                  key={sessionItem.id}
                  className="group relative bg-gradient-to-br from-zinc-900/80 to-black/80 rounded-2xl border border-classic-gold/10 overflow-hidden hover:border-classic-gold/30 transition-all duration-300 hover:shadow-xl hover:shadow-classic-gold/5 hover:-translate-y-1"
                >
                  
                  <div className="absolute top-4 right-4 z-10 flex flex-wrap items-center justify-end gap-1.5 max-w-[70%]">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${statusBadge.color}`}
                    >
                      <span className="flex items-center justify-center">{statusBadge.icon}</span>
                      {statusBadge.text}
                    </span>
                  </div>

                  
                  <div className="p-5 pb-3 border-b border-classic-gold/10 bg-gradient-to-r from-classic-gold/5 to-transparent">
                    <h3 className="text-white font-bold text-xl flex items-center gap-2">
                      {sessionItem.session_type}
                    </h3>
                  </div>

                  
                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-classic-gold/10 flex items-center justify-center flex-shrink-0">
                        <CalendarDays className="w-4 h-4 text-classic-gold" />
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Date</p>
                        <p className="text-white font-medium">
                          {formatDateTime(sessionItem.start_time)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-classic-gold/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-classic-gold" />
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Time</p>
                        <p className="text-white font-medium">
                          {formatTime(sessionItem.start_time)} -{" "}
                          {formatTime(sessionItem.end_time)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-classic-gold/10 flex items-center justify-center flex-shrink-0">
                        <Timer className="w-4 h-4 text-classic-gold" />
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Duration</p>
                        <p className="text-white font-medium">
                          {(
                            (new Date(sessionItem.end_time) -
                              new Date(sessionItem.start_time)) /
                            3600000
                          ).toFixed(1)}{" "}
                          hours
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-classic-gold/10 flex items-center justify-center flex-shrink-0">
                        <DollarSign className="w-4 h-4 text-classic-gold" />
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Price</p>
                        <p className="text-classic-gold font-bold text-lg">
                          ₱{Number(sessionItem.price).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <Star className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Rating</p>
                        {sessionItem.rating ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="text-white font-semibold">
                                {sessionItem.rating}
                              </span>
                              <span className="text-zinc-500 text-xs">/ 5</span>
                              <div className="flex items-center gap-0.5 ml-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-3 h-3 ${
                                      i < Math.floor(sessionItem.rating)
                                        ? "text-amber-400 fill-amber-400"
                                        : "text-zinc-600"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            {sessionItem.rated_by && (
                              <p className="text-zinc-500 text-xs mt-0.5">
                                Rated by: <span className="text-zinc-300">{sessionItem.rated_by}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-zinc-500 text-sm italic">Not yet rated</p>
                        )}
                      </div>
                    </div>
                  </div>

                  
                  {status !== "terminated" &&
                    status !== "rejected" &&
                    isUpcoming(sessionItem.start_time) &&
                    (sessionItem.status === "pending" || sessionItem.status === "approved") && (
                      <div className="px-5 py-4 border-t border-classic-gold/10 bg-black/40 flex gap-2">
                        <button
                          onClick={() => handleEditClick(sessionItem)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all text-sm font-medium hover:scale-105"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        {sessionItem.status === "pending" && (
                          <button
                            onClick={() => handleDeleteClick(sessionItem)}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all text-sm font-medium hover:scale-105"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    )}

                  {String(sessionItem.status || "").toLowerCase() === "approved" && isSessionOngoing(sessionItem) && (
                    <div className="px-5 py-4 border-t border-classic-gold/10 bg-black/40">
                      <button
                        onClick={() => updateSessionStatus(sessionItem, "start_session")}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 transition-all text-sm font-semibold"
                      >
                        <Activity className="w-4 h-4" />
                        Start Session
                      </button>
                    </div>
                  )}

                  {(status === "ongoing" || status === "approved") && (
                    <div className="px-5 py-4 border-t border-classic-gold/10 bg-black/40 space-y-2">
                      {status === "ongoing" && (
                        <button
                          onClick={() => updateSessionStatus(sessionItem, "finish_session")}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-all text-sm font-semibold"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Session Finished
                        </button>
                      )}
                      <button
                        onClick={() => updateSessionStatus(sessionItem, "trainer_terminate_session")}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 transition-all text-sm font-semibold"
                      >
                        <Ban className="w-4 h-4" />
                        Terminate Session
                      </button>
                    </div>
                  )}

                  
                  {status !== "terminated" &&
                    (isUpcoming(sessionItem.start_time) || isSessionOngoing(sessionItem)) &&
                    sessionItem.status === "approved" && (
                      <div className="px-5 py-3 border-t border-classic-gold/10 bg-green-500/5">
                        <p className="text-center text-green-400 text-xs font-medium">
                          {status === "ongoing"
                            ? "Session is ongoing."
                            : "Session approved and live! Members can now book."}
                        </p>
                      </div>
                    )}

                  
                  {status !== "terminated" &&
                    status !== "rejected" &&
                    isUpcoming(sessionItem.start_time) &&
                    sessionItem.status === "pending" && (
                      <div className="px-5 py-3 border-t border-classic-gold/10 bg-yellow-500/5">
                        <p className="flex items-center justify-center gap-1.5 text-yellow-400 text-xs font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          Waiting for admin approval...
                        </p>
                      </div>
                    )}

                  
                  {status === "rejected" && (
                    <div className="px-5 py-3 border-t border-classic-gold/10 bg-red-500/5">
                      <p className="text-center text-red-400 text-xs">
                        ❌ <span className="font-medium">Rejected:</span>{" "}
                        {sessionItem.admin_notes ||
                          "No reason provided by admin."}
                      </p>
                    </div>
                  )}

                  
                  {status === "terminated" && (
                    <div className="px-5 py-3 border-t border-red-500/10 bg-red-500/5">
                      <p className="text-center text-red-400 text-xs font-medium">
                        ✕ This session was terminated and is no longer available for booking.
                      </p>
                    </div>
                  )}

                  
                  {status !== "terminated" &&
                    !isUpcoming(sessionItem.start_time) &&
                    sessionItem.rating && (
                    <div className="px-5 py-3 border-t border-classic-gold/10 bg-black/40">
                      <p className="text-center text-zinc-500 text-xs">
                        ✓ Session completed with client feedback
                        {sessionItem.rated_by && (
                          <span className="text-classic-gold ml-1">
                            from {sessionItem.rated_by}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      
      <EditWarningModal />
      <DeleteWarningModal />
      <DeleteModal />
    </div>
  );
}

export default TrainerSession;