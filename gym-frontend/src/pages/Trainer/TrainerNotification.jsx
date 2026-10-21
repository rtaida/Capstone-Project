import { useState, useEffect } from "react";
import { Bell, CheckCircle, XCircle, Clock, Calendar, Loader2 } from "lucide-react";

function TrainerNotification({ trainerId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    if (!trainerId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "/api"}/trainer_api.php?action=get_trainer_sessions&trainer_id=${trainerId}`
      );
      const data = await response.json();
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [trainerId]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return { text: "Approved", color: "bg-green-500/20 text-green-400", icon: CheckCircle };
      case "rejected":
        return { text: "Rejected", color: "bg-red-500/20 text-red-400", icon: XCircle };
      case "pending":
        return { text: "Pending", color: "bg-yellow-500/20 text-yellow-400", icon: Clock };
      default:
        return { text: status || "Pending", color: "bg-yellow-500/20 text-yellow-400", icon: Clock };
    }
  };

  const formatDateTime = (datetime) => {
    if (!datetime) return "N/A";
    return new Date(datetime).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-classic-gold animate-spin" />
      </div>
    );
  }

  const pendingCount = sessions.filter(s => s.status === "pending").length;
  const approvedCount = sessions.filter(s => s.status === "approved").length;
  const rejectedCount = sessions.filter(s => s.status === "rejected").length;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl font-bold text-white">Session Notifications</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Track the status of your session requests
        </p>
      </div>

      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl mx-auto">
        <div className="bg-black/40 rounded-xl p-4 text-center border border-yellow-500/20">
          <Clock className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{pendingCount}</p>
          <p className="text-zinc-500 text-sm">Pending</p>
        </div>
        <div className="bg-black/40 rounded-xl p-4 text-center border border-green-500/20">
          <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{approvedCount}</p>
          <p className="text-zinc-500 text-sm">Approved</p>
        </div>
        <div className="bg-black/40 rounded-xl p-4 text-center border border-red-500/20">
          <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{rejectedCount}</p>
          <p className="text-zinc-500 text-sm">Rejected</p>
        </div>
      </div>

      
      <div className="rounded-3xl bg-black/40 backdrop-blur-md border border-classic-gold/10 p-6">
        <h2 className="text-white text-lg font-semibold mb-4">Your Session Requests</h2>
        
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No sessions created yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const status = getStatusBadge(session.status);
              const StatusIcon = status.icon;
              return (
                <div
                  key={session.id}
                  className="bg-zinc-950/40 rounded-xl p-4 border border-classic-gold/10"
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h3 className="text-white font-semibold">{session.session_type}</h3>
                      <p className="text-zinc-400 text-sm mt-1">
                        {formatDateTime(session.start_time)}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.text}
                    </div>
                  </div>
                  {session.admin_notes && (
                    <p className="text-zinc-500 text-xs mt-2 border-t border-classic-gold/10 pt-2">
                      Note: {session.admin_notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default TrainerNotification;