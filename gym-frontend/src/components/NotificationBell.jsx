import { useState, useRef, useEffect } from "react";
import {
  Bell,
  CheckCircle,
  AlertCircle,
  Info,
  X,
  CheckCheck,
  Trash2,
} from "lucide-react";
import { useNotifications } from "../hooks/useNotifications";
import ConfirmActionModal from "./ConfirmActionModal";

function NotificationBell({ userRole = "admin", recipientId = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const dropdownRef = useRef(null);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    loading,
  } = useNotifications(userRole, recipientId);

  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      default:
        return <Info className="w-4 h-4 text-classic-gold" />;
    }
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      await markAsRead(notif.id);
    }
  };

  const handleClearAll = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = async () => {
    await clearAllNotifications();
    setShowClearConfirm(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-zinc-400 hover:text-classic-gold hover:bg-classic-gold/10 transition-all group"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      
      {isOpen && (
        <div className="fixed left-1/2 top-20 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-96 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 sm:translate-x-0 bg-[#111111] border border-classic-gold/20 rounded-2xl shadow-2xl overflow-hidden z-50">
          
          <div className="flex items-center justify-between px-4 py-3 border-b border-classic-gold/10 bg-black/40">
            <h3 className="text-white font-semibold">Notifications</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-classic-gold hover:text-light-gold transition-all flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-400 hover:text-red-300 transition-all flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>
          </div>

          
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-classic-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-4 border-b border-classic-gold/10 hover:bg-classic-gold/5 transition-all cursor-pointer ${
                    !notif.read ? "bg-classic-gold/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 mt-0.5 ${notif.read ? "opacity-50" : ""}`}>
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-white text-sm font-medium ${notif.read ? "opacity-60" : ""}`}>
                          {notif.title}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notif.id);
                          }}
                          className="text-zinc-500 hover:text-red-400 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <p className={`text-zinc-400 text-xs mt-1 ${notif.read ? "opacity-60" : ""}`}>
                        {notif.message}
                      </p>
                      <p className={`text-zinc-600 text-xs mt-2 ${notif.read ? "opacity-60" : ""}`}>
                        {getTimeAgo(notif.created_at)}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-classic-gold flex-shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
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

export default NotificationBell;
