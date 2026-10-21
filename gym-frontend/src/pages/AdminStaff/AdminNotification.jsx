
import { useState, useEffect } from "react";
import { X, CheckCircle, AlertCircle } from "lucide-react";


let globalNotifications = [];
let listeners = [];


try {
  const saved = localStorage.getItem("notifications");
  if (saved) {
    globalNotifications = JSON.parse(saved);
  }
} catch(e) {}


const saveToStorage = () => {
  localStorage.setItem("notifications", JSON.stringify(globalNotifications));
};


export const showNotification = (message, type = "success") => {
  const newNotif = {
    id: Date.now(),
    message,
    type,
    timestamp: new Date().toLocaleTimeString(),
    read: false,
  };
  globalNotifications = [newNotif, ...globalNotifications];
  saveToStorage();
  
  
  listeners.forEach(listener => listener(globalNotifications));
  
  
  setTimeout(() => {
    globalNotifications = globalNotifications.filter(n => n.id !== newNotif.id);
    saveToStorage();
    listeners.forEach(listener => listener(globalNotifications));
  }, 5000);
};


function AdminNotification() {
  const [notifications, setNotifications] = useState(globalNotifications);

  useEffect(() => {
    const listener = (newNotifs) => setNotifications(newNotifs);
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  const removeNotif = (id) => {
    globalNotifications = globalNotifications.filter(n => n.id !== id);
    saveToStorage();
    setNotifications(globalNotifications);
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md animate-in slide-in-from-right duration-300 ${
            notif.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-400"
              : "bg-red-950/90 border-red-500/30 text-red-400"
          }`}
        >
          {notif.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{notif.message}</span>
          <button
            onClick={() => removeNotif(notif.id)}
            className="ml-2 text-current/60 hover:text-current"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default AdminNotification;