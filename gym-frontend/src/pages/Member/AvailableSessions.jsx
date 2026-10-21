import FeedbackModal from "../../components/memberModal/FeedbackModal";
import { getAuthHeaders } from "../../services/api";
import { useState, useEffect, useRef } from "react";
import {
  Calendar,
  Clock,
  User,
  Users,
  Star,
  Bookmark,
  CheckCircle,
  X,
  Loader2,
  AlertCircle,
  Timer,
} from "lucide-react";

function AvailableSessions() {
  const [sessions, setSessions] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [feedback, setFeedback] = useState({ isOpen: false, type: "success", title: "", message: "" });

  const showFeedback = (type, message, title) => setFeedback({ isOpen: true, type, message, title: title || (type === "success" ? "Success" : "Error") });
  const closeFeedback = () => setFeedback((prev) => ({ ...prev, isOpen: false }));
  const [activeTab, setActiveTab] = useState("available");
  const [showRatingModal, setShowRatingModal] = useState(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [terminationLoading, setTerminationLoading] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const availableControllerRef = useRef(null);
  const mySessionsControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const mySessionIdsRef = useRef(new Set());

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const memberId = user?.memberID || user?.id;
  const API_BASE = import.meta.env.VITE_API_URL || "/api";

  
  const fetchAvailableSessions = async () => {
    availableControllerRef.current?.abort();
    const controller = new AbortController();
    availableControllerRef.current = controller;
    try {
      const response = await fetch(
        `${API_BASE}/trainer_api.php?action=get_available_sessions`,
        { headers: getAuthHeaders(), signal: controller.signal },
      );
      const data = await response.json();
      if (data.success && isMountedRef.current) {
        const available = (data.sessions || []).filter((s) => {
          const bookingCount = Number(s.booking_count || 0);
          const maxParticipants = Number(s.max_participants || 1);
          const isFull = bookingCount >= maxParticipants;
          const isAlreadyBooked = mySessionIdsRef.current.has(Number(s.id));
          return !isFull && !isAlreadyBooked;
        });
        setSessions(available);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Error fetching sessions:", error);
      }
    }
  };

  
  const fetchMySessions = async () => {
    if (!memberId) return;
    mySessionsControllerRef.current?.abort();
    const controller = new AbortController();
    mySessionsControllerRef.current = controller;
    try {
      const response = await fetch(
        `${API_BASE}/trainer_api.php?action=get_my_sessions&member_id=${encodeURIComponent(memberId)}&member_email=${encodeURIComponent(user?.email || "")}`,
        { headers: getAuthHeaders(), signal: controller.signal, cache: "no-store" },
      );
      const data = await response.json();
      if (data.success && isMountedRef.current) {
        const mySessionsList = data.sessions || [];
        mySessionIdsRef.current = new Set(mySessionsList.map((session) => Number(session.id)));
        setMySessions(mySessionsList);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Error fetching my sessions:", error);
      }
    }
  };

  
  const bookSession = async (sessionId) => {
    if (!memberId) {
      setMessageType("error");
      setMessage("Please login as a member to book sessions");
      return;
    }

    setBookingLoading(true);
    setMessage("");
    setMessageType("");

    try {
      
      const syncResponse = await fetch(
        `${API_BASE}/member_api.php?action=sync_member&id=${encodeURIComponent(memberId || 0)}&email=${encodeURIComponent(user?.email || "")}`,
        { headers: getAuthHeaders(), cache: "no-store" }
      );
      const syncData = await syncResponse.json();
      const canonicalMemberId = Number(syncData?.member?.memberID || memberId);

      if (syncData?.success && syncData.member) {
        const syncedUser = {
          ...user,
          id: canonicalMemberId,
          memberID: canonicalMemberId,
          fullName: syncData.member.full_name,
          email: syncData.member.email,
        };
        localStorage.setItem("user", JSON.stringify(syncedUser));
      }

      const response = await fetch(
        `${API_BASE}/trainer_api.php?action=book_session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            member_id: canonicalMemberId,
            member_email: user?.email || "",
            session_id: sessionId,
            member_name: user?.fullName || user?.name || "Member",
          }),
        },
      );
      const data = await response.json();
      if (data.success) {
        
        
        if (data.member_id && Number(data.member_id) !== Number(memberId)) {
          const refreshedUser = { ...user, id: Number(data.member_id), memberID: Number(data.member_id) };
          localStorage.setItem("user", JSON.stringify(refreshedUser));
        }
        showFeedback("success", "Session booked successfully! Payment will be recorded when you check in during the scheduled session.", "Session Booked");
        await Promise.all([fetchAvailableSessions(), fetchMySessions()]);
      } else {
        showFeedback("error", data.message || "Unable to book session", "Booking Failed");
      }
    } catch (error) {
      console.error(error);
      showFeedback("error", "Network error while booking session.", "Booking Failed");
    } finally {
      setBookingLoading(false);
      setTimeout(() => {
        setMessage("");
        setMessageType("");
      }, 3000);
    }
  };

  
  
  const terminateSession = async (session) => {
    if (!memberId) {
      showFeedback("error", "Please login as a member to terminate a session.", "Termination Failed");
      return;
    }

    if (!session?.id) return;

    const confirmed = window.confirm(
      `Terminate your ${session.session_type} session on ${formatDate(session.start_time)} at ${formatTime(session.start_time)}?\n\nThis will cancel your booking and void its pending payment. This action cannot be undone.`
    );
    if (!confirmed) return;

    setTerminationLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch(
        `${API_BASE}/trainer_api.php?action=terminate_session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            actor_role: "member",
            member_id: memberId,
            member_email: user?.email || "",
            session_id: session.id,
            reason: "Member terminated the booked session before start.",
          }),
        },
      );

      const data = await response.json();
      if (data.success) {
        showFeedback("success", data.message || "Session terminated successfully.", "Session Terminated");
        await Promise.all([fetchMySessions(), fetchAvailableSessions()]);
      } else {
        showFeedback("error", data.message || "Unable to terminate session.", "Termination Failed");
      }
    } catch (error) {
      console.error("Terminate session error:", error);
      showFeedback("error", "Network error while terminating session.", "Termination Failed");
    } finally {
      setTerminationLoading(false);
      setTimeout(() => {
        setMessage("");
        setMessageType("");
      }, 4000);
    }
  };

  
  const rateSession = async (sessionId) => {
    if (!memberId) {
      showFeedback("error", "Please login to rate sessions.", "Rating Failed");
      return;
    }

    if (selectedRating === 0) {
      showFeedback("error", "Please select a rating.", "Rating Required");
      return;
    }

    setRatingLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch(
        `${API_BASE}/trainer_api.php?action=rate_session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            member_id: memberId,
            member_email: user?.email || "",
            session_id: sessionId,
            rating: selectedRating,
          }),
        },
      );
      const data = await response.json();
      if (data.success) {
        showFeedback("success", "Rating submitted successfully! Thank you for your feedback!", "Rating Submitted");
        setShowRatingModal(null);
        setSelectedRating(0);
        setHoverRating(0);
        await Promise.all([fetchMySessions(), fetchAvailableSessions()]);
      } else {
        showFeedback("error", data.message || "Unable to submit rating", "Rating Failed");
      }
    } catch (error) {
      console.error(error);
      showFeedback("error", "Network error while submitting rating.", "Rating Failed");
    } finally {
      setRatingLoading(false);
      setTimeout(() => {
        setMessage("");
        setMessageType("");
      }, 3000);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    const loadingTimer = setTimeout(() => {
      if (isMountedRef.current) setLoading(true);
    }, 0);
    Promise.all([fetchAvailableSessions(), fetchMySessions()]).finally(() =>
      isMountedRef.current && setLoading(false),
    );
    return () => {
      isMountedRef.current = false;
      clearTimeout(loadingTimer);
      availableControllerRef.current?.abort();
      mySessionsControllerRef.current?.abort();
    };
  }, [memberId]);

  const formatDate = (datetime) => {
    if (!datetime) return "N/A";
    return new Date(datetime).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (datetime) => {
    if (!datetime) return "N/A";
    return new Date(datetime).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (durationMinutes) => {
    const minutes = Number(durationMinutes || 0);
    if (minutes <= 0) return "N/A";
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (!hours) return `${remainder} min`;
    return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
  };

  const isSessionCompleted = (endTime, status) => {
    const normalizedStatus = String(status || "").toLowerCase();
    if (normalizedStatus === "finished" || normalizedStatus === "completed") {
      return true;
    }
    return new Date(endTime) < new Date();
  };

  const isSessionOngoing = (startTime, endTime, status) => {
    const normalizedStatus = String(status || "").toLowerCase();
    if (normalizedStatus === "ongoing") {
      return true;
    }

    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);
    return start <= now && now <= end;
  };

  const isSessionUpcoming = (startTime, status) => {
    const normalizedStatus = String(status || "").toLowerCase();
    if (normalizedStatus === "terminated") return false;
    if (normalizedStatus === "approved" || normalizedStatus === "pending") {
      return new Date(startTime) > new Date();
    }
    return new Date(startTime) > new Date();
  };

  const getSessionStatus = (session) => {
    if (!session?.start_time || !session?.end_time) return "upcoming";
    const normalizedStatus = String(session.status || "").toLowerCase();

    if (normalizedStatus === "finished" || normalizedStatus === "completed") return "completed";
    if (normalizedStatus === "ongoing") return "ongoing";
    if (normalizedStatus === "terminated") return "terminated";

    if (isSessionCompleted(session.end_time, session.status)) return "completed";
    if (isSessionOngoing(session.start_time, session.end_time, session.status)) return "ongoing";
    return "upcoming";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-zinc-800/60 rounded-lg mb-4" />
          <div className="h-4 w-64 bg-zinc-800/40 rounded-lg mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-zinc-800/40 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  
  const RatingModal = () => {
    if (!showRatingModal) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={() => {
            setShowRatingModal(null);
            setSelectedRating(0);
            setHoverRating(0);
          }}
        />
        <div className="relative bg-[#111111] border border-classic-gold/30 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between px-6 py-4 border-b border-classic-gold/20">
            <h2 className="text-white text-lg font-semibold">
              Rate Your Session
            </h2>
            <button
              onClick={() => {
                setShowRatingModal(null);
                setSelectedRating(0);
                setHoverRating(0);
              }}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-6 py-6 text-center">
            <p className="text-zinc-300 mb-2">
              How was your{" "}
              <span className="text-classic-gold font-semibold">
                {showRatingModal?.session_type}
              </span>{" "}
              session?
            </p>
            <p className="text-zinc-500 text-sm mb-4">
              with {showRatingModal?.trainer_name}
            </p>

            
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setSelectedRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= (hoverRating || selectedRating)
                        ? "text-amber-400 fill-amber-400"
                        : "text-zinc-600"
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>

            <p className="text-zinc-400 text-sm mb-4">
              {selectedRating > 0 && (
                <span>
                  You rated:{" "}
                  <span className="text-classic-gold font-semibold">
                    {selectedRating}/5
                  </span>
                </span>
              )}
            </p>

            {message && (
              <div
                className={`text-sm p-3 rounded-2xl mb-4 ${
                  messageType === "success"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {message}
              </div>
            )}

            <button
              onClick={() => rateSession(showRatingModal.id)}
              disabled={ratingLoading || selectedRating === 0}
              className="w-full py-3 bg-classic-gold text-black rounded-xl font-semibold hover:bg-light-gold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {ratingLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Star className="w-4 h-4" />
              )}
              {ratingLoading ? "Submitting..." : "Submit Rating"}
            </button>
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
      <div className="space-y-6 animate-in fade-in duration-500">
      
      <RatingModal />

      <div>
        <h1 className="text-2xl font-bold text-white">Trainer Sessions</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Browse and book available training sessions with our expert trainers
        </p>
      </div>

      
      <div className="flex gap-2 border-b border-classic-gold/10 pb-2">
        <button
          onClick={() => setActiveTab("available")}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === "available"
              ? "bg-classic-gold text-black font-semibold"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Available Sessions
        </button>
        <button
          onClick={() => {
            setActiveTab("my");
            fetchMySessions();
          }}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === "my"
              ? "bg-classic-gold text-black font-semibold"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          My Bookings
        </button>
      </div>

      
      {message && (
        <div
          className={`px-4 py-3 rounded-2xl ${
            messageType === "success"
              ? "bg-green-500/20 border border-green-500/30 text-green-400"
              : "bg-red-500/20 border border-red-500/30 text-red-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage("")} className="hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      
      {activeTab === "available" && (
        <>
          {sessions.length === 0 ? (
            <div className="text-center py-16 bg-black/40 rounded-3xl border border-classic-gold/10">
              <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">No upcoming sessions available</p>
              <p className="text-zinc-500 text-sm mt-1">
                Check back later for new sessions
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((session) => {
                const isAlreadyBooked = mySessionIdsRef.current.has(Number(session.id));
                const maxParticipants = Number(session.max_participants || 1);
                const bookedCount = Number(session.booking_count || 0);
                const availableSlots = Math.max(0, maxParticipants - bookedCount);
                if (isAlreadyBooked) return null;

                return (
                  <div
                    key={session.id}
                    className="bg-black/40 border border-classic-gold/10 rounded-2xl p-5 hover:border-classic-gold/30 transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-white font-semibold text-lg">
                          {session.session_type}
                        </h3>
                        {session.trainer_name && (
                          <div className="flex items-center gap-2 mt-1">
                            <User className="w-3 h-3 text-zinc-500" />
                            <p className="text-zinc-400 text-sm">
                              Trainer: {session.trainer_name}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="bg-classic-gold/20 px-3 py-1 rounded-full">
                        <p className="text-classic-gold font-bold">
                          ₱{Number(session.price).toFixed(0)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-zinc-600" />
                        <span className="text-zinc-300">
                          {String(session.session_type).toLowerCase() === "pickleball" ? "Availability: " : "Date: "}
                          {formatDate(session.start_time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Timer className="w-4 h-4 text-zinc-600" />
                        <span className="text-zinc-300">Duration: {formatDuration(session.duration_minutes)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-zinc-600" />
                        <span className="text-zinc-300">
                          {formatTime(session.start_time)} -{" "}
                          {formatTime(session.end_time)}
                        </span>
                      </div>
                      {session.specialization && (
                        <div className="flex items-center gap-2 text-sm">
                          <Star className="w-4 h-4 text-zinc-600" />
                          <span className="text-zinc-300">{session.specialization}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-zinc-600" />
                        <span className="text-zinc-300">
                          Capacity: {bookedCount}/{maxParticipants} filled • {availableSlots} slots left
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => bookSession(session.id)}
                      disabled={bookingLoading || isAlreadyBooked}
                      className="w-full py-2.5 bg-classic-gold text-black rounded-xl font-semibold hover:bg-light-gold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bookingLoading ? (
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : isAlreadyBooked ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Already Booked
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-4 h-4" />
                          Book Session
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      
      {activeTab === "my" && (
        <>
          {mySessions.length === 0 ? (
            <div className="text-center py-16 bg-black/40 rounded-3xl border border-classic-gold/10">
              <Bookmark className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">No bookings yet</p>
              <p className="text-zinc-500 text-sm mt-1">
                Book your first session from the Available Sessions tab
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {mySessions.map((session) => {
                const sessionStatus = getSessionStatus(session);
                const isCompleted = sessionStatus === "completed";
                const isOngoing = sessionStatus === "ongoing";
                const isUpcoming = sessionStatus === "upcoming";
                const memberRating = Number(session.member_rating || 0);
                const hasRating = memberRating > 0;
                const maxParticipants = Number(session.max_participants || 1);
                const bookedCount = Number(session.booking_count || 0);
                const availableSlots = Math.max(0, maxParticipants - bookedCount);

                return (
                  <div
                    key={session.id}
                    className="bg-black/40 border border-classic-gold/10 rounded-2xl p-5 hover:border-classic-gold/30 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="text-white font-semibold">
                            {session.session_type}
                          </h3>
                          {isUpcoming ? (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                              Upcoming
                            </span>
                          ) : isOngoing ? (
                            <span className="text-xs bg-yellow-500/20 text-black-400 px-2 py-1 rounded-full">
                              Ongoing
                            </span>
                          ) : (
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                              Completed
                            </span>
                          )}
                          {hasRating && (
                            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-400" />
                              {memberRating.toFixed(1)}/5
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-400 text-sm">
                          Trainer: {session.trainer_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
                          <span className="text-zinc-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(session.start_time)}
                          </span>
                          <span className="text-zinc-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(session.start_time)} -{" "}
                            {formatTime(session.end_time)}
                          </span>
                          <span className="text-zinc-500 flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            {formatDuration(session.duration_minutes)}
                          </span>
                          <span className="text-classic-gold font-semibold">
                            ₱{Number(session.price).toFixed(0)}
                          </span>
                        </div>
                        <div className="mt-3 text-sm text-zinc-300 flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-zinc-500" />
                          Capacity: {bookedCount}/{maxParticipants} filled • {availableSlots} left
                        </div>
                      </div>
                      <div className="text-right">
                        {isCompleted && !hasRating && (
                          <button
                            onClick={() => {
                              setShowRatingModal(session);
                              setSelectedRating(0);
                              setHoverRating(0);
                            }}
                            className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                          >
                            <Star className="w-4 h-4" />
                            Rate Coach Session
                          </button>
                        )}

                        {isCompleted && hasRating && (
                          <div className="flex items-center gap-1 justify-end mb-2">
                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                            <span className="text-amber-400 font-semibold">
                              {memberRating.toFixed(1)}/5
                            </span>
                          </div>
                        )}

                        {isUpcoming && (
                          <button
                            type="button"
                            onClick={() => terminateSession(session)}
                            disabled={terminationLoading}
                            className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-2 ml-auto"
                          >
                            <X className="w-3.5 h-3.5" />
                            {terminationLoading ? "Terminating..." : "Terminate Session"}
                          </button>
                        )}

                        {isCompleted && hasRating && (
                          <p className="flex items-center justify-end gap-1 text-xs text-green-500 mt-1">
                            <CheckCircle className="w-3 h-3" />
                            Rated - Thank you!
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      </div>
    </>
  );
}

export default AvailableSessions;