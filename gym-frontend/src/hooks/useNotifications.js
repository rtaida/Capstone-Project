import { useState, useEffect, useCallback, useRef } from "react";

const API_URL = `${import.meta.env.VITE_API_URL || "/api"}/notifications_api.php`;

const readJsonResponse = async (response) => {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Notification API returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Notification request failed (HTTP ${response.status}).`);
  }
  return data;
};

export const useNotifications = (userRole = "admin", recipientId = null) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const requestControllerRef = useRef(null);

  
  const fetchNotifications = useCallback(async () => {
    const token = localStorage.getItem("auth_token") || localStorage.getItem("token") || localStorage.getItem("authToken");
    if (!token) {
      if (isMountedRef.current) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
      }
      return;
    }

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const params = new URLSearchParams({ role: userRole });
      if (
        recipientId !== null &&
        recipientId !== undefined &&
        recipientId !== ""
      ) {
        params.set("recipient_id", String(recipientId));
      }
      const response = await fetch(
        `${API_URL}?action=get&${params.toString()}`,
        { signal: controller.signal },
      );
      if (response.status === 401) {
        if (isMountedRef.current) {
          setNotifications([]);
          setUnreadCount(0);
        }
        return;
      }
      const data = await readJsonResponse(response);

      if (data.success && isMountedRef.current) {
        setNotifications(data.notifications || []);
        const unread = (data.notifications || []).filter((n) => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Error fetching notifications:", error);
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [userRole, recipientId]);

  
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const response = await fetch(`${API_URL}?action=mark_read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notificationId }),
      });
      const data = await readJsonResponse(response);

      if (data.success) {
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === notificationId ? { ...notif, read: true } : notif,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  }, []);

  
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}?action=mark_all_read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: userRole, recipient_id: recipientId }),
      });
      const data = await readJsonResponse(response);

      if (data.success) {
        setNotifications((prev) =>
          prev.map((notif) => ({ ...notif, read: true })),
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  }, [userRole, recipientId]);

  
  const deleteNotification = useCallback(
    async (notificationId) => {
      try {
        const response = await fetch(
          `${API_URL}?action=delete&id=${notificationId}`,
          {
            method: "DELETE",
          },
        );
        const data = await readJsonResponse(response);

        if (data.success) {
          const deletedNotif = notifications.find(
            (n) => n.id === notificationId,
          );
          setNotifications((prev) =>
            prev.filter((n) => n.id !== notificationId),
          );
          if (deletedNotif && !deletedNotif.read) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      } catch (error) {
        console.error("Error deleting notification:", error);
      }
    },
    [notifications],
  );

  
  const clearAllNotifications = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}?action=clear_all&role=${userRole}${recipientId !== null && recipientId !== undefined && recipientId !== "" ? `&recipient_id=${encodeURIComponent(recipientId)}` : ""}`,
        {
          method: "DELETE",
        },
      );
      const data = await readJsonResponse(response);

      if (data.success) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  }, [userRole, recipientId]);

  
  const addNotification = useCallback(
    async (title, message, type = "info") => {
      try {
        const response = await fetch(`${API_URL}?action=add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            message,
            type,
            role: userRole,
            recipient_id: recipientId,
          }),
        });
        const data = await readJsonResponse(response);

        if (data.success) {
          await fetchNotifications();
        }
      } catch (error) {
        console.error("Error adding notification:", error);
      }
    },
    [userRole, recipientId, fetchNotifications],
  );

  useEffect(() => {
    isMountedRef.current = true;
    const initialFetch = setTimeout(fetchNotifications, 0);
    
    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      isMountedRef.current = false;
      clearTimeout(initialFetch);
      clearInterval(interval);
      requestControllerRef.current?.abort();
    };
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    refreshNotifications: fetchNotifications,
  };
};
