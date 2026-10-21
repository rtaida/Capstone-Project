import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle,
  CircleX,
  Clock3,
  History as HistoryIcon,
  Loader2,
  Users,
  X,
} from "lucide-react";

function TrainerHistory({ dashboardSessions = [] }) {
  const [selectedSession, setSelectedSession] = useState(null);
  const [bookedMembers, setBookedMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");

  const API_URL = `${import.meta.env.VITE_API_URL || "/api"}/trainer_api.php`;

  const getAuthHeaders = () => {
    const token =
      localStorage.getItem("auth_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("auth_token") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("authToken") ||
      "";
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const formatDate = (value) =>
    new Date(value).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (value) =>
    new Date(value).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

  const getDuration = (start, end) => {
    const durationMinutes = Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000));
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    return hours ? `${hours}h${minutes ? ` ${minutes}m` : ""}` : `${minutes}m`;
  };

  const closeDetails = () => {
    setSelectedSession(null);
    setBookedMembers([]);
    setMembersError("");
  };

  const openDetails = async (session) => {
    setSelectedSession(session);
    setBookedMembers([]);
    setMembersError("");
    setMembersLoading(true);

    try {
      const response = await fetch(
        `${API_URL}?action=get_session_booked_members&session_id=${encodeURIComponent(session.id)}`,
        { headers: getAuthHeaders() },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load attendees.");
      }
      setBookedMembers(data.members || []);
    } catch (error) {
      console.error("Error loading session attendees:", error);
      setMembersError("Attendee details could not be loaded.");
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedSession) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeDetails();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedSession]);

  const historyItems = (dashboardSessions || []).filter((session) => {
    const status = String(session.status || "").toLowerCase();
    return (
      status === "rejected" ||
      status === "terminated" ||
      status === "finished"
    );
  });

  const summary = [
    {
      label: "Finished",
      value: historyItems.filter(
        (s) =>
          String(s.status || "").toLowerCase() === "finished"
      ).length,
      icon: CheckCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Rejected",
      value: historyItems.filter(
        (s) => String(s.status || "").toLowerCase() === "rejected"
      ).length,
      icon: CircleX,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      label: "Terminated",
      value: historyItems.filter(
        (s) => String(s.status || "").toLowerCase() === "terminated"
      ).length,
      icon: X,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-white">History</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Finished, rejected, and terminated sessions are tracked here.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summary.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-classic-gold/10 bg-black/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-classic-gold/30 hover:bg-black/50 hover:shadow-lg hover:shadow-classic-gold/5"
          >
            <div className="flex items-center justify-between">
              <div className={`p-2.5 rounded-lg ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <span className="text-zinc-500 text-xs uppercase tracking-wide">
                {card.label}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-white text-3xl font-bold">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-classic-gold/10 bg-black/40 p-5 transition-all duration-300 hover:border-classic-gold/30 hover:bg-black/50 hover:shadow-lg hover:shadow-classic-gold/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-classic-gold" />
            Session history
          </h3>
          <span className="text-zinc-500 text-xs">{historyItems.length} records</span>
        </div>

        {historyItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-500">
            No completed, rejected, or terminated sessions yet.
          </div>
        ) : (
          <div className="space-y-3">
            {historyItems.map((session) => {
              const status = String(session.status || "").toLowerCase();
              const label =
                status === "finished"
                  ? "Finished"
                  : status === "rejected"
                    ? "Rejected"
                    : "Terminated";
              const badgeColor =
                status === "finished"
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : status === "rejected"
                    ? "bg-red-500/10 text-red-300 border border-red-500/20"
                    : "bg-amber-500/10 text-amber-300 border border-amber-500/20";

              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => openDetails(session)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-classic-gold/10 bg-zinc-900/40 px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-classic-gold/30 hover:bg-zinc-900/70"
                >
                  <div className="min-w-0 text-left">
                    <p className="text-white font-medium">{session.session_type}</p>
                    <p className="text-zinc-500 text-xs mt-1">
                      {new Date(session.start_time).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${badgeColor}`}
                  >
                    {status === "finished" ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : status === "rejected" ? (
                      <CircleX className="w-3 h-3" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedSession && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDetails();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-details-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-classic-gold/20 bg-zinc-950 p-5 shadow-2xl shadow-black/50 sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-classic-gold">Session details</p>
                <h2 id="session-details-title" className="mt-1 text-xl font-semibold text-white">
                  {selectedSession.session_type}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                aria-label="Close session details"
                className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                <Calendar className="h-4 w-4 text-classic-gold" />
                <p className="mt-2 text-xs text-zinc-500">Scheduled date</p>
                <p className="mt-1 text-sm text-white">{formatDate(selectedSession.start_time)}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                <Clock3 className="h-4 w-4 text-classic-gold" />
                <p className="mt-2 text-xs text-zinc-500">Time and duration</p>
                <p className="mt-1 text-sm text-white">
                  {formatTime(selectedSession.start_time)} - {formatTime(selectedSession.end_time)}
                </p>
                <p className="mt-1 text-xs text-zinc-400">{getDuration(selectedSession.start_time, selectedSession.end_time)}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                <p className="text-xs text-zinc-500">Status</p>
                <p className="mt-1 capitalize text-sm text-white">{selectedSession.status}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                <p className="text-xs text-zinc-500">Availability</p>
                <p className="mt-1 text-sm text-white">
                  {bookedMembers.length} / {selectedSession.max_participants || "-"} availed
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-classic-gold" />
                <h3 className="font-medium text-white">Who availed</h3>
              </div>
              {membersLoading ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading attendees...
                </div>
              ) : membersError ? (
                <p className="mt-3 text-sm text-red-300">{membersError}</p>
              ) : bookedMembers.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
                  No members availed this session.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {bookedMembers.map((member) => (
                    <div key={member.memberID} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                      <p className="text-sm text-white">{member.full_name}</p>
                      <p className="mt-1 break-all text-xs text-zinc-500">{member.email || member.phone || "Contact unavailable"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedSession.admin_notes && (
              <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-xs text-amber-300">Session note</p>
                <p className="mt-1 text-sm text-zinc-300">{selectedSession.admin_notes}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default TrainerHistory;
