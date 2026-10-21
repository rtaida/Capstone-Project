import { useMemo, useState } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  CheckCircle,
  AlertCircle,
  Info,
  Clock,
} from "lucide-react";
import { useNotifications } from "../hooks/useNotifications";
import ConfirmActionModal from "./ConfirmActionModal";

function UserNotifications({
  userRole = "member",
  recipientId = null,
  title = "Notifications",
  subtitle,
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
  } = useNotifications(userRole, recipientId);

  const getIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-amber-400" />;
      default:
        return <Info className="w-5 h-5 text-classic-gold" />;
    }
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return "Just now";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Recently";
    const diffMs = Math.max(0, Date.now() - date.getTime());
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const visibleNotifications = useMemo(
    () => notifications || [],
    [notifications],
  );

  const handleNotificationClick = async (notification) => {
    if (!notification.read) await markAsRead(notification.id);
  };

  const confirmClearAll = async () => {
    await clearAllNotifications();
    setShowClearConfirm(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {subtitle ||
              "View and manage notifications available to your account."}
          </p>
        </div>

        {visibleNotifications.length > 0 && (
          <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:justify-end">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-classic-gold/10 text-classic-gold hover:bg-classic-gold/20 transition-all text-sm font-medium"
              >
                <CheckCheck className="w-4 h-4" />
                Mark All Read
              </button>
            )}
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </div>
        )}
      </div>

      <div className="w-full rounded-2xl bg-black/40 backdrop-blur-md border border-classic-gold/10 overflow-hidden">
        <div className="p-4 border-b border-classic-gold/10 bg-classic-gold/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-classic-gold" />
            <span className="text-white font-semibold">All Notifications</span>
          </div>
          <span className="text-xs text-classic-gold whitespace-nowrap">
            {unreadCount} unread
          </span>
        </div>

        <div className="divide-y divide-classic-gold/10 max-h-[calc(100vh-300px)] overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-9 h-9 border-2 border-classic-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Loading notifications...</p>
            </div>
          ) : !visibleNotifications.length ? (
            <div className="p-12 text-center">
              <Bell className="w-14 h-14 text-zinc-600 mx-auto mb-4" />
              <p className="text-white font-medium">No notifications yet</p>
              <p className="text-zinc-500 text-sm mt-1">
                New updates for your account will appear here.
              </p>
            </div>
          ) : (
            visibleNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 sm:p-5 cursor-pointer transition-all hover:bg-classic-gold/5 ${
                  !notification.read ? "bg-classic-gold/5" : ""
                }`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <p
                        className={`text-sm ${!notification.read ? "text-white font-semibold" : "text-zinc-300"}`}
                      >
                        {notification.title || "Notification"}
                      </p>
                      {!notification.read && (
                        <span className="w-fit text-[10px] uppercase tracking-wider text-classic-gold bg-classic-gold/10 border border-classic-gold/10 px-2 py-1 rounded-full">
                          New
                        </span>
                      )}
                    </div>

                    <p className="text-zinc-400 text-sm mt-1 leading-relaxed break-words">
                      {notification.message}
                    </p>

                    <p className="flex items-center gap-1.5 text-zinc-600 text-xs mt-2">
                      <Clock className="w-3 h-3" />
                      {getTimeAgo(notification.created_at)}
                    </p>
                  </div>

                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full bg-classic-gold flex-shrink-0 mt-2" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <ConfirmActionModal
        isOpen={showClearConfirm}
        title="Clear all notifications?"
        message="This will permanently remove every notification for this account."
        confirmLabel="Clear all"
        onConfirm={confirmClearAll}
        onClose={() => setShowClearConfirm(false)}
      />
    </div>
  );
}

export default UserNotifications;
