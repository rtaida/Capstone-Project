import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  Mail,
  Phone,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Filter,
  Users,
  Shield,
  UserCog,
  XCircle,
} from "lucide-react";
import SuccessModal from "../../components/memberModal/SuccessModal";
import NothingChangeModal from "../../components/memberModal/NothingChangeModal";


function Modal({
  isOpen,
  onClose,
  title,
  icon: Icon,
  iconColor = "text-classic-gold",
  children,
  maxWidth = "max-w-md",
}) {
  const modalRef = useRef(null);
  const triggerRef = useRef(null);
  const hasFocused = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasFocused.current = false;
      return;
    }

    triggerRef.current = document.activeElement;
    document.body.style.overflow = "hidden";

    const timer = setTimeout(() => {
      if (!hasFocused.current && modalRef.current) {
        const focusable = modalRef.current.querySelector(
          'input, textarea, select, button:not([aria-label="Close modal"])',
        );
        focusable?.focus();
        hasFocused.current = true;
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;

      const focusable = Array.from(
        modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      triggerRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative bg-[#111111] border border-classic-gold/20 rounded-2xl w-full ${maxWidth} shadow-2xl shadow-black/50 overflow-hidden`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-classic-gold/10">
          <div className="flex items-center gap-3">
            {Icon && (
              <div
                className={`w-10 h-10 rounded-xl bg-classic-gold/10 flex items-center justify-center ${iconColor}`}
              >
                <Icon className="w-5 h-5" />
              </div>
            )}
            <h2 id="modal-title" className="text-white text-lg font-semibold">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}


function Toast({ notification, onClose }) {
  useEffect(() => {
    if (!notification.show) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [notification.show, onClose]);

  if (!notification.show) return null;

  return (
    <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right duration-300">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md ${notification.type === "success"
            ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-400"
            : "bg-red-950/90 border-red-500/30 text-red-400"
          }`}
      >
        {notification.type === "success" ? (
          <Check className="w-5 h-5 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
        )}
        <span className="text-sm font-medium">{notification.message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-current/60 hover:text-current"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}


function normalizeAdminRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (role === "super admin" || role === "superadmin") return "Super Admin";
  if (role === "staff") return "Staff";
  return "Admin";
}

function AdminTrainerManagement({ addNotification }) {
  const [admins, setAdmins] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(6);
  const [activeTab, setActiveTab] = useState("admins");
  const [error, setError] = useState(null);
  const [trainerSessionsMap, setTrainerSessionsMap] = useState({});
  const [expandedTrainerId, setExpandedTrainerId] = useState(null);


  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [userType, setUserType] = useState("admin");


  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [successTitle, setSuccessTitle] = useState("Success");
  const [isErrorModal, setIsErrorModal] = useState(false);


  const [showNothingChangeModal, setShowNothingChangeModal] = useState(false);


  const expertiseOptions = ["Weight Lifting", "Boxing", "Personal Trainer"];

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    age: "",
    role: "Admin",
    status: "Active",
    password: "",
    confirm_password: "",
    expertise_area: "",
    profile_photo: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "",
  });

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const API_URL =
    `${import.meta.env.VITE_API_URL || "/api"}/admin_trainer_api.php`;

  const getAuthHeaders = useCallback(() => {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("auth_token") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("authToken") ||
      sessionStorage.getItem("auth_token");

    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const showNotification = useCallback((message, type) => {
    setNotification({ show: true, message, type });
  }, []);

  const hideNotification = useCallback(() => {
    setNotification({ show: false, message: "", type: "" });
  }, []);


  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}?action=get_all`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      const data = await response.json();

      if (data.success) {
        setAdmins(data.admins || []);
        setTrainers(data.trainers || []);
      } else {
        setError(data.message || "Failed to load data");
        showNotification(data.message || "Failed to load data", "error");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setError("Network error. Please check if backend is running.");
      showNotification("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }, [showNotification, getAuthHeaders]);

  useEffect(() => {
    const role = String(currentUser?.role || currentUser?.type || "").toLowerCase();
    const adminId = Number(currentUser?.id);
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("authToken");

    if (role !== "admin" || !adminId || !token) return undefined;

    let cancelled = false;

    const sendHeartbeat = async () => {
      if (cancelled) return;

      try {
        await fetch(`${API_URL}?action=heartbeat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        });
      } catch (error) {
        console.error("Admin heartbeat error:", error);
      }
    };

    // Mark this administrator online immediately, then keep last_seen fresh.
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 45_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUser?.id, currentUser?.role, currentUser?.type, getAuthHeaders]);

  const fetchTrainerSessions = useCallback(async () => {
    if (!trainers.length) {
      setTrainerSessionsMap({});
      return;
    }

    const trainerIds = [...new Set(trainers.map((trainer) => trainer.trainerID || trainer.id).filter(Boolean))];

    const results = {};
    await Promise.all(
      trainerIds.map(async (trainerId) => {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || "/api"}/trainer_api.php?action=get_trainer_sessions&trainer_id=${encodeURIComponent(trainerId)}`,
            { headers: getAuthHeaders() },
          );
          const data = await response.json();
          const sessions = (data.success ? (data.sessions || []) : []).filter(
            (session) => String(session.status || "").trim().toLowerCase() === "finished",
          );

          const membersBySession = {};
          await Promise.all(
            sessions.map(async (session) => {
              try {
                const memberResponse = await fetch(
                  `${import.meta.env.VITE_API_URL || "/api"}/trainer_api.php?action=get_session_booked_members&session_id=${encodeURIComponent(session.id)}`,
                  { headers: getAuthHeaders() },
                );
                const memberData = await memberResponse.json();
                membersBySession[session.id] = memberData.success ? (memberData.members || []) : [];
              } catch (memberError) {
                console.error(`Unable to fetch booked members for session ${session.id}:`, memberError);
                membersBySession[session.id] = [];
              }
            }),
          );

          results[trainerId] = { sessions, membersBySession };
        } catch (error) {
          console.error(`Unable to fetch trainer sessions for trainer ${trainerId}:`, error);
          results[trainerId] = { sessions: [], membersBySession: {} };
        }
      }),
    );

    setTrainerSessionsMap(results);
  }, [trainers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchTrainerSessions();
  }, [fetchTrainerSessions]);


  const addItem = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const endpoint = userType === "admin" ? "add_admin" : "add_trainer";
      const response = await fetch(`${API_URL}?action=${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      setIsAddModalOpen(false);

      if (data.success) {
        if (userType === "admin" && Number(selectedItem?.id) === Number(currentUser?.id)) {
          localStorage.setItem("user", JSON.stringify({
            ...currentUser,
            fullName: formData.full_name,
            full_name: formData.full_name,
            email: formData.email,
            profile_photo: formData.profile_photo || currentUser.profile_photo || "",
          }));
          window.dispatchEvent(new CustomEvent("admin-profile-updated", {
            detail: {
              ...currentUser,
              fullName: formData.full_name,
              full_name: formData.full_name,
              email: formData.email,
              profile_photo: formData.profile_photo || currentUser.profile_photo || "",
            },
          }));
        }
        resetForm();
        await fetchData();
        setSuccessTitle(`${userType === "admin" ? "Admin" : "Trainer"} Added`);
        setSuccessMessage(`${formData.full_name} has been added successfully!`);
        setIsErrorModal(false);
        setShowSuccessModal(true);
      } else {
        setSuccessTitle("Error");
        setSuccessMessage(data.message || `Failed to add ${userType}`);
        setIsErrorModal(true);
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error("Add error:", error);
      setIsAddModalOpen(false);
      setSuccessTitle("Error");
      setSuccessMessage("Network error. Please try again.");
      setIsErrorModal(true);
      setShowSuccessModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };


  const checkIfChangesMade = () => {
    if (!selectedItem) return false;

    const hasChanges =
      formData.full_name !== (selectedItem.full_name || "") ||
      formData.email !== (selectedItem.email || "") ||
      formData.phone !== (selectedItem.phone || "") ||
      formData.age !== (selectedItem.age || "") ||
      (userType === "admin" && formData.role !== (selectedItem.role || "Admin")) ||
      formData.status !== (selectedItem.status || "Active") ||
      formData.password !== "" ||
      formData.profile_photo !== (selectedItem.profile_photo || "");

    if (userType === "trainer") {
      const hasTrainerChanges =
        formData.expertise_area !== (selectedItem.expertise_area || "");
      return hasChanges || hasTrainerChanges;
    }

    return hasChanges;
  };


  const handleEditSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 800));

    if (!checkIfChangesMade()) {
      setIsSubmitting(false);
      setIsEditModalOpen(false);
      setShowNothingChangeModal(true);
      return;
    }

    await performUpdate();
  };


  const performUpdate = async () => {
    try {
      const updateData = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        age: formData.age,
        status: formData.status,
        id: selectedItem?.id,
        profile_photo: formData.profile_photo,
      };

      if (userType === "trainer") {
        updateData.role = "Trainer";
        updateData.expertise_area = formData.expertise_area;
      } else {
        updateData.role = formData.role;
      }

      if (formData.password) {
        updateData.password = formData.password;
      }

      const endpoint = userType === "admin" ? "update_admin" : "update_trainer";
      const response = await fetch(`${API_URL}?action=${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(updateData),
      });
      const data = await response.json();

      setIsEditModalOpen(false);

      if (data.success) {
        resetForm();
        await fetchData();
        setSuccessTitle(
          `${userType === "admin" ? "Admin" : "Trainer"} Updated`,
        );
        setSuccessMessage(
          `${formData.full_name} has been updated successfully!`,
        );
        setIsErrorModal(false);
        setShowSuccessModal(true);
      } else {
        setSuccessTitle("Error");
        setSuccessMessage(data.message || `Failed to update ${userType}`);
        setIsErrorModal(true);
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error("Update error:", error);
      setIsEditModalOpen(false);
      setSuccessTitle("Error");
      setSuccessMessage("Network error. Please try again.");
      setIsErrorModal(true);
      setShowSuccessModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleNothingChangeConfirm = () => {
    setShowNothingChangeModal(false);
    resetForm();
  };


  const deleteItem = async () => {
    setIsSubmitting(true);
    try {
      const endpoint = userType === "admin" ? "delete_admin" : "delete_trainer";
      const response = await fetch(`${API_URL}?action=${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ id: selectedItem?.id }),
      });
      const data = await response.json();

      setIsDeleteModalOpen(false);

      if (data.success) {
        setSuccessTitle(
          `${userType === "admin" ? "Admin" : "Trainer"} Deleted`,
        );
        setSuccessMessage(
          `${selectedItem?.full_name} has been deleted successfully!`,
        );
        setIsErrorModal(false);
        setShowSuccessModal(true);
        setSelectedItem(null);
        fetchData();
      } else {
        setSuccessTitle("Error");
        setSuccessMessage(data.message || `Failed to delete ${userType}`);
        setIsErrorModal(true);
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error("Delete error:", error);
      setIsDeleteModalOpen(false);
      setSuccessTitle("Error");
      setSuccessMessage("Network error. Please try again.");
      setIsErrorModal(true);
      setShowSuccessModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.full_name.trim()) errors.full_name = "Full name is required";
    if (!formData.email.trim()) errors.email = "Email is required";
    if (!formData.phone.trim()) {
      errors.phone = "Phone number is required";
    } else if (!/^09\d{9}$/.test(formData.phone.trim())) {
      errors.phone = "Enter a valid Philippine mobile number (09XXXXXXXXX)";
    }
    if (!formData.age) errors.age = "Age is required";
    if (formData.age && (formData.age < 18 || formData.age > 100))
      errors.age = "Age must be between 18 and 100";
    if (!selectedItem && !formData.password) {
      errors.password = "Password is required";
    } else if (formData.password && formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (formData.password && formData.password !== formData.confirm_password) {
      errors.confirm_password = "Passwords do not match";
    }
    if (userType === "trainer" && !formData.expertise_area) {
      errors.expertise_area = "Expertise area is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      phone: "",
      age: "",
      role: "Admin",
      status: "Active",
      password: "",
      confirm_password: "",
      expertise_area: "",
      profile_photo: "",
    });
    setFormErrors({});
    setSelectedItem(null);
  };

  const openAddModal = (type) => {
    setUserType(type);
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (item, type) => {
    setUserType(type);
    setSelectedItem(item);
    setFormData({
      full_name: item.full_name || "",
      email: item.email || "",
      phone: item.phone || "",
      age: item.age || "",
      role: normalizeAdminRole(item.role),
      status: item.status || "Active",
      password: "",
      confirm_password: "",
      expertise_area: item.expertise_area || "",
      profile_photo: item.profile_photo || "",
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (item, type) => {
    setUserType(type);
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };


  const currentItems = activeTab === "admins" ? admins : trainers;
  const idField = activeTab === "admins" ? "adminID" : "trainerID";


  const filteredItems = currentItems.filter((item) => {
    const matchesSearch =
      item.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      item.status?.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, activeTab]);

  const stats = [
    {
      label: "Total Admins",
      value: admins.length,
      color: "text-classic-gold",
      bg: "bg-classic-gold/10",
      icon: Shield,
    },
    {
      label: "Total Trainers",
      value: trainers.length,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      icon: UserCog,
    },
    {
      label: "Active",
      value: [...admins, ...trainers].filter(
        (item) => String(item.status || "").toLowerCase() === "active",
      ).length,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      icon: Check,
    },
    {
      label: "Inactive",
      value: [...admins, ...trainers].filter(
        (item) => String(item.status || "").toLowerCase() === "inactive",
      ).length,
      color: "text-red-400",
      bg: "bg-red-500/10",
      icon: XCircle,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-zinc-800/60 rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-zinc-800/40 rounded-lg animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-zinc-800/60 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 bg-zinc-800/40 rounded-xl animate-pulse border border-zinc-800/50"
            />
          ))}
        </div>
        <div className="h-12 bg-zinc-800/40 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-black/40 backdrop-blur-md rounded-2xl border border-classic-gold/10 p-5 animate-pulse"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-zinc-800/60" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-32 bg-zinc-800/60 rounded" />
                  <div className="h-3 w-24 bg-zinc-800/40 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full bg-zinc-800/40 rounded" />
                <div className="h-3 w-3/4 bg-zinc-800/40 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Toast notification={notification} onClose={hideNotification} />


      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          setSuccessMessage("");
          setSuccessTitle("Success");
          setIsErrorModal(false);
        }}
        title={successTitle}
        message={successMessage}
        isError={isErrorModal}
      />


      <NothingChangeModal
        isOpen={showNothingChangeModal}
        onClose={() => setShowNothingChangeModal(false)}
        onConfirm={handleNothingChangeConfirm}
      />


      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Admin & Trainer Management
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage all administrators and trainers in the system
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-400 hover:text-classic-gold hover:border-classic-gold/30 transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {activeTab === "admins" ? (
            <button
              onClick={() => openAddModal("admin")}
              className="flex items-center gap-2 px-4 py-2.5 bg-classic-gold text-black rounded-xl font-semibold hover:bg-light-gold transition-all shadow-lg shadow-classic-gold/20"
            >
              <Plus className="w-4 h-4" />
              Add Admin
            </button>
          ) : (
            <button
              onClick={() => openAddModal("trainer")}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              Add Trainer
            </button>
          )}
        </div>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-black/40 backdrop-blur-md border border-classic-gold/10 rounded-xl p-4 text-center hover:border-classic-gold/20 transition-all"
          >
            <div
              className={`w-8 h-8 mx-auto rounded-lg ${stat.bg} flex items-center justify-center mb-2`}
            >
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-zinc-500 text-xs uppercase tracking-wider mt-1">
              {stat.label}
            </p>
          </div>
        ))}
      </div>


      <div className="flex gap-2 border-b border-classic-gold/10 pb-2">
        <button
          onClick={() => setActiveTab("admins")}
          className={`group px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${activeTab === "admins"
              ? "bg-classic-gold text-black font-semibold"
              : "text-zinc-400 hover:text-white"
            }`}
        >
          <Shield className="w-4 h-4" />
          Administrators
          <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full transition-colors ${activeTab === "admins"
              ? "bg-black/15 text-black group-hover:text-white"
              : "bg-zinc-800 text-zinc-400 group-hover:text-white"
            }`}>
            {admins.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("trainers")}
          className={`group px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${activeTab === "trainers"
              ? "bg-classic-gold text-black font-semibold"
              : "text-zinc-400 hover:text-white"
            }`}
        >
          <UserCog className="w-4 h-4" />
          Trainers
          <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full transition-colors ${activeTab === "trainers"
              ? "bg-black/15 text-black group-hover:text-white"
              : "bg-zinc-800 text-zinc-400 group-hover:text-white"
            }`}>
            {trainers.length}
          </span>
        </button>
      </div>


      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder={`Search ${activeTab === "admins" ? "admins" : "trainers"
              } by name or email...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-classic-gold/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-classic-gold/40 focus:bg-black/60 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-black/40 border border-classic-gold/10 rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-classic-gold/40"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>


      {error ? (
        <div className="text-center py-16 bg-black/20 rounded-2xl border border-red-500/20">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-400 font-medium">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all text-sm"
          >
            Try Again
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-black/20 rounded-2xl border border-classic-gold/10 border-dashed">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-zinc-800/50 flex items-center justify-center">
            {activeTab === "admins" ? (
              <Shield className="w-10 h-10 text-zinc-600" />
            ) : (
              <UserCog className="w-10 h-10 text-zinc-600" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">
            {searchTerm || statusFilter !== "all"
              ? `No ${activeTab === "admins" ? "admins" : "trainers"} found`
              : `No ${activeTab === "admins" ? "admins" : "trainers"} yet`}
          </h3>
          <p className="text-zinc-500 text-sm">
            {searchTerm || statusFilter !== "all"
              ? "Try adjusting your search or filters"
              : `Click "Add ${activeTab === "admins" ? "Admin" : "Trainer"}" to get started`}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedItems.map((item) => (
              <div
                key={item[idField] || item.id}
                className="group relative bg-black/40 backdrop-blur-md border border-classic-gold/10 rounded-2xl p-5 hover:border-classic-gold/30 hover:bg-black/50 transition-all duration-300 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5"
              >
                <div className="absolute top-4 right-4">
                  {(() => {
                    const isAdmin = activeTab === "admins";
                    const isCurrentAdmin =
                      isAdmin && Number(item.id) === Number(currentUser?.id);

                    const isOnline = isAdmin
                      ? isCurrentAdmin || Number(item.is_online) === 1
                      : String(item.status || "").toLowerCase() === "active";

                    const label = isAdmin
                      ? (isOnline ? "Online" : "Offline")
                      : (isOnline ? "Active" : "Inactive");
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${isOnline
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                          }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400" : "bg-zinc-500"
                            }`}
                        />
                        {label}
                      </span>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-3 mb-4 pr-24">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ring-1 flex-shrink-0 overflow-hidden ${activeTab === "admins"
                        ? "bg-classic-gold/30 ring-classic-gold/20"
                        : "bg-emerald-500/30 ring-emerald-500/20"
                      }`}
                  >
                    {item.profile_photo ? (
                      <img src={item.profile_photo} alt={`${item.full_name} profile`} className="w-full h-full object-cover" />
                    ) : (
                      <span
                        className={`font-bold text-lg ${activeTab === "admins"
                            ? "text-classic-gold"
                            : "text-emerald-400"
                          }`}
                      >
                        {item.full_name?.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-semibold truncate group-hover:text-classic-gold transition-colors">
                      {item.full_name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <p className="text-zinc-500 text-xs font-mono">
                        {activeTab === "admins"
                          ? `Admin #${item.adminID || item.id}`
                          : `Trainer #${item.trainerID || item.id}`}
                      </p>
                      {activeTab === "trainers" && item.expertise_area && (
                        <span className="text-xs bg-zinc-800/50 text-zinc-400 px-2 py-0.5 rounded-full">
                          {item.expertise_area}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {activeTab === "admins" && (
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="w-4 h-4 text-classic-gold flex-shrink-0" />
                      <span className="text-classic-gold font-medium">
                        {normalizeAdminRole(item.role)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    <span className="text-zinc-300 truncate">{item.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    <span className="text-zinc-300">{item.phone}</span>
                  </div>
                  {activeTab === "trainers" && (
                    <div className="flex items-center gap-2 text-sm">
                    </div>
                  )}
                </div>

                {activeTab === "trainers" && (
                  <div className="mt-4 border-t border-classic-gold/10 pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTrainerId((current) =>
                          current === (item.trainerID || item.id) ? null : (item.trainerID || item.id),
                        )
                      }
                      className="flex w-full items-center justify-between rounded-lg border border-classic-gold/10 bg-zinc-950/40 px-3 py-2 text-left text-xs font-medium text-zinc-300 transition hover:border-classic-gold/30 hover:text-white"
                    >
                      <span>View sessions</span>
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-classic-gold">
                        {(trainerSessionsMap[item.trainerID || item.id] || []).length}
                      </span>
                    </button>

                    {expandedTrainerId === (item.trainerID || item.id) && (
                      <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-classic-gold/10 bg-black/25 p-2">
                        {((trainerSessionsMap[item.trainerID || item.id]?.sessions || [])).length === 0 ? (
                          <p className="px-2 py-3 text-xs text-zinc-500">No sessions found for this trainer.</p>
                        ) : (
                          <div className="space-y-2">
                            {(trainerSessionsMap[item.trainerID || item.id]?.sessions || []).map((session) => {
                              const bookedMembers = trainerSessionsMap[item.trainerID || item.id]?.membersBySession?.[session.id] || [];

                              return (
                                <div
                                  key={session.id}
                                  className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-white">
                                      {session.session_type || "Session"}
                                    </span>
                                    <span
                                      className={`rounded-full px-1.5 py-0.5 text-[10px] capitalize ${session.status === "finished"
                                        ? "bg-emerald-500/15 text-emerald-300"
                                        : "bg-red-500/15 text-red-300"
                                        }`}
                                    >
                                      {session.status === "finished" ? "Finished" : "Terminated"}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-[11px] text-zinc-400">
                                    {session.start_time ? new Date(session.start_time).toLocaleString() : "Schedule not set"}
                                  </div>
                                  <div className="mt-1 text-[11px] text-zinc-500">
                                    Price: {Number(session.price || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                                  </div>
                                  <div className="mt-2 border-t border-zinc-800 pt-2">
                                    <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                                      Clients who availed
                                    </div>
                                    {bookedMembers.length === 0 ? (
                                      <p className="text-[11px] text-zinc-500">No booked clients yet.</p>
                                    ) : (
                                      <ul className="max-h-24 space-y-1 overflow-y-auto pr-1">
                                        {bookedMembers.map((member) => (
                                          <li key={member.memberID || member.email || member.full_name} className="flex items-center justify-between gap-2 rounded-md bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-300">
                                            <span className="truncate">{member.full_name || "Unnamed client"}</span>
                                            <span className="text-zinc-500">#{member.memberID || "N/A"}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {(() => {
                  const isCurrentAdmin =
                    activeTab === "admins" &&
                    Number(item.id) === Number(currentUser?.id);
                  const canManage = activeTab === "trainers" || isCurrentAdmin;

                  return (
                    <div className="flex gap-2 pt-3 border-t border-classic-gold/10">
                      {canManage ? (
                        <button
                          onClick={() =>
                            openEditModal(
                              item,
                              activeTab === "admins" ? "admin" : "trainer",
                            )
                          }
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all text-sm font-medium hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Edit2 className="w-4 h-4" /> Edit
                        </button>
                      ) : (
                        <div className="w-full text-center py-2 text-xs text-zinc-600">
                          Protected administrator account
                        </div>
                      )}

                      {activeTab === "trainers" && (
                        <button
                          onClick={() =>
                            openDeleteModal(item, "trainer")
                          }
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all text-sm font-medium hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-black/40 border border-classic-gold/10 text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed hover:text-classic-gold hover:border-classic-gold/30 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${currentPage === page
                          ? "bg-classic-gold text-black"
                          : "bg-black/40 text-zinc-400 border border-classic-gold/10 hover:text-classic-gold hover:border-classic-gold/30"
                        }`}
                    >
                      {page}
                    </button>
                  ),
                )}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-black/40 border border-classic-gold/10 text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed hover:text-classic-gold hover:border-classic-gold/30 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}


      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForm();
        }}
        title={`Add New ${userType === "admin" ? "Admin" : "Trainer"}`}
        icon={userType === "admin" ? Shield : UserCog}
        iconColor={
          userType === "admin" ? "text-classic-gold" : "text-emerald-400"
        }
      >
        <form onSubmit={addItem} className="space-y-4">
          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, full_name: e.target.value }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-classic-gold/50 transition-all"
              placeholder="Juan Dela Cruz"
            />
            {formErrors.full_name && (
              <p className="text-xs text-red-400 mt-1">
                {formErrors.full_name}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-classic-gold/50 transition-all"
              placeholder="juan@example.com"
            />
            {formErrors.email && (
              <p className="text-xs text-red-400 mt-1">{formErrors.email}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Phone *
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  phone: e.target.value.replace(/\D/g, "").slice(0, 11),
                }))
              }
              inputMode="numeric"
              maxLength={11}
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-classic-gold/50 transition-all"
              placeholder="09123456789"
            />
            {formErrors.phone && (
              <p className="text-xs text-red-400 mt-1">{formErrors.phone}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Age *
              </label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, age: e.target.value }))
                }
                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-classic-gold/50 transition-all"
                placeholder="25"
              />
              {formErrors.age && (
                <p className="text-xs text-red-400 mt-1">{formErrors.age}</p>
              )}
            </div>
            {userType === "admin" && (
              <div className="space-y-1">
                <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, role: e.target.value }))
                  }
                  className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold/50 transition-all hover:border-classic-gold/60"
                >
                  <option value="Super Admin" className="bg-zinc-900 text-white">Super Admin</option>
                  <option value="Admin" className="bg-zinc-900 text-white">Admin</option>
                  <option value="Staff" className="bg-zinc-900 text-white">Staff</option>
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, status: e.target.value }))
                }
                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold/50 transition-all hover:border-classic-gold/60"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {userType === "trainer" && (
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Expertise Area *
              </label>
              <select
                value={formData.expertise_area}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    expertise_area: e.target.value,
                  }))
                }
                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold/50 transition-all"
              >
                <option value="">Select expertise area</option>
                <option value="Weight Lifting">Weight Lifting</option>
                <option value="Boxing">Boxing</option>
                <option value="Personal Trainer">Personal Trainer</option>
              </select>
              {formErrors.expertise_area && (
                <p className="text-xs text-red-400 mt-1">
                  {formErrors.expertise_area}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Password *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-classic-gold/50 focus:ring-1 focus:ring-classic-gold/20 transition-all"
              placeholder="Enter password (min 6 characters)"
            />
            {formErrors.password && (
              <p className="text-xs text-red-400 mt-1">{formErrors.password}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Confirm Password *
            </label>
            <input
              type="password"
              value={formData.confirm_password}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, confirm_password: e.target.value }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-classic-gold/50 focus:ring-1 focus:ring-classic-gold/20 transition-all"
              placeholder="Confirm password"
            />
            {formErrors.confirm_password && (
              <p className="text-xs text-red-400 mt-1">{formErrors.confirm_password}</p>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-3 pt-4 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                resetForm();
              }}
              className="rounded-xl border border-zinc-700 bg-transparent px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800/70 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`rounded-xl border px-5 py-2.5 text-sm font-semibold shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                userType === "admin"
                  ? "border-classic-gold/40 bg-classic-gold text-black shadow-classic-gold/10 hover:bg-yellow-500"
                  : "border-emerald-400/40 bg-emerald-500 text-white shadow-emerald-500/10 hover:bg-emerald-600"
              }`}
            >
              {isSubmitting ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>


      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          resetForm();
        }}
        title={`Edit ${userType === "admin" ? "Admin" : "Trainer"}`}
        icon={Edit2}
        iconColor="text-blue-400"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">Profile Image</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file || file.size > 5 * 1024 * 1024) return;
                const reader = new FileReader();
                reader.onload = () => setFormData((prev) => ({ ...prev, profile_photo: String(reader.result || "") }));
                reader.readAsDataURL(file);
              }}
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-classic-gold file:px-3 file:py-1.5 file:font-semibold file:text-black"
            />
            {formData.profile_photo && <img src={formData.profile_photo} alt="Profile preview" className="mt-2 h-16 w-16 rounded-full object-cover ring-2 ring-classic-gold/30" />}
          </div>
          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Full Name *
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, full_name: e.target.value }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500/50 transition-all"
            />
            {formErrors.full_name && (
              <p className="text-xs text-red-400 mt-1">
                {formErrors.full_name}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500/50 transition-all"
            />
            {formErrors.email && (
              <p className="text-xs text-red-400 mt-1">{formErrors.email}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Phone *
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  phone: e.target.value.replace(/\D/g, "").slice(0, 11),
                }))
              }
              inputMode="numeric"
              maxLength={11}
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500/50 transition-all"
            />
            {formErrors.phone && (
              <p className="text-xs text-red-400 mt-1">{formErrors.phone}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Age *
              </label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, age: e.target.value }))
                }
                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500/50 transition-all"
              />
              {formErrors.age && (
                <p className="text-xs text-red-400 mt-1">{formErrors.age}</p>
              )}
            </div>
            {userType === "admin" && (
              <div className="space-y-1">
                <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, role: e.target.value }))
                  }
                  className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold/50 transition-all hover:border-classic-gold/60"
                >
                  <option value="Super Admin" className="bg-zinc-900 text-white">Super Admin</option>
                  <option value="Admin" className="bg-zinc-900 text-white">Admin</option>
                  <option value="Staff" className="bg-zinc-900 text-white">Staff</option>
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, status: e.target.value }))
                }
                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500/50 transition-all"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {userType === "trainer" && (
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Expertise Area
              </label>
              <select
                value={formData.expertise_area}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    expertise_area: e.target.value,
                  }))
                }
                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500/50 transition-all"
              >
                <option value="">Select expertise area</option>
                <option value="Weight Lifting">Weight Lifting</option>
                <option value="Boxing">Boxing</option>
                <option value="Personal Trainer">Personal Trainer</option>
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Password (leave blank to keep current)
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  password: e.target.value,
                  confirm_password: e.target.value ? prev.confirm_password : "",
                }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              placeholder="Enter new password"
            />
            {formErrors.password && (
              <p className="text-xs text-red-400 mt-1">{formErrors.password}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Confirm Password
            </label>
            <input
              type="password"
              value={formData.confirm_password}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, confirm_password: e.target.value }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              placeholder="Confirm new password"
            />
            {formErrors.confirm_password && (
              <p className="text-xs text-red-400 mt-1">{formErrors.confirm_password}</p>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-3 pt-4 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                resetForm();
              }}
              className="rounded-xl border border-zinc-700 bg-transparent px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800/70 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl border border-blue-400/40 bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/10 transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Save changes"}
            </button>
          </div>

        </form>
      </Modal>


      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={`Delete ${userType === "admin" ? "Admin" : "Trainer"}`}
        icon={AlertCircle}
        iconColor="text-red-500"
        maxWidth="max-w-sm"
      >
        <div className="text-center py-2">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center ring-1 ring-red-500/20">
            <Trash2 className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-zinc-300 mb-1">Are you sure you want to delete</p>
          <p className="text-white font-semibold text-lg mb-4">
            {selectedItem?.full_name}
          </p>
          <p className="text-zinc-500 text-sm mb-6">
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              onClick={deleteItem}
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {isSubmitting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AdminTrainerManagement;
