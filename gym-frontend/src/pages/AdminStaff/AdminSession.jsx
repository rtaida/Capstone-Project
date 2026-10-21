import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Edit2,
  Plus,
  RefreshCw,
  Trash2,
  User,
  Users,
  X,
  XCircle,
  Loader2,
  Settings2,
  Ban,
  Image as ImageIcon,
  PartyPopper,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import FeedbackModal from "../../components/memberModal/FeedbackModal";
import { clearAuthToken } from "../../services/api";

const API_URL =
  `${import.meta.env.VITE_API_URL || "/api"}/trainer_api.php`;

const BACKEND_ROOT =
  (import.meta.env.VITE_API_URL || "/api").replace(/\/api$/i, "");

function getAuthHeaders() {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("auth_token") ||
    "";

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

async function readApiResponse(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("user");
      clearAuthToken();
      window.location.assign("/login");
    }
    throw new Error(body?.message || `${fallbackMessage} (${response.status}).`);
  }

  if (!body || body.success === false) {
    throw new Error(body?.message || fallbackMessage);
  }

  return body;
}

function resolveSessionImage(imageUrl, sessionName) {
  if (imageUrl) {
    if (/^https?:\/\//i.test(String(imageUrl))) {
      return imageUrl;
    }

    return `${BACKEND_ROOT}/${String(imageUrl).replace(/^\/+/, "")}`;
  }

  return getSessionImage(sessionName);
}





const SESSION_IMAGES = {
  "regular session":
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=85",

  "weight lifting":
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

  boxing:
    "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=1200&q=85",

  "personal trainer":
    "https://images.unsplash.com/photo-1519311965067-36d3e5f33d39?q=80&w=1171&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",

  default:
    "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=85",
};

function getSessionImage(sessionName, customImage) {
  if (customImage) return customImage;

  const key = String(sessionName || "")
    .trim()
    .toLowerCase();

  return SESSION_IMAGES[key] || SESSION_IMAGES.default;
}





function formatDateTime(value) {
  if (!value) return "N/A";

  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}






function AdminModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-xl",
  danger = false,
  footer,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto px-3 pt-16 pb-4 sm:px-4 sm:pt-20">

      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-modal-backdrop"
        onClick={onClose}
      />


      <div
        className={`
          relative w-full ${maxWidth}
          bg-[#111]
          border
          ${danger ? "border-red-500/20" : "border-classic-gold/20"}
          rounded-2xl
          shadow-2xl
          overflow-hidden
          max-h-[calc(100vh-5rem)]
          flex flex-col
          animate-modal-in
        `}
      >

        <div
          className={`
            absolute top-0 left-0 right-0 h-[2px]
            ${danger
              ? "bg-gradient-to-r from-transparent via-red-500 to-transparent"
              : "bg-gradient-to-r from-transparent via-classic-gold to-transparent"
            }
          `}
        />


        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="text-white text-xl font-semibold">{title}</h2>

            {subtitle && (
              <p className="text-zinc-500 text-sm mt-1">{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="
              shrink-0
              w-9 h-9
              rounded-xl
              flex items-center justify-center
              bg-white/5
              border border-white/10
              text-zinc-400
              hover:text-white
              hover:bg-white/10
              transition-all
              duration-200
            "
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>


        <div className="min-h-0 flex-1 px-6 py-6 overflow-y-auto">{children}</div>


        {footer && (
          <div className="px-6 py-4 border-t border-white/10 bg-black/20">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}





const inputClass = `
  mt-2
  min-w-0
  min-h-11
  w-full
  bg-black/60
  border border-zinc-700
  rounded-xl
  px-3 py-2.5
  text-sm sm:text-base
  text-white
  outline-none
  transition-all
  duration-200
  focus:border-classic-gold/60
  focus:ring-2
  focus:ring-classic-gold/10
`;

const buttonSecondaryClass = `
  px-4 py-2.5
  rounded-xl
  bg-zinc-800
  text-zinc-300
  border border-zinc-700
  font-medium
  transition-all
  duration-200
  hover:bg-zinc-700
  hover:text-white
`;

const buttonPrimaryClass = `
  px-4 py-2.5
  rounded-xl
  bg-classic-gold
  text-black
  font-semibold
  transition-all
  duration-200
  hover:bg-light-gold
  hover:shadow-lg
  hover:shadow-classic-gold/10
`;

function AdminSession({ addNotification }) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const adminId = Number(user?.adminID ?? user?.admin_id ?? user?.id ?? 0);
  const minimumPickleballDate = new Date();
  minimumPickleballDate.setDate(minimumPickleballDate.getDate() + 1);
  const minimumPickleballDateValue = [
    minimumPickleballDate.getFullYear(),
    String(minimumPickleballDate.getMonth() + 1).padStart(2, "0"),
    String(minimumPickleballDate.getDate()).padStart(2, "0"),
  ].join("-");

  const [tab, setTab] = useState("approvals");

  const [sessions, setSessions] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [promos, setPromos] = useState([]);

  const isPromoEnded = (promo) => {
    if (promo?.is_active === false || Number(promo?.is_active) === 0) return true;
    const deadlineValue = String(promo?.availment_deadline || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineValue)) return true;
    const currentDate = new Date();
    const todayValue = [
      currentDate.getFullYear(),
      String(currentDate.getMonth() + 1).padStart(2, "0"),
      String(currentDate.getDate()).padStart(2, "0"),
    ].join("-");
    return todayValue > deadlineValue;
  };

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [promoProcessingId, setPromoProcessingId] = useState(null);

  const [feedback, setFeedback] = useState({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
  });

  const [rejectSession, setRejectSession] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [terminateTarget, setTerminateTarget] = useState(null);

  const [editing, setEditing] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const [showCatalogForm, setShowCatalogForm] = useState(false);
  const [catalogEditing, setCatalogEditing] = useState(null);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoActionTarget, setPromoActionTarget] = useState(null);
  const [promoPage, setPromoPage] = useState(1);
  const [showPickleballForm, setShowPickleballForm] = useState(false);
  const [pickleballSaving, setPickleballSaving] = useState(false);
  const [pickleballForm, setPickleballForm] = useState({
    max_participants: "4",
    availability_date: "",
    duration_hours: "1",
  });
  const [promoImageFile, setPromoImageFile] = useState(null);
  const [promoImagePreview, setPromoImagePreview] = useState("");
  const [promoForm, setPromoForm] = useState({
    promo_name: "",
    price: "",
    duration_days: "30",
    availment_deadline: "",
    image_url: "",
  });

  const [catalogForm, setCatalogForm] = useState({
    session_name: "",
    price: "",
    image_url: "",
  });

  const [catalogImageFile, setCatalogImageFile] = useState(null);
  const [catalogImagePreview, setCatalogImagePreview] = useState("");

  const [form, setForm] = useState({
    trainer_id: "",
    session_type: "Weight Lifting",
    session_date: "",
    start_time: "",
    end_time: "",
    max_participants: "",
  });





  const showFeedback = (type, message, title) => {
    setFeedback({
      isOpen: true,
      type,
      message,
      title,
    });
  };

  const closeFeedback = () => {
    setFeedback((previous) => ({
      ...previous,
      isOpen: false,
    }));
  };

  const notify = (title, message, type = "success") => {
    try {
      addNotification?.(title, message, type);
    } catch {

    }
  };





  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const authHeaders = getAuthHeaders();

      const [sessionRes, trainerRes, catalogRes, promoRes] = await Promise.all([
        fetch(`${API_URL}?action=get_all_sessions`, {
          headers: authHeaders,
          cache: "no-store",
        }),
        fetch(`${API_URL}?action=get_trainers`, {
          headers: authHeaders,
          cache: "no-store",
        }),
        fetch(`${API_URL}?action=get_session_catalog`, {
          headers: authHeaders,
          cache: "no-store",
        }),
        fetch(`${API_URL}?action=get_promos`, {
          headers: authHeaders,
          cache: "no-store",
        }),
      ]);

      const [sessionData, trainerData, catalogData, promoData] = await Promise.all([
        readApiResponse(sessionRes, "Unable to load sessions."),
        readApiResponse(trainerRes, "Unable to load trainers."),
        readApiResponse(catalogRes, "Unable to load session pricing."),
        readApiResponse(promoRes, "Unable to load promotions."),
      ]);

      setSessions(sessionData.sessions || []);
      setTrainers(trainerData.trainers || []);



      setCatalog(catalogData.session_types || []);
      setPromos(promoData.promos || []);
    } catch (error) {
      showFeedback(
        "error",
        error.message || "Unable to load session management data.",
        "Session Management Error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);





  const pendingSessions = useMemo(
    () =>
      sessions.filter(
        (session) => String(session.status).toLowerCase() === "pending",
      ),
    [sessions],
  );

  const activeSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          String(session.status).toLowerCase() === "approved" &&
          new Date(session.start_time) > new Date(),
      ),
    [sessions],
  );

  const activeCatalog = useMemo(
    () =>
      catalog.filter(
        (item) => Number(item.is_active) === 1 || item.is_active === true,
      ),
    [catalog],
  );

  const promoPageCount = Math.max(1, Math.ceil(promos.length / 4));
  const visiblePromos = promos.slice((promoPage - 1) * 4, promoPage * 4);

  useEffect(() => {
    setPromoPage((currentPage) => Math.min(currentPage, promoPageCount));
  }, [promoPageCount]);

  const catalogPrice = (name) =>
    Number(catalog.find((item) => item.session_name === name)?.price ?? 0);





  const processApproval = async (session, action) => {
    if (!session?.id || processingId) return;

    if (new Date(session.start_time) <= new Date()) {
      showFeedback(
        "error",
        "This session has already passed and cannot be approved.",
        "Session Cannot Be Approved",
      );
      return;
    }

    if (action === "reject_session" && !rejectReason.trim()) {
      showFeedback(
        "error",
        "Please provide a reason for rejecting this session.",
        "Rejection Reason Required",
      );
      return;
    }

    setProcessingId(session.id);

    try {
      const response = await fetch(`${API_URL}?action=${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          session_id: Number(session.id),
          rejection_reason: rejectReason.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Session update failed.");
      }

      setRejectSession(null);
      setRejectReason("");

      const isApproval = action === "approve_session";

      showFeedback(
        "success",
        data.message,
        isApproval ? "Session Approved" : "Session Rejected",
      );

      notify(
        isApproval ? "Session Approved" : "Session Rejected",
        data.message,
        isApproval ? "success" : "error",
      );

      await fetchData();
    } catch (error) {
      showFeedback(
        "error",
        error.message || "Unable to process session.",
        "Session Action Failed",
      );
    } finally {
      setProcessingId(null);
    }
  };





  const parseMaxParticipants = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const openCreate = () => {
    if (activeCatalog.length === 0) {
      showFeedback(
        "error",
        "There are no active session types available. Activate a session type before creating a new session.",
        "No Active Session Types",
      );
      return;
    }

    setEditing(null);

    setForm({
      trainer_id: trainers[0]?.trainerID ? String(trainers[0].trainerID) : "",

      session_type: activeCatalog[0]?.session_name || "",

      session_date: new Date().toISOString().split("T")[0],

      start_time: "",
      end_time: "",
      max_participants: 1,
    });

    setShowCreate(true);
  };

  const openPromo = () => {
    const today = new Date();
    const end = new Date(today);
    end.setMonth(end.getMonth() + 1);
    const toDateInput = (date) => date.toISOString().split("T")[0];
    setPromoForm({
      promo_name: "",
      price: "",
      duration_days: "30",
      availment_deadline: toDateInput(end),
      image_url: "",
    });
    setPromoImageFile(null);
    setPromoImagePreview("");
    setShowPromoForm(true);
  };

  const openPickleballSession = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const availabilityDate = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, "0"),
      String(tomorrow.getDate()).padStart(2, "0"),
    ].join("-");
    setPickleballForm({
      max_participants: "4",
      availability_date: availabilityDate,
      duration_hours: "1",
    });
    setShowPickleballForm(true);
  };





  const openEdit = (session) => {
    if (
      Number(session.booking_count || 0) > 0 ||
      Number(session.is_booked) === 1
    ) {
      showFeedback(
        "error",
        "This session already has a member booked. Booked sessions cannot be edited.",
        "Session Locked",
      );
      return;
    }

    const start = new Date(session.start_time);

    const end = new Date(session.end_time);

    setEditing(session);

    setForm({
      trainer_id: String(session.trainer_id),

      session_type: session.session_type,

      session_date: start.toISOString().split("T")[0],

      start_time: start.toTimeString().slice(0, 5),

      end_time: end.toTimeString().slice(0, 5),
      max_participants: Number(session.max_participants || 1),
    });

    setShowCreate(true);
  };





  const saveSession = async (e) => {
    e.preventDefault();

    if (!adminId) {
      showFeedback(
        "error",
        "Valid admin account is required. Please log in again.",
        "Authentication Required",
      );
      return;
    }

    if (
      !form.trainer_id ||
      !form.session_type ||
      !form.session_date ||
      !form.start_time ||
      !form.end_time ||
      !Number.isInteger(Number(form.max_participants)) ||
      Number(form.max_participants) < 1
    ) {
      showFeedback(
        "error",
        "Please provide a valid max participant count.",
        "Missing Session Details",
      );
      return;
    }

    const start = `${form.session_date} ${form.start_time}:00`;
    const end = `${form.session_date} ${form.end_time}:00`;

    if (new Date(end) <= new Date(start)) {
      showFeedback(
        "error",
        "End time must be after start time.",
        "Invalid Session Time",
      );
      return;
    }

    if (new Date(start) <= new Date() || new Date(end) <= new Date()) {
      showFeedback(
        "error",
        "The selected time/date has already passed. Please create another session.",
        "Past Session Time",
      );
      return;
    }

    try {
      const action = editing ? "admin_update_session" : "admin_create_session";

      const body = editing
        ? {
          admin_id: adminId,
          session_id: Number(editing.id),
          trainer_id: Number(form.trainer_id),
          session_type: form.session_type,
          start_time: start,
          end_time: end,
          max_participants: Number(form.max_participants),
        }
        : {
          admin_id: adminId,
          trainer_id: Number(form.trainer_id),
          session_type: form.session_type,
          start_time: start,
          end_time: end,
          max_participants: Number(form.max_participants),
        };

      const response = await fetch(`${API_URL}?action=${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Unable to save session.");
      }

      setShowCreate(false);

      showFeedback(
        "success",
        data.message,
        editing ? "Session Updated" : "Session Created",
      );

      notify(
        editing ? "Session Updated" : "Session Created",
        data.message,
        "success",
      );

      await fetchData();
    } catch (error) {
      showFeedback(
        "error",
        error.message || "Unable to save session.",
        "Session Save Failed",
      );
    }
  };





  const terminate = async (session) => {
    if (!session || processingId) return;

    if (
      Number(session.booking_count || 0) > 0 ||
      Number(session.is_booked) === 1
    ) {
      showFeedback(
        "error",
        "This session is already booked. Admin termination is only available while the session is still unbooked.",
        "Session Cannot Be Terminated",
      );
      return;
    }

    setProcessingId(session.id);

    try {
      const response = await fetch(
        `${API_URL}?action=admin_terminate_session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            admin_id: adminId,
            session_id: Number(session.id),
            reason: "Terminated by admin before booking.",
          }),
        },
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Unable to terminate session.");
      }

      showFeedback("success", data.message, "Session Terminated");

      notify("Session Terminated", data.message, "success");

      await fetchData();
    } catch (error) {
      showFeedback(
        "error",
        error.message || "Unable to terminate session.",
        "Termination Failed",
      );
    } finally {
      setProcessingId(null);
      setTerminateTarget(null);
    }
  };

  const requestPromoAction = (promo, action) => {
    if (!promo || !adminId || promoProcessingId) return;
    if (action === "end_promo" && isPromoEnded(promo)) return;
    setPromoActionTarget({ promo, action });
  };

  const processPromoAction = async () => {
    const target = promoActionTarget;
    if (!target || !adminId || promoProcessingId) return;

    setPromoProcessingId(target.promo.id);
    try {
      const response = await fetch(`${API_URL}?action=${target.action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          admin_id: adminId,
          promo_id: Number(target.promo.id),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Unable to update the promotion.");
      }

      const actionTitle = target.action === "delete_promo" ? "Promo Deleted" : "Promo Ended";
      showFeedback("success", data.message, actionTitle);
      notify(actionTitle, data.message, "success");
      setPromoActionTarget(null);
      await fetchData();
    } catch (error) {
      showFeedback(
        "error",
        error.message || "Unable to update the promotion.",
        target.action === "delete_promo" ? "Promo Deletion Failed" : "Promo Cancellation Failed",
      );
    } finally {
      setPromoProcessingId(null);
    }
  };




  const saveCatalog = async (e) => {
    e.preventDefault();

    if (!catalogForm.session_name.trim()) {
      showFeedback(
        "error",
        "Session type name is required.",
        "Missing Session Type",
      );
      return;
    }

    const price = Number(catalogForm.price);

    if (!Number.isFinite(price) || price < 0) {
      showFeedback(
        "error",
        "Enter a valid non-negative price.",
        "Invalid Price",
      );
      return;
    }

    try {
      let imageUrl = catalogForm.image_url || "";

      if (catalogImageFile) {
        const uploadData = new FormData();
        uploadData.append("image", catalogImageFile);
        uploadData.append("admin_id", String(adminId));

        const uploadResponse = await fetch(
          `${API_URL}?action=upload_session_type_image`,
          {
            method: "POST",
            headers: getAuthHeaders(),
            body: uploadData,
          },
        );

        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok || !uploadResult.success) {
          throw new Error(
            uploadResult.message || "Unable to upload session preview.",
          );
        }

        imageUrl = uploadResult.image_url || "";
      }

      const response = await fetch(`${API_URL}?action=save_session_type`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          admin_id: adminId,
          id: catalogEditing?.id || 0,
          session_name: catalogForm.session_name.trim(),
          price,
          image_url: imageUrl || null,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Unable to save session type.");
      }

      const wasEditing = Boolean(catalogEditing);

      setShowCatalogForm(false);
      setCatalogEditing(null);
      setCatalogImageFile(null);
      setCatalogImagePreview("");

      setCatalogForm({
        session_name: "",
        price: "",
        image_url: "",
      });

      showFeedback(
        "success",
        data.message,
        wasEditing ? "Session Updated" : "Session Type Created",
      );

      notify(
        wasEditing ? "Session Updated" : "Session Type Created",
        data.message,
        "success",
      );

      await fetchData();
    } catch (error) {
      showFeedback(
        "error",
        error.message || "Unable to save session type.",
        "Session Type Error",
      );
    }
  };

  const savePromo = async (e) => {
    e.preventDefault();
    const price = Number(promoForm.price);
    if (!promoForm.promo_name.trim() || !Number.isFinite(price) || price <= 0) {
      showFeedback("error", "Enter a promo name and a price greater than zero.", "Missing Promo Details");
      return;
    }

    try {
      let imageUrl = promoForm.image_url || "";
      if (promoImageFile) {
        const uploadData = new FormData();
        uploadData.append("image", promoImageFile);
        uploadData.append("admin_id", String(adminId));
        const uploadResponse = await fetch(`${API_URL}?action=upload_session_type_image`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: uploadData,
        });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadResult.success) {
          throw new Error(uploadResult.message || "Unable to upload promo image.");
        }
        imageUrl = uploadResult.image_url || "";
      }

      const response = await fetch(`${API_URL}?action=save_promo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          admin_id: adminId,
          promo_name: promoForm.promo_name.trim(),
          price,
          duration_days: Number(promoForm.duration_days),
          availment_deadline: promoForm.availment_deadline,
          image_url: imageUrl || null,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message || "Unable to save promotion.");

      setShowPromoForm(false);
      setPromoImageFile(null);
      setPromoImagePreview("");
      setPromoForm({ promo_name: "", price: "", duration_days: "30", availment_deadline: "", image_url: "" });
      showFeedback("success", data.message, "Promotion Created");
      notify("Promotion Created", data.message, "success");
      await fetchData();
    } catch (error) {
      showFeedback("error", error.message || "Unable to save promotion.", "Promotion Error");
    }
  };

  const savePickleballSession = async (event) => {
    event.preventDefault();
    if (!adminId) {
      showFeedback("error", "Valid admin account is required. Please log in again.", "Authentication Required");
      return;
    }

    const maxParticipants = Number(pickleballForm.max_participants);
    const durationHours = Number(pickleballForm.duration_hours);
    if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || !Number.isFinite(durationHours) || durationHours < 0.5 || durationHours > 12 || durationHours * 2 % 1 !== 0) {
      showFeedback("error", "Enter a whole-number participant limit and a duration from 0.5 to 12 hours in half-hour increments.", "Invalid Session Details");
      return;
    }

    setPickleballSaving(true);
    try {
      const response = await fetch(`${API_URL}?action=admin_create_pickleball_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          admin_id: adminId,
          max_participants: maxParticipants,
          availability_date: pickleballForm.availability_date,
          duration_minutes: Math.round(durationHours * 60),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to create Pickleball session.");
      }

      setShowPickleballForm(false);
      showFeedback("success", data.message, "Pickleball Session Created");
      notify("Pickleball Session Created", data.message, "success");
      await fetchData();
    } catch (error) {
      showFeedback("error", error.message || "Unable to create Pickleball session.", "Session Creation Failed");
    } finally {
      setPickleballSaving(false);
    }
  };


  const deactivateCatalog = async (item) => {
    if (
      !window.confirm(
        `Deactivate ${item.session_name}? Existing sessions will remain unchanged.`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}?action=delete_session_type`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          admin_id: adminId,
          id: Number(item.id),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Unable to deactivate session type.");
      }

      showFeedback("success", data.message, "Session Type Deactivated");

      notify("Session Type Deactivated", data.message, "success");

      await fetchData();
    } catch (error) {
      showFeedback(
        "error",
        error.message || "Unable to save session type.",
        "Session Type Error",
      );
    }
  };





  const activateCatalog = async (item) => {
    if (!item?.id || processingId) return;

    try {
      const response = await fetch(`${API_URL}?action=activate_session_type`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          admin_id: adminId,
          id: Number(item.id),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Unable to activate session type.");
      }

      showFeedback("success", data.message, "Session Type Activated");

      notify("Session Type Activated", data.message, "success");

      await fetchData();
    } catch (error) {
      showFeedback(
        "error",
        error.message || "Unable to activate session type.",
        "Session Type Error",
      );
    }
  };





  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-classic-gold animate-spin" />
      </div>
    );
  }





  return (
    <div className="space-y-6 animate-in fade-in duration-500">


      <FeedbackModal {...feedback} onClose={closeFeedback} />

      <AdminModal
        isOpen={Boolean(terminateTarget)}
        onClose={() => setTerminateTarget(null)}
        title="Terminate Session"
        subtitle="This action will remove the session and mark it as terminated."
        danger
        maxWidth="max-w-md"
        footer={
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setTerminateTarget(null)}
              className="flex-1 px-4 py-3 rounded-xl bg-classic-gold text-black font-semibold hover:bg-light-gold transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => terminate(terminateTarget)}
              disabled={processingId === terminateTarget?.id}
              className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 transition-all duration-200 disabled:opacity-60"
            >
              {processingId === terminateTarget?.id ? "Terminating..." : "Confirm"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-zinc-200 text-base font-medium">
              Are you sure you want to terminate this session?
            </p>
            <p className="text-zinc-400 text-sm mt-2">
              {terminateTarget?.session_type || "This session"} on {terminateTarget ? formatDateTime(terminateTarget.start_time) : "this time"} will be marked terminated and removed from active listings.
            </p>
          </div>
        </div>
      </AdminModal>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Session Management</h1>

          <p className="text-zinc-400 text-sm mt-1">
            Approve trainer requests, create sessions, manage availability, and
            control session pricing.
          </p>
        </div>


        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="
              w-11 h-11
              rounded-xl
              bg-zinc-800/60
              border border-zinc-700
              text-zinc-400
              flex items-center justify-center
              hover:text-classic-gold
              hover:border-classic-gold/30
              transition-all
              duration-200
            "
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

        </div>
      </div>



      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2 bg-black/30 p-1.5 rounded-xl border border-classic-gold/10 w-fit">
          {[
            ["approvals", "Pending Approval", Clock, pendingSessions.length],
            ["sessions", "Sessions", Calendar, activeSessions.length],
            ["pricing", "Pricing & Types", Settings2, catalog.length],
          ].map(([id, label, Icon, count]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`
                px-4 py-2.5
                rounded-lg
                text-sm
                font-medium
                flex items-center
                gap-2
                transition-all
                duration-200
                ${tab === id
                ? "bg-classic-gold text-black shadow-lg shadow-classic-gold/10"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
              }
              `}
            >
              <Icon className="w-4 h-4" />

              {label}

              {count > 0 && (
                <span
                  className={`
                    text-xs
                    px-1.5
                    py-0.5
                    rounded-full
                    ${tab === id ? "bg-black/10" : "bg-zinc-800"}
                  `}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "sessions" && (
          <div className="flex items-center gap-3 sm:ml-auto">
            <button
              onClick={openPickleballSession}
              className={`${buttonSecondaryClass} flex items-center gap-2 w-fit border-classic-gold/30 text-classic-gold hover:bg-classic-gold/10`}
            >
              <Plus className="w-4 h-4" />
              Create Pickleball Session
            </button>
            <button
              onClick={openPromo}
              className={`${buttonSecondaryClass} flex items-center gap-2 w-fit border-classic-gold/30 text-classic-gold hover:bg-classic-gold/10`}
            >
              <PartyPopper className="w-4 h-4" />
              Create Promo
            </button>
          </div>
        )}
      </div>



      {tab === "approvals" && (
        <div className="space-y-4">
          {pendingSessions.length === 0 ? (
            <Empty
              icon={CheckCircle}
              text="No pending session approvals"
              sub="Trainer-created session requests will appear here."
            />
          ) : (
            pendingSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                processingId={processingId}
                onApprove={() => processApproval(session, "approve_session")}
                onReject={() => {
                  setRejectSession(session);
                  setRejectReason("");
                }}
                onEdit={() => openEdit(session)}
                onTerminate={() => setTerminateTarget(session)}
                pending
              />
            ))
          )}
        </div>
      )}



      {tab === "sessions" && (
        <div className="space-y-8">
          <div className="space-y-4">
            {activeSessions.length === 0 ? (
              <Empty
                icon={Calendar}
                text="No upcoming sessions"
                sub="Create a session or approve a trainer request."
              />
            ) : (
              activeSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  processingId={processingId}
                  onEdit={() => openEdit(session)}
                  onTerminate={() => setTerminateTarget(session)}
                />
              ))
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-white font-semibold text-lg">Promotions</h2>
                <p className="text-zinc-500 text-sm mt-1">Manage time-limited offers for members.</p>
              </div>
            </div>
            {promos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-700 bg-black/20 p-6 text-zinc-500 text-sm">
                No promotions created yet.
              </div>
            ) : (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visiblePromos.map((promo) => (
                  <div key={promo.id} className={`group overflow-hidden rounded-2xl border bg-black/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${isPromoEnded(promo) ? "border-red-500/30 hover:border-red-400/60" : "border-classic-gold/20 hover:border-[#d9a75b]/70 hover:shadow-[#8f6b31]/20"}`}>
                    <div className="relative h-36">
                      <img src={resolveSessionImage(promo.image_url, "default")} alt={promo.promo_name} className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${isPromoEnded(promo) ? "grayscale opacity-60" : ""}`} onError={(event) => { event.currentTarget.src = SESSION_IMAGES.default; }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                      <span className={`absolute left-4 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${isPromoEnded(promo) ? "bg-red-500/90 text-white" : "bg-emerald-500/90 text-black"}`}>
                        {isPromoEnded(promo) ? "Promo Ended" : "Active"}
                      </span>
                      <div className="absolute left-4 right-4 bottom-3 flex items-end justify-between gap-3">
                        <div className="text-white font-bold">{promo.promo_name}</div>
                        <div className="text-classic-gold font-bold">₱{Number(promo.price).toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-3 text-xs">
                      <div><p className="text-zinc-500">Duration</p><p className="text-zinc-200 mt-1">{promo.duration_days} days</p></div>
                      <div><p className="text-zinc-500">Availment deadline</p><p className={`mt-1 ${isPromoEnded(promo) ? "text-red-300" : "text-zinc-200"}`}>{isPromoEnded(promo) ? "Promo Ended" : promo.availment_deadline}</p></div>
                      <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => requestPromoAction(promo, "end_promo")}
                          disabled={isPromoEnded(promo) || promoProcessingId === promo.id}
                          className={`w-full mt-2 rounded-xl border px-3 py-2 font-medium transition-all duration-200 ${isPromoEnded(promo)
                            ? "cursor-not-allowed border-red-500/20 bg-red-500/5 text-red-300/70"
                            : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                          }`}
                        >
                          {promoProcessingId === promo.id ? (
                            <span className="inline-flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Ending...
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center gap-2">
                              <Ban className="w-4 h-4" />
                              {isPromoEnded(promo) ? "Promo Ended" : "End Promo"}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => requestPromoAction(promo, "delete_promo")}
                          disabled={promoProcessingId === promo.id}
                          className="w-full mt-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 font-medium text-red-300 transition-all duration-200 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {promos.length > 4 && (
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-sm text-zinc-500">Page {promoPage} of {promoPageCount}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPromoPage((page) => Math.max(1, page - 1))}
                      disabled={promoPage <= 1}
                      aria-label="Previous promotions page"
                      className="rounded-lg border border-zinc-700 p-2 text-zinc-300 transition hover:border-classic-gold/40 hover:text-classic-gold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromoPage((page) => Math.min(promoPageCount, page + 1))}
                      disabled={promoPage >= promoPageCount}
                      aria-label="Next promotions page"
                      className="rounded-lg border border-zinc-700 p-2 text-zinc-300 transition hover:border-classic-gold/40 hover:text-classic-gold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        </div>
      )}



      {tab === "pricing" && (
        <div className="space-y-5">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-white font-semibold text-lg">
                Session Types & Pricing
              </h2>

              <p className="text-zinc-500 text-sm mt-1">
                Prices are used automatically when new sessions are created.
              </p>
            </div>

          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <button
              type="button"
              onClick={() => {
                setCatalogEditing(null);
                setCatalogForm({
                  session_name: "",
                  price: "",
                  image_url: "",
                });
                setCatalogImageFile(null);
                setCatalogImagePreview("");
                setShowCatalogForm(true);
              }}
              className="
                min-h-[360px]
                rounded-2xl
                border-2 border-dashed border-zinc-700
                bg-black/25
                hover:border-classic-gold/50
                hover:bg-classic-gold/5
                transition-all duration-300
                flex flex-col items-center justify-center
                gap-3
                group
              "
            >
              <span className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-700 group-hover:border-classic-gold/40 flex items-center justify-center transition-all">
                <Plus className="w-7 h-7 text-zinc-400 group-hover:text-classic-gold" />
              </span>
              <span className="text-white font-semibold">
                + New Session Type
              </span>
              <span className="text-zinc-500 text-sm">
                Add a custom session type and preview image
              </span>
            </button>

            {catalog.map((item) => (
              <div
                key={item.id}
                className={`
                  group
                  bg-black/40
                  border
                  ${Number(item.is_active) === 1 || item.is_active === true
                    ? "border-classic-gold/10 hover:border-classic-gold/30"
                    : "border-zinc-700/70 opacity-75 hover:opacity-90 hover:border-zinc-500"
                  }
                  rounded-2xl
                  overflow-hidden
                  transition-all
                  duration-300
                `}
              >

                <div className="relative h-44 overflow-hidden">
                  <img
                    src={resolveSessionImage(item.image_url, item.session_name)}
                    alt={item.session_name}
                    className="
                      w-full
                      h-full
                      object-cover
                      transition-transform
                      duration-700
                      group-hover:scale-105
                    "
                    onError={(event) => {
                      event.currentTarget.src = SESSION_IMAGES.default;
                    }}
                  />


                  {Number(item.is_active) !== 1 && item.is_active !== true && (
                    <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                      <span className="px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-600 text-zinc-300 text-xs font-semibold tracking-wide uppercase">
                        Deactivated
                      </span>
                    </div>
                  )}


                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />


                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-classic-gold to-transparent opacity-70" />


                  <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-white text-lg font-bold drop-shadow-lg">
                        {item.session_name}
                      </p>

                      <p className="text-zinc-300 text-xs mt-1">Session Type</p>

                      <span
                        className={`
                          inline-flex
                          items-center
                          gap-1.5
                          mt-2
                          px-2.5
                          py-1
                          rounded-full
                          text-[10px]
                          font-semibold
                          uppercase
                          tracking-wider
                          ${Number(item.is_active) === 1 ||
                            item.is_active === true
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                            : "bg-zinc-800/90 text-zinc-400 border border-zinc-700"
                          }
                        `}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${Number(item.is_active) === 1 || item.is_active === true ? "bg-emerald-400" : "bg-zinc-500"}`}
                        />
                        {Number(item.is_active) === 1 || item.is_active === true
                          ? "Active"
                          : "Deactivated"}
                      </span>
                    </div>
                  </div>
                </div>


                <div className="p-5">
                  <div className="flex justify-between gap-3 items-start">
                    <div>
                      <p className="text-zinc-500 text-xs uppercase tracking-wider">
                        Current Price
                      </p>

                      <p className="text-zinc-400 text-sm mt-1">
                        Applied to new sessions
                      </p>
                    </div>

                    <span className="text-classic-gold text-xl font-bold">
                      ₱{Number(item.price).toFixed(2)}
                    </span>
                  </div>


                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => {
                        setCatalogEditing(item);

                        setCatalogForm({
                          session_name: item.session_name,
                          price: item.price,
                          image_url: item.image_url || "",
                        });
                        setCatalogImageFile(null);
                        setCatalogImagePreview(
                          resolveSessionImage(item.image_url, item.session_name),
                        );
                        setShowCatalogForm(true);
                      }}
                      className="
                        flex-1
                        py-2.5
                        rounded-xl
                        bg-blue-500/10
                        border border-blue-500/10
                        text-blue-400
                        flex items-center
                        justify-center
                        gap-2
                        transition-all
                        duration-200
                        hover:bg-blue-500/20
                        hover:border-blue-500/20
                      "
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>

                    {Number(item.is_active) === 1 || item.is_active === true ? (
                      <button
                        onClick={() => deactivateCatalog(item)}
                        className="
                          flex-1
                          py-2.5
                          rounded-xl
                          bg-red-500/10
                          border border-red-500/10
                          text-red-400
                          flex items-center
                          justify-center
                          gap-2
                          transition-all
                          duration-200
                          hover:bg-red-500/20
                          hover:border-red-500/20
                        "
                      >
                        <Ban className="w-4 h-4" />
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => activateCatalog(item)}
                        className="
                          flex-1
                          py-2.5
                          rounded-xl
                          bg-emerald-500/10
                          border border-emerald-500/20
                          text-emerald-400
                          flex items-center
                          justify-center
                          gap-2
                          transition-all
                          duration-200
                          hover:bg-emerald-500/20
                          hover:border-emerald-500/30
                        "
                      >
                        <CheckCircle className="w-4 h-4" />
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      <AdminModal
        isOpen={showPromoForm}
        onClose={() => setShowPromoForm(false)}
        title="Create Promo"
        subtitle="Set the offer price, availability window, deadlines, and promo artwork."
        maxWidth="max-w-2xl"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowPromoForm(false)} className={`${buttonSecondaryClass} flex-1`}>Cancel</button>
            <button form="promo-form" type="submit" className={`${buttonPrimaryClass} flex-1`}>Create Promo</button>
          </div>
        }
      >
        <form id="promo-form" onSubmit={savePromo}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-sm text-zinc-300 md:col-span-2">Promo Name<input required value={promoForm.promo_name} onChange={(e) => setPromoForm({ ...promoForm, promo_name: e.target.value })} className={inputClass} placeholder="e.g. New Year Strength Pass" /></label>
            <label className="text-sm text-zinc-300">Price<input required min="0" step="0.01" type="number" value={promoForm.price} onChange={(e) => setPromoForm({ ...promoForm, price: e.target.value })} className={inputClass} placeholder="0.00" /></label>
            <label className="text-sm text-zinc-300">Duration (days)<input required min="1" step="1" type="number" value={promoForm.duration_days} onChange={(e) => setPromoForm({ ...promoForm, duration_days: e.target.value })} className={inputClass} placeholder="30" /></label>
            <label className="text-sm text-zinc-300">Deadline of Availment<input required type="date" min={new Date().toISOString().split("T")[0]} value={promoForm.availment_deadline} onChange={(e) => setPromoForm({ ...promoForm, availment_deadline: e.target.value })} className={inputClass} /></label>
          </div>
          <div className="mt-5">
            <label className="block text-sm text-zinc-300">Promo Image
              <div className="mt-2 rounded-2xl overflow-hidden border border-zinc-700 bg-black/40"><div className="relative h-40 flex items-center justify-center">{promoImagePreview ? <img src={promoImagePreview} alt="Promo preview" className="w-full h-full object-cover" /> : <div className="text-zinc-600 text-sm flex items-center gap-2"><PartyPopper className="w-5 h-5" /> No image selected</div>}</div></div>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-3 block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-classic-gold file:px-4 file:py-2 file:font-semibold file:text-black hover:file:bg-yellow-400" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (!file.type.startsWith("image/")) { showFeedback("error", "Please select an image file.", "Invalid Image"); e.target.value = ""; return; } if (file.size > 5 * 1024 * 1024) { showFeedback("error", "Image must be 5 MB or smaller.", "Image Too Large"); e.target.value = ""; return; } setPromoImageFile(file); const reader = new FileReader(); reader.onload = () => setPromoImagePreview(String(reader.result || "")); reader.readAsDataURL(file); }} />
              <p className="text-zinc-600 text-xs mt-2">JPG, PNG, WEBP, or GIF. Maximum 5 MB.</p>
            </label>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        isOpen={Boolean(promoActionTarget)}
        onClose={() => !promoProcessingId && setPromoActionTarget(null)}
        title={promoActionTarget?.action === "delete_promo" ? "Delete Promotion" : "End Promotion"}
        subtitle={promoActionTarget?.action === "delete_promo"
          ? "Promotions with member availment history cannot be deleted."
          : "Members will no longer be able to avail this promotion."}
        danger={promoActionTarget?.action === "delete_promo"}
        maxWidth="max-w-md"
        footer={(
          <div className="flex gap-3">
            <button type="button" onClick={() => setPromoActionTarget(null)} disabled={Boolean(promoProcessingId)} className={`${buttonSecondaryClass} flex-1`}>Cancel</button>
            <button type="button" onClick={processPromoAction} disabled={Boolean(promoProcessingId)} className={`${promoActionTarget?.action === "delete_promo" ? "rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-500" : buttonPrimaryClass} flex-1`}>
              {promoProcessingId ? "Processing..." : promoActionTarget?.action === "delete_promo" ? "Delete Promo" : "End Promo"}
            </button>
          </div>
        )}
      >
        <p className="text-sm leading-6 text-zinc-300">
          {promoActionTarget?.action === "delete_promo"
            ? <>Delete <span className="font-semibold text-white">{promoActionTarget?.promo?.promo_name}</span> from the database? This action cannot be undone.</>
            : <>End <span className="font-semibold text-white">{promoActionTarget?.promo?.promo_name}</span> now? It will no longer be available to members.</>}
        </p>
      </AdminModal>

      <AdminModal
        isOpen={showPickleballForm}
        onClose={() => !pickleballSaving && setShowPickleballForm(false)}
        title="Create Pickleball Session"
        subtitle="Set the date, duration and participant capacity. Sessions begin at 9:00 AM and must be scheduled for tomorrow or later."
        maxWidth="max-w-xl"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowPickleballForm(false)} disabled={pickleballSaving} className={`${buttonSecondaryClass} flex-1`}>Cancel</button>
            <button form="pickleball-session-form" type="submit" disabled={pickleballSaving} className={`${buttonPrimaryClass} flex-1`}>
              {pickleballSaving ? "Creating..." : "Create Session"}
            </button>
          </div>
        }
      >
        <form id="pickleball-session-form" onSubmit={savePickleballSession} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-sm text-zinc-300">
            Max Participants
            <input required min="1" step="1" type="number" value={pickleballForm.max_participants} onChange={(event) => setPickleballForm({ ...pickleballForm, max_participants: event.target.value })} className={inputClass} />
          </label>
          <label className="text-sm text-zinc-300">
            Availability Date
            <input required min={minimumPickleballDateValue} type="date" value={pickleballForm.availability_date} onChange={(event) => setPickleballForm({ ...pickleballForm, availability_date: event.target.value })} className={inputClass} />
          </label>
          <label className="text-sm text-zinc-300 sm:col-span-2">
            Duration (hours)
            <input required min="0.5" max="12" step="0.5" type="number" value={pickleballForm.duration_hours} onChange={(event) => setPickleballForm({ ...pickleballForm, duration_hours: event.target.value })} className={inputClass} />
          </label>
        </form>
      </AdminModal>

      <AdminModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title={editing ? "Edit Session" : "Create Session"}
        subtitle={
          editing
            ? "Update an available session before it is booked."
            : "Create and assign a session to a trainer."
        }
        maxWidth="max-w-xl"
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className={`
                ${buttonSecondaryClass}
                flex-1
              `}
            >
              Cancel
            </button>

            <button
              form="session-form"
              type="submit"
              className={`
                ${buttonPrimaryClass}
                flex-1
              `}
            >
              {editing ? "Update Session" : "Create & Approve Session"}
            </button>
          </div>
        }
      >
        <form id="session-form" onSubmit={saveSession}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-sm text-zinc-300">
              Trainer
              <select
                required
                value={form.trainer_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trainer_id: e.target.value,
                  })
                }
                className={inputClass}
              >
                <option value="">Select trainer</option>

                {trainers.map((trainer) => (
                  <option key={trainer.trainerID} value={trainer.trainerID}>
                    {trainer.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-zinc-300">
              Session Type
              <select
                required
                value={form.session_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    session_type: e.target.value,
                  })
                }
                className={inputClass}
              >
                {activeCatalog.map((item) => (
                  <option key={item.id} value={item.session_name}>
                    {item.session_name} — ₱{Number(item.price).toFixed(2)}
                  </option>
                ))}

                {activeCatalog.length === 0 && (
                  <option value="" disabled>
                    No active session types available
                  </option>
                )}
              </select>
            </label>

            <label className="text-sm text-zinc-300">
              Date
              <input
                required
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={form.session_date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    session_date: e.target.value,
                  })
                }
                className={inputClass}
              />
            </label>

            <label className="text-sm text-zinc-300">
              Start Time
              <input
                required
                type="time"
                value={form.start_time}
                onChange={(e) =>
                  setForm({
                    ...form,
                    start_time: e.target.value,
                  })
                }
                className={inputClass}
              />
            </label>

            <label className="text-sm text-zinc-300 md:col-span-2">
              End Time
              <input
                required
                type="time"
                value={form.end_time}
                onChange={(e) =>
                  setForm({
                    ...form,
                    end_time: e.target.value,
                  })
                }
                className={inputClass}
              />
            </label>

            <label className="text-sm text-zinc-300 md:col-span-2">
              Max Participants
              <input
                required
                type="number"
                min="1"
                step="1"
                value={form.max_participants}
                onChange={(e) =>
                  setForm({
                    ...form,
                    max_participants: parseMaxParticipants(e.target.value),
                  })
                }
                className={inputClass}
              />
            </label>
          </div>


          <div className="mt-5 rounded-xl bg-classic-gold/10 border border-classic-gold/20 p-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-zinc-400 text-sm">
                  Current Catalog Price
                </span>

                <p className="text-zinc-500 text-xs mt-1">
                  Price comes from the admin-managed catalog.
                </p>
              </div>

              <span className="text-classic-gold font-bold text-xl">
                ₱{catalogPrice(form.session_type).toFixed(2)}
              </span>
            </div>
          </div>
        </form>
      </AdminModal>



      <AdminModal
        isOpen={showCatalogForm}
        onClose={() => setShowCatalogForm(false)}
        title={catalogEditing ? "Edit Session Type" : "New Session Type"}
        subtitle={
          catalogEditing
            ? "Update the session type and its current catalog price."
            : "Create another session type for your gym."
        }
        maxWidth="max-w-md"
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowCatalogForm(false)}
              className={`
                ${buttonSecondaryClass}
                flex-1
              `}
            >
              Cancel
            </button>

            <button
              form="catalog-form"
              type="submit"
              className={`
                ${buttonPrimaryClass}
                flex-1
              `}
            >
              Save Session Type
            </button>
          </div>
        }
      >
        <form id="catalog-form" onSubmit={saveCatalog}>
          <label className="block text-sm text-zinc-300">
            Session Name
            <input
              required
              value={catalogForm.session_name}
              onChange={(e) =>
                setCatalogForm({
                  ...catalogForm,
                  session_name: e.target.value,
                })
              }
              className={inputClass}
              placeholder="e.g. HIIT Training"
            />
          </label>

          <label className="block text-sm text-zinc-300 mt-5">
            Price
            <input
              required
              min="0"
              step="0.01"
              type="number"
              value={catalogForm.price}
              onChange={(e) =>
                setCatalogForm({
                  ...catalogForm,
                  price: e.target.value,
                })
              }
              className={inputClass}
              placeholder="0.00"
            />
          </label>

          <div className="mt-5">
            <label className="block text-sm text-zinc-300">
              Session Preview
              <div className="mt-2 rounded-2xl overflow-hidden border border-zinc-700 bg-black/40">
                <div className="relative h-40">
                  <img
                    src={
                      catalogImagePreview ||
                      resolveSessionImage(
                        catalogForm.image_url,
                        catalogForm.session_name,
                      )
                    }
                    alt={
                      catalogForm.session_name
                        ? `${catalogForm.session_name} preview`
                        : "Session preview"
                    }
                    className="w-full h-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src = SESSION_IMAGES.default;
                    }}
                  />

                  <div className="absolute inset-0 bg-black/25" />
                </div>
              </div>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="mt-3 block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-classic-gold file:px-4 file:py-2 file:font-semibold file:text-black hover:file:bg-yellow-400"
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (!file) {
                    return;
                  }

                  if (!file.type.startsWith("image/")) {
                    showFeedback(
                      "error",
                      "Please select an image file.",
                      "Invalid Image",
                    );
                    e.target.value = "";
                    return;
                  }

                  if (file.size > 5 * 1024 * 1024) {
                    showFeedback(
                      "error",
                      "Image must be 5 MB or smaller.",
                      "Image Too Large",
                    );
                    e.target.value = "";
                    return;
                  }

                  setCatalogImageFile(file);

                  const reader = new FileReader();

                  reader.onload = () => {
                    setCatalogImagePreview(
                      String(reader.result || ""),
                    );
                  };

                  reader.readAsDataURL(file);
                }}
              />

              <p className="text-zinc-600 text-xs mt-2">
                JPG, PNG, WEBP, or GIF. Maximum 5 MB.
              </p>
            </label>
          </div>
        </form>
      </AdminModal>



      <AdminModal
        isOpen={Boolean(rejectSession)}
        onClose={() => setRejectSession(null)}
        title="Reject Session"
        subtitle={
          rejectSession
            ? `Provide a reason for rejecting ${rejectSession.session_type}.`
            : ""
        }
        maxWidth="max-w-md"
        danger
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRejectSession(null)}
              className={`
                ${buttonSecondaryClass}
                flex-1
              `}
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={processingId === rejectSession?.id}
              onClick={() => processApproval(rejectSession, "reject_session")}
              className="
                flex-1
                px-4 py-2.5
                rounded-xl
                bg-red-600
                text-white
                font-semibold
                transition-all
                duration-200
                hover:bg-red-500
                disabled:opacity-50
                flex items-center
                justify-center
                gap-2
              "
            >
              {processingId === rejectSession?.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Reject
            </button>
          </div>
        }
      >
        <div>
          <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4 mb-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5 text-red-400" />
              </div>

              <div>
                <p className="text-zinc-200 text-sm font-medium">
                  Reject this trainer request?
                </p>

                <p className="text-zinc-500 text-xs mt-1">
                  The trainer will be able to see that the request was rejected.
                </p>
              </div>
            </div>
          </div>

          <label className="block text-sm text-zinc-300">
            Rejection Reason
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className={`
                ${inputClass}
                resize-none
              `}
              rows="4"
              placeholder="Explain why this session request is being rejected..."
            />
          </label>
        </div>
      </AdminModal>
    </div>
  );
}





function SessionCard({
  session,
  processingId,
  onApprove,
  onReject,
  onEdit,
  onTerminate,
  pending,
}) {
  const booked =
    Number(session.booking_count || 0) > 0 || Number(session.is_booked) === null;
  const maxParticipants = Number(session.max_participants || null);
  const bookingCount = Number(session.booking_count || 0);
  const availableSlots = Math.max(0, maxParticipants - bookingCount);

  const image = getSessionImage(session.session_type, session.image_url);

  return (
    <div
      className="
        group
        bg-black/40
        border border-classic-gold/10
        rounded-2xl
        overflow-hidden
        hover:border-classic-gold/30
        transition-all
        duration-300
      "
    >
      <div className="flex flex-col xl:flex-row">

        <div className="flex-1 p-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-white text-lg font-semibold">
                  {session.session_type}
                </h3>

                <span
                  className={`
                    text-xs
                    px-2.5
                    py-1
                    rounded-full
                    ${pending
                      ? "bg-yellow-500/15 text-yellow-400"
                      : "bg-emerald-500/15 text-emerald-400"
                    }
                  `}
                >
                  {pending ? "Pending Approval" : "Approved"}
                </span>

                {booked && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400">
                    Booked
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm text-zinc-400">
                <span className="flex gap-2 items-center">
                  <User className="w-4 h-4 text-classic-gold" />
                  {session.trainer_name || "No trainer"}
                </span>

                <span className="flex gap-2 items-center">
                  <Calendar className="w-4 h-4 text-classic-gold" />
                  {formatDateTime(session.start_time)}
                </span>

                <span className="flex gap-2 items-center">
                  <Clock className="w-4 h-4 text-classic-gold" />
                  {formatDateTime(session.end_time)}
                </span>

                <span className="flex gap-2 items-center text-classic-gold">
                  <DollarSign className="w-4 h-4" />₱
                  {Number(session.price || 0).toFixed(2)}
                </span>

                <span className="flex gap-2 items-center text-zinc-300">
                  <Users className="w-4 h-4 text-classic-gold" />
                  Capacity: {bookingCount}/{maxParticipants} • {availableSlots} left
                </span>
              </div>
            </div>


            <div className="flex flex-wrap gap-3">
              {pending && (
                <>
                  <button
                    disabled={processingId === session.id}
                    onClick={onApprove}
                    className="
                      px-4 py-2.5
                      rounded-xl
                      bg-emerald-600
                      text-white
                      font-semibold
                      flex gap-2
                      items-center
                      transition-all
                      duration-200
                      hover:bg-emerald-500
                      disabled:opacity-50
                    "
                  >
                    {processingId === session.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Approve
                  </button>

                  <button
                    disabled={processingId === session.id}
                    onClick={onReject}
                    className="
                      px-4 py-2.5
                      rounded-xl
                      bg-red-600
                      text-white
                      font-semibold
                      flex gap-2
                      items-center
                      transition-all
                      duration-200
                      hover:bg-red-500
                      disabled:opacity-50
                    "
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </>
              )}

              {!pending && (
                <button
                  onClick={() => onTerminate(session)}
                  disabled={booked || processingId === session.id}
                  className="
                    px-4 py-2.5
                    rounded-xl
                    bg-red-600/15
                    border border-red-400/40
                    text-red-300
                    flex gap-2
                    items-center
                    transition-all
                    duration-200
                    hover:bg-red-500/40
                    hover:text-red-50
                    hover:border-red-300/80
                    hover:shadow-[0_0_20px_rgba(239,68,68,0.45)]
                    hover:scale-[1.03]
                    disabled:opacity-40
                  "
                >
                  {processingId === session.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  {processingId === session.id ? "Terminating..." : "Terminate"}
                </button>
              )}

              {pending && !booked && (
                <button
                  onClick={() => onTerminate(session)}
                  className="
                    px-4 py-2.5
                    rounded-xl
                    bg-red-600/15
                    border border-red-400/40
                    text-red-300
                    flex gap-2
                    items-center
                    transition-all
                    duration-200
                    hover:bg-red-500/40
                    hover:text-red-50
                    hover:border-red-300/80
                    hover:shadow-[0_0_20px_rgba(239,68,68,0.45)]
                    hover:scale-[1.03]
                  "
                >
                  <Ban className="w-4 h-4" />
                  Terminate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}





function Empty({ icon: Icon, text, sub }) {
  return (
    <div className="text-center py-16 bg-black/30 rounded-2xl border border-classic-gold/10">
      <div className="w-16 h-16 rounded-2xl bg-classic-gold/5 border border-classic-gold/10 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-classic-gold/40" />
      </div>

      <p className="text-zinc-300 font-medium">{text}</p>

      <p className="text-zinc-500 text-sm mt-1">{sub}</p>
    </div>
  );
}

export default AdminSession;
