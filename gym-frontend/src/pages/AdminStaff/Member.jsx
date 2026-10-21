import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  Mail,
  Phone,
  Calendar,
  QrCode,
  Download,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Filter,
  Users,
  Ruler,
  Weight,
  CreditCard,
  CheckCircle,
  UserCheck,
} from "lucide-react";
import SuccessModal from "../../components/memberModal/SuccessModal";
import NothingChangeModal from "../../components/memberModal/NothingChangeModal";
import MemberExistsModal from "../../components/memberModal/MemberExistsModal";
import { toPng } from "html-to-image";
import QRCode from "qrcode";
import Logo from "../../assets/logo.png";
import { buildMemberFullName, splitMemberName } from "../../utils/memberName";

const formatDateInput = (value) => (value ? String(value).slice(0, 10) : "");

const getBirthDateBounds = () => {
  const latest = new Date();
  latest.setFullYear(latest.getFullYear() - 12);
  const earliest = new Date();
  earliest.setFullYear(earliest.getFullYear() - 120);
  const toInputValue = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  };
  return { min: toInputValue(earliest), max: toInputValue(latest) };
};

const formatBirthDate = (value) => {
  const dateValue = formatDateInput(value);
  if (!dateValue) return "N/A";
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString();
};

const getAgeFromBirthDate = (value) => {
  const dateValue = formatDateInput(value);
  if (!dateValue) return null;
  const birthDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
};

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

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 pt-16 pb-4">
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
        className={`relative flex max-h-[90dvh] min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-classic-gold/20 bg-[#111111] ${maxWidth} shadow-2xl shadow-black/50`}
        style={{ maxHeight: "min(90dvh, calc(100dvh - 5rem))" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-classic-gold/10 px-6 py-4">
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

        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>,
    document.body,
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

function Member() {
  const birthDateBounds = getBirthDateBounds();
  const [activeView, setActiveView] = useState("members");
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(9);
  const [error, setError] = useState(null);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [approvalProcessingId, setApprovalProcessingId] = useState(null);
  const [approvalRejectMember, setApprovalRejectMember] = useState(null);
  const [approvalRejectReason, setApprovalRejectReason] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [qrImageBase64, setQrImageBase64] = useState(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [expandedMemberId, setExpandedMemberId] = useState(null);


  const cardRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);


  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [successTitle, setSuccessTitle] = useState("Success");
  const [isErrorModal, setIsErrorModal] = useState(false);


  const [showMemberExistsModal, setShowMemberExistsModal] = useState(false);
  const [existingEmail, setExistingEmail] = useState("");


  const [showNothingChangeModal, setShowNothingChangeModal] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    first_name: "",
    last_name: "",
    middle_initial: "",
    email: "",
    phone: "",
    weight: "",
    height: "",
    date_of_birth: "",
    age: "",
    gender: "Male",
    status: "active",
    password: "",
    payment_method: "Cash",
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "",
  });

  const API_URL =
    `${import.meta.env.VITE_API_URL || "/api"}/member_api.php`;

  const updateNamePart = (field, value) => {
    setFormData((current) => {
      const updated = { ...current, [field]: value };
      updated.full_name = buildMemberFullName(updated);
      return updated;
    });
  };

  const showNotification = useCallback((message, type) => {
    setNotification({ show: true, message, type });
  }, []);

  const hideNotification = useCallback(() => {
    setNotification({ show: false, message: "", type: "" });
  }, []);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}?action=get`);
      const data = await response.json();

      if (data.success) {
        setMembers(data.members || []);
      } else {
        setError(data.message || "Failed to load members");
        showNotification(data.message || "Failed to load members", "error");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setError("Network error. Please check if backend is running.");
      showNotification("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  const fetchPendingMembers = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}?action=get_pending_members`);
      const data = await response.json();
      if (!data.success)
        throw new Error(data.message || "Failed to load pending members");
      setPendingMembers(data.members || []);
    } catch (err) {
      showNotification(
        err.message || "Unable to load pending members.",
        "error",
      );
    }
  }, [showNotification]);

  useEffect(() => {
    fetchMembers();
    fetchPendingMembers();
  }, [fetchMembers, fetchPendingMembers]);

  const approvePendingMember = async (member) => {
    setApprovalProcessingId(member.memberID);
    try {
      const response = await fetch(`${API_URL}?action=approve_member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: Number(member.memberID) }),
      });
      const data = await response.json();
      if (!data.success)
        throw new Error(data.message || "Unable to approve member.");
      setPendingMembers((prev) =>
        prev.filter((m) => m.memberID !== member.memberID),
      );
      await fetchMembers();
      setSuccessTitle("Member Approved");
      setSuccessMessage(`${member.full_name} has been approved successfully.`);
      setIsErrorModal(false);
      setShowSuccessModal(true);
    } catch (err) {
      setSuccessTitle("Approval Failed");
      setSuccessMessage(err.message || "Unable to approve member.");
      setIsErrorModal(true);
      setShowSuccessModal(true);
    } finally {
      setApprovalProcessingId(null);
    }
  };

  const rejectPendingMember = async () => {
    if (!approvalRejectMember) return;
    if (!approvalRejectReason.trim()) {
      setSuccessTitle("Rejection Reason Required");
      setSuccessMessage("Please provide a reason for rejecting this member.");
      setIsErrorModal(true);
      setShowSuccessModal(true);
      return;
    }
    setApprovalProcessingId(approvalRejectMember.memberID);
    try {
      const response = await fetch(`${API_URL}?action=reject_member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: Number(approvalRejectMember.memberID),
          rejection_reason: approvalRejectReason.trim(),
        }),
      });
      const data = await response.json();
      if (!data.success)
        throw new Error(data.message || "Unable to reject member.");
      setPendingMembers((prev) =>
        prev.filter((m) => m.memberID !== approvalRejectMember.memberID),
      );
      setApprovalRejectMember(null);
      setApprovalRejectReason("");
      setSuccessTitle("Member Rejected");
      setSuccessMessage(`${approvalRejectMember.full_name} has been rejected.`);
      setIsErrorModal(false);
      setShowSuccessModal(true);
      await fetchMembers();
    } catch (err) {
      setSuccessTitle("Rejection Failed");
      setSuccessMessage(err.message || "Unable to reject member.");
      setIsErrorModal(true);
      setShowSuccessModal(true);
    } finally {
      setApprovalProcessingId(null);
    }
  };

  const addMember = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}?action=add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();


      setIsAddModalOpen(false);

      if (data.success) {
        resetForm();
        await fetchMembers();
        setSuccessTitle("Member Added");
        setSuccessMessage(`${formData.full_name} has been added successfully!`);
        setIsErrorModal(false);
        setShowSuccessModal(true);
      } else {

        if (
          data.message &&
          data.message.toLowerCase().includes("email already exists")
        ) {
          setExistingEmail(formData.email);
          setShowMemberExistsModal(true);
        } else {
          setSuccessTitle("Error");
          setSuccessMessage(data.message || "Failed to add member");
          setIsErrorModal(true);
          setShowSuccessModal(true);
        }
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
    if (!selectedMember) return false;

    const hasChanges =
      formData.first_name !== splitMemberName(selectedMember).first_name ||
      formData.last_name !== splitMemberName(selectedMember).last_name ||
      formData.middle_initial !== splitMemberName(selectedMember).middle_initial ||
      formData.email !== (selectedMember.email || "") ||
      formData.phone !== (selectedMember.phone || "") ||
      formData.weight !== (selectedMember.weight || "") ||
      formData.height !== (selectedMember.height || "") ||
      formData.date_of_birth !== formatDateInput(selectedMember.date_of_birth) ||
      formData.gender !== (selectedMember.gender || "Male") ||
      formData.status !== (selectedMember.status || "active") ||
      formData.payment_method !== (selectedMember.payment_method || "Cash");

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
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_initial: formData.middle_initial,
        email: formData.email,
        phone: formData.phone,
        weight: formData.weight,
        height: formData.height,
        age: formData.age,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender,
        status: formData.status,
        payment_method: formData.payment_method,
        member_id: selectedMember?.memberID,
      };

      const response = await fetch(`${API_URL}?action=update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      const data = await response.json();

      setIsEditModalOpen(false);

      if (data.success) {
        resetForm();
        await fetchMembers();
        setSuccessTitle("Member Updated");
        setSuccessMessage(
          `${formData.full_name} has been updated successfully!`,
        );
        setIsErrorModal(false);
        setShowSuccessModal(true);
      } else {
        if (
          data.message &&
          data.message.toLowerCase().includes("email already exists")
        ) {
          setExistingEmail(formData.email);
          setShowMemberExistsModal(true);
        } else {
          setSuccessTitle("Error");
          setSuccessMessage(data.message || "Failed to update member");
          setIsErrorModal(true);
          setShowSuccessModal(true);
        }
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

  const deleteMember = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}?action=delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: selectedMember?.memberID }),
      });
      const data = await response.json();


      setIsDeleteModalOpen(false);

      if (data.success) {
        setSuccessTitle("Member Deleted");
        setSuccessMessage(
          `${selectedMember?.full_name} has been deleted successfully!`,
        );
        setIsErrorModal(false);
        setShowSuccessModal(true);
        setSelectedMember(null);
        fetchMembers();
      } else {
        setSuccessTitle("Error");
        setSuccessMessage(data.message || "Failed to delete member");
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


  const generateQRCode = async (member) => {
    setSelectedMember(member);
    setQrImageBase64(null);
    setIsQrModalOpen(true);
    setIsLoadingQr(true);

    try {
      const memberId = Number(member?.memberID || 0);

      if (!memberId) {
        throw new Error("Member ID is missing.");
      }

      const qrData = JSON.stringify({
        member_id: memberId,
        full_name: member?.full_name || "Member",
        email: member?.email || "",
      });

      // Generate the QR code locally in the browser.
      // This avoids the previous dependency on api.qrserver.com,
      // which can fail because of network/CORS restrictions.
      const dataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: "M",
      });

      setQrImageBase64(dataUrl);
    } catch (error) {
      console.error("Error generating QR code:", error);
      showNotification(
        error?.message || "Failed to generate QR code.",
        "error",
      );
    } finally {
      setIsLoadingQr(false);
    }
  };

  const downloadQRCard = async () => {
    if (!cardRef.current) {
      showNotification("Card not ready. Please wait.", "error");
      return;
    }

    setIsDownloading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#0a0a0a",
        skipAutoScale: false,
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `capra_qrcode_${(selectedMember?.full_name || "member").replace(/\s/g, "_")}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showNotification("QR Card downloaded successfully!", "success");
    } catch (error) {
      console.error("Error downloading card:", error);
      showNotification(
        "Failed to download QR card. Please try again.",
        "error",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.first_name.trim()) errors.first_name = "First name is required";
    if (!formData.last_name.trim()) errors.last_name = "Last name is required";
    if (formData.first_name.length > 100) errors.first_name = "First name must be 100 characters or fewer";
    if (formData.last_name.length > 100) errors.last_name = "Last name must be 100 characters or fewer";
    if (!formData.email.trim()) errors.email = "Email is required";
    if (!formData.phone.trim()) {
      errors.phone = "Contact number is required";
    } else if (!/^09\d{9}$/.test(formData.phone.trim())) {
      errors.phone = "Enter a valid Philippine mobile number (11 digits, e.g. 09123456789)";
    }
    if (!formData.date_of_birth && (!selectedMember || selectedMember.date_of_birth)) {
      errors.date_of_birth = "Birthdate is required";
    } else if (formData.date_of_birth && (formData.date_of_birth < birthDateBounds.min || formData.date_of_birth > birthDateBounds.max)) {
      errors.date_of_birth = "Member must be between 12 and 120 years old";
    }

    if (!selectedMember && !formData.password) {
      errors.password = "Password is required";
    } else if (formData.password && formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (!selectedMember && formData.password !== formData.confirm_password) {
      errors.confirm_password = "Passwords do not match";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      first_name: "",
      last_name: "",
      middle_initial: "",
      email: "",
      phone: "",
      weight: "",
      height: "",
      date_of_birth: "",
      age: "",
      gender: "Male",
      status: "active",
      password: "",
      confirm_password: "",
      payment_method: "Cash",
    });
    setFormErrors({});
    setSelectedMember(null);
  };

  const openEditModal = (member) => {
    setSelectedMember(member);
    const nameParts = splitMemberName(member);
    setFormData({
      full_name: buildMemberFullName(nameParts),
      ...nameParts,
      email: member.email || "",
      phone: member.phone || "",
      weight: member.weight || "",
      height: member.height || "",
      date_of_birth: formatDateInput(member.date_of_birth),
      age: member.age || "",
      gender: member.gender || "Male",
      status: member.status || "active",
      password: "",
      confirm_password: "",
      payment_method: member.payment_method || "Cash",
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (member) => {
    setSelectedMember(member);
    setIsDeleteModalOpen(true);
  };

  const filteredMembers = [...members]
    .filter((member) => {
      const matchesSearch =
        member.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.memberID?.toString().includes(searchTerm) ||
        member.email?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "most_active") {
        return Number(member.check_in_count || 0) > 0;
      }

      return statusFilter === "all" || member.status === statusFilter;
    })
    .sort((a, b) => {
      if (statusFilter === "most_active") {
        return Number(b.check_in_count || 0) - Number(a.check_in_count || 0);
      }
      return 0;
    });

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const stats = [
    {
      label: "Total",
      value: members.length,
      color: "text-classic-gold",
      bg: "bg-classic-gold/10",
    },
    {
      label: "Active",
      value: members.filter((m) => m.status === "active").length,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Inactive",
      value: members.filter((m) => m.status === "inactive").length,
      color: "text-red-400",
      bg: "bg-red-500/10",
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-zinc-800/40 rounded-xl animate-pulse border border-zinc-800/50"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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







  if (activeView === "approvals") {
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


        {approvalRejectMember && (
          <Modal
            isOpen={!!approvalRejectMember}
            onClose={() => {
              if (approvalProcessingId === null) {
                setApprovalRejectMember(null);
                setApprovalRejectReason("");
              }
            }}
            title="Reject Member"
            icon={AlertCircle}
            iconColor="text-red-400"
          >
            <p className="text-zinc-300 text-sm mb-3">
              Why are you rejecting{" "}
              <span className="text-white font-semibold">
                {approvalRejectMember.full_name}
              </span>
              ?
            </p>

            <textarea
              value={approvalRejectReason}
              onChange={(e) => setApprovalRejectReason(e.target.value)}
              disabled={approvalProcessingId !== null}
              rows={4}
              placeholder="Enter rejection reason..."
              className="w-full rounded-xl bg-black/50 border border-zinc-700 p-3 text-white placeholder:text-zinc-600 outline-none resize-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/10 transition-all disabled:opacity-50"
            />

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                disabled={approvalProcessingId !== null}
                onClick={() => {
                  setApprovalRejectMember(null);
                  setApprovalRejectReason("");
                }}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={rejectPendingMember}
                disabled={
                  approvalProcessingId === approvalRejectMember.memberID
                }
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {approvalProcessingId === approvalRejectMember.memberID ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    Confirm Reject
                  </>
                )}
              </button>
            </div>
          </Modal>
        )}


        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView("members")}
              className="w-10 h-10 rounded-xl bg-zinc-800/60 border border-zinc-700 text-zinc-400 hover:text-classic-gold hover:border-classic-gold/30 transition-all flex items-center justify-center"
              title="Back to Member Management"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Member Approvals
              </h1>
              <p className="text-zinc-400 text-sm mt-1">
                Review and approve new member registrations.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchPendingMembers}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700 text-zinc-300 hover:text-classic-gold hover:border-classic-gold/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>


        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-black/40 backdrop-blur-md border border-classic-gold/10 rounded-2xl p-5 hover:border-classic-gold/20 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-wider">
                  Pending
                </p>
                <p className="text-3xl font-bold text-classic-gold mt-1">
                  {pendingMembers.length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-classic-gold/10 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-classic-gold" />
              </div>
            </div>
          </div>

          <div className="bg-black/40 backdrop-blur-md border border-classic-gold/10 rounded-2xl p-5 hover:border-classic-gold/20 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-wider">
                  Awaiting Review
                </p>
                <p className="text-3xl font-bold text-yellow-400 mt-1">
                  {pendingMembers.length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="bg-black/40 backdrop-blur-md border border-classic-gold/10 rounded-2xl p-5 hover:border-classic-gold/20 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-xs uppercase tracking-wider">
                  Current Queue
                </p>
                <p className="text-3xl font-bold text-white mt-1">
                  {pendingMembers.length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                <Users className="w-6 h-6 text-zinc-400" />
              </div>
            </div>
          </div>
        </div>


        {pendingMembers.length === 0 ? (
          <div className="text-center py-20 bg-black/30 rounded-2xl border border-classic-gold/10">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-10 h-10 text-emerald-400/70" />
            </div>

            <h2 className="text-white text-lg font-semibold">
              No Pending Approvals
            </h2>

            <p className="text-zinc-500 text-sm mt-2">
              New member registrations waiting for admin review will appear
              here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingMembers.map((member) => {
              const isProcessing = approvalProcessingId === member.memberID;

              return (
                <div
                  key={member.memberID}
                  className="group bg-black/40 backdrop-blur-md border border-yellow-500/10 rounded-2xl p-5 hover:border-classic-gold/25 hover:bg-black/50 transition-all duration-300"
                >
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-classic-gold/30 to-classic-gold/5 border border-classic-gold/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {member.profile_photo ? (
                          <img src={member.profile_photo} alt={`${member.full_name} profile`} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-classic-gold font-bold text-xl">
                            {member.full_name?.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-white font-semibold text-lg">
                            {member.full_name}
                          </h2>

                          <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/10 text-yellow-400">
                            Pending Approval
                          </span>
                        </div>

                        <p className="text-zinc-500 text-xs font-mono mt-1">
                          Member ID: {member.memberID}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 mt-4">
                          <span className="flex items-center gap-2 text-sm text-zinc-400 min-w-0">
                            <Mail className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                            <span className="truncate">
                              {member.email || "No email"}
                            </span>
                          </span>

                          <span className="flex items-center gap-2 text-sm text-zinc-400">
                            <Phone className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                            {member.phone || "No phone"}
                          </span>

                          <span className="flex items-center gap-2 text-sm text-zinc-400">
                            <Calendar className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                            {member.age ? `${member.age} years old` : "Age N/A"}
                          </span>

                          <span className="flex items-center gap-2 text-sm text-zinc-400">
                            <UserCheck className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                            {member.gender || "Gender N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 shrink-0">
                      <button
                        type="button"
                        disabled={approvalProcessingId !== null}
                        onClick={() => approvePendingMember(member)}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        {isProcessing ? "Approving..." : "Approve"}
                      </button>

                      <button
                        type="button"
                        disabled={approvalProcessingId !== null}
                        onClick={() => {
                          setApprovalRejectMember(member);
                          setApprovalRejectReason("");
                        }}
                        className="px-5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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


      <MemberExistsModal
        isOpen={showMemberExistsModal}
        onClose={() => {
          setShowMemberExistsModal(false);
          setExistingEmail("");
        }}
        email={existingEmail}
      />


      <NothingChangeModal
        isOpen={showNothingChangeModal}
        onClose={() => setShowNothingChangeModal(false)}
        onConfirm={handleNothingChangeConfirm}
      />


      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Member Management
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage all gym members, generate QR codes, and track memberships
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMembers}
            className="p-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-400 hover:text-classic-gold hover:border-classic-gold/30 transition-all"
            title="Refresh members"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setActiveView("approvals");
              fetchPendingMembers();
            }}
            className="relative flex items-center gap-2 px-4 py-2.5 bg-classic-gold text-black rounded-xl font-semibold hover:bg-light-gold transition-all shadow-lg shadow-classic-gold/20 hover:shadow-classic-gold/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <UserCheck className="w-4 h-4" />
            Member Approvals
            {pendingMembers.length > 0 && (
              <span className="min-w-5 h-5 px-1 rounded-full bg-yellow-500 text-black text-xs flex items-center justify-center">
                {pendingMembers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-classic-gold text-black rounded-xl font-semibold hover:bg-light-gold transition-all shadow-lg shadow-classic-gold/20 hover:shadow-classic-gold/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Add New Member
          </button>
        </div>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-black/40 backdrop-blur-md border border-classic-gold/10 rounded-xl p-4 text-center hover:border-classic-gold/20 transition-all"
          >
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-zinc-500 text-xs uppercase tracking-wider mt-1">
              {stat.label}
            </p>
          </div>
        ))}
      </div>


      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
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
            <option value="most_active">Most Check-ins</option>
          </select>
        </div>
      </div>


      {error ? (
        <div className="text-center py-16 bg-black/20 rounded-2xl border border-red-500/20">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-400 font-medium">{error}</p>
          <button
            onClick={fetchMembers}
            className="mt-4 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all text-sm"
          >
            Try Again
          </button>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-16 bg-black/20 rounded-2xl border border-classic-gold/10 border-dashed">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-zinc-800/50 flex items-center justify-center">
            <Users className="w-10 h-10 text-zinc-600" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">
            {searchTerm || statusFilter !== "all"
              ? "No members found"
              : "No members yet"}
          </h3>
          <p className="text-zinc-500 text-sm">
            {searchTerm || statusFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Click 'Add New Member' to get started"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedMembers.map((member) => (
              <article
                key={member.memberID}
                className="group relative bg-black/40 backdrop-blur-md border border-classic-gold/10 rounded-2xl p-5 hover:border-classic-gold/30 hover:bg-black/50 transition-all duration-300 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => setExpandedMemberId((current) => current === member.memberID ? null : member.memberID)}
                  aria-expanded={expandedMemberId === member.memberID}
                  aria-label={`${expandedMemberId === member.memberID ? "Hide" : "Show"} full details for ${member.full_name}`}
                  className="w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-classic-gold/70"
                >
                <div className="absolute top-4 right-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${member.status === "active"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                      : "bg-red-500/15 text-red-400 border-red-500/20"
                      }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${member.status === "active"
                        ? "bg-emerald-400"
                        : "bg-red-400"
                        }`}
                    />
                    {member.status}
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-4 pr-24">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-classic-gold/30 to-classic-gold/5 flex items-center justify-center ring-1 ring-classic-gold/20 flex-shrink-0 overflow-hidden">
                    {member.profile_photo ? (
                      <img src={member.profile_photo} alt={`${member.full_name} profile`} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-classic-gold font-bold text-lg">
                        {member.full_name?.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-semibold truncate group-hover:text-classic-gold transition-colors">
                      {member.full_name}
                    </h3>
                    <p className="text-zinc-500 text-xs font-mono">
                      ID: {member.memberID}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    <span className="text-zinc-300 truncate">
                      {member.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    <span className="text-zinc-300">
                      {member.phone || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Weight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    <span className="text-zinc-300">
                      {member.weight ? `${member.weight} kg` : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Ruler className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    <span className="text-zinc-300">
                      {member.height ? `${member.height} cm` : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    <span className="text-zinc-300">
                      {formatBirthDate(member.date_of_birth)}
                      {getAgeFromBirthDate(member.date_of_birth) !== null &&
                        ` (${getAgeFromBirthDate(member.date_of_birth)} years old)`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    <span className="text-zinc-300">
                      {Number(member.check_in_count || 0)} check-ins
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                    <span className="text-zinc-300">
                      {member.payment_method || "Cash"}
                    </span>
                  </div>
                </div>

                {expandedMemberId === member.memberID && (
                  <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-classic-gold/10 bg-black/30 p-3 text-sm">
                    <div>
                      <p className="text-xs text-zinc-500">Gender</p>
                      <p className="text-zinc-200">{member.gender || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Member since</p>
                      <p className="text-zinc-200">{formatBirthDate(member.created_at)}</p>
                    </div>
                  </div>
                )}
                <div className="mb-3 flex items-center justify-center gap-1 text-xs text-zinc-500">
                  {expandedMemberId === member.memberID ? "Less details" : "More details"}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedMemberId === member.memberID ? "rotate-180" : ""}`} />
                </div>
                </button>

                <div className="flex gap-2 pt-3 border-t border-classic-gold/10">
                  <button
                    onClick={() => generateQRCode(member)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-classic-gold/10 hover:bg-classic-gold/20 text-classic-gold rounded-lg transition-all text-sm font-medium hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <QrCode className="w-4 h-4" /> QR
                  </button>
                  <button
                    onClick={() => openEditModal(member)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all text-sm font-medium hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => openDeleteModal(member)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all text-sm font-medium hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </article>
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
        title="Add New Member"
        icon={Plus}
      >
        <form onSubmit={addMember} className="space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6.5rem] gap-3">
            {[
              ["last_name", "Last name *", "Dela Cruz", 100],
              ["first_name", "First name *", "Juan", 100],
              ["middle_initial", "Middle initial", "A", 1],
            ].map(([field, label, placeholder, maxLength]) => (
              <div key={field} className="space-y-1">
                <label className={`text-zinc-400 text-xs uppercase tracking-wider font-medium ${field === "middle_initial" ? "whitespace-nowrap text-[10px] tracking-wide" : ""}`}>{label}</label>
                <input
                  type="text"
                  value={formData[field]}
                  maxLength={maxLength}
                  onChange={(e) => updateNamePart(field, field === "middle_initial" ? e.target.value.slice(0, 1).toLocaleUpperCase() : e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900/50 p-3 text-white placeholder:text-zinc-600 transition-all focus:border-classic-gold/50 focus:outline-none focus:ring-1 focus:ring-classic-gold/20"
                  placeholder={placeholder}
                />
                {formErrors[field] && <p className="text-xs text-red-400 mt-1">{formErrors[field]}</p>}
              </div>
            ))}
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
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-classic-gold/50 focus:ring-1 focus:ring-classic-gold/20 transition-all"
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
              type="tel"
              inputMode="numeric"
              maxLength={11}
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  phone: e.target.value.replace(/\D/g, "").slice(0, 11),
                }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-classic-gold/50 focus:ring-1 focus:ring-classic-gold/20 transition-all"
              placeholder="09123456789"
            />
            {formErrors.phone && (
              <p className="text-xs text-red-400 mt-1">{formErrors.phone}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Weight (kg)
              </label>
              <input
                type="text"
                value={formData.weight}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, weight: e.target.value }))
                }
                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-classic-gold/50 focus:ring-1 focus:ring-classic-gold/20 transition-all"
                placeholder="70"
              />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Height (cm)
              </label>
              <input
                type="text"
                value={formData.height}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, height: e.target.value }))
                }
                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-classic-gold/50 focus:ring-1 focus:ring-classic-gold/20 transition-all"
                placeholder="175"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Birthdate *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="date"
                  value={formData.date_of_birth}
                  min={birthDateBounds.min}
                  max={birthDateBounds.max}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date_of_birth: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900/50 p-3 pl-10 text-white focus:border-classic-gold/50 focus:outline-none focus:ring-1 focus:ring-classic-gold/20"
                />
              </div>
              {formErrors.date_of_birth && (
                <p className="text-xs text-red-400 mt-1">{formErrors.date_of_birth}</p>
              )}
              {formData.date_of_birth && (
                <p className="mt-1 text-xs text-zinc-500">Age: {getAgeFromBirthDate(formData.date_of_birth)} years</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, gender: e.target.value }))
                }
                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold/50 focus:ring-1 focus:ring-classic-gold/20 transition-all"
              >
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Payment Method
            </label>
            <select
              value={formData.payment_method}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  payment_method: e.target.value,
                }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold/50 focus:ring-1 focus:ring-classic-gold/20 transition-all"
            >
              <option value="Cash">Cash</option>
              <option value="GCash">GCash</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, status: e.target.value }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold/50 focus:ring-1 focus:ring-classic-gold/20 transition-all"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

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
              placeholder="Enter password"
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
              className="rounded-xl border border-classic-gold/40 bg-classic-gold px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-classic-gold/10 transition-all hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
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
        title="Edit Member"
        icon={Edit2}
        iconColor="text-blue-400"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6.5rem] gap-3">
            {[
              ["last_name", "Last name *", "Dela Cruz", 100],
              ["first_name", "First name *", "Juan", 100],
              ["middle_initial", "Middle initial", "A", 1],
            ].map(([field, label, placeholder, maxLength]) => (
              <div key={field} className="space-y-1">
                <label className={`text-zinc-400 text-xs uppercase tracking-wider font-medium ${field === "middle_initial" ? "whitespace-nowrap text-[10px] tracking-wide" : ""}`}>{label}</label>
                <input
                  type="text"
                  value={formData[field]}
                  maxLength={maxLength}
                  onChange={(e) => updateNamePart(field, field === "middle_initial" ? e.target.value.slice(0, 1).toLocaleUpperCase() : e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900/50 p-3 text-white transition-all focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                  placeholder={placeholder}
                />
                {formErrors[field] && <p className="text-xs text-red-400 mt-1">{formErrors[field]}</p>}
              </div>
            ))}
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
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
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
              type="tel"
              inputMode="numeric"
              maxLength={11}
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  phone: e.target.value.replace(/\D/g, "").slice(0, 11),
                }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
            {formErrors.phone && (
              <p className="text-xs text-red-400 mt-1">{formErrors.phone}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Weight (kg)
              </label>
              <input
                type="text"
                value={formData.weight}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, weight: e.target.value }))
                }
                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Height (cm)
              </label>
              <input
                type="text"
                value={formData.height}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, height: e.target.value }))
                }
                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Birthdate *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="date"
                  value={formData.date_of_birth}
                  min={birthDateBounds.min}
                  max={birthDateBounds.max}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date_of_birth: e.target.value }))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900/50 p-3 pl-10 text-white focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                />
              </div>
              {formErrors.date_of_birth && (
                <p className="text-xs text-red-400 mt-1">{formErrors.date_of_birth}</p>
              )}
              {formData.date_of_birth && (
                <p className="mt-1 text-xs text-zinc-500">Age: {getAgeFromBirthDate(formData.date_of_birth)} years</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, gender: e.target.value }))
                }
                className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              >
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Payment Method
            </label>
            <select
              value={formData.payment_method}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  payment_method: e.target.value,
                }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            >
              <option value="Cash">Cash</option>
              <option value="GCash">GCash</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wider font-medium">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, status: e.target.value }))
              }
              className="w-full p-3 bg-zinc-900/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>



          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {isSubmitting ? "Checking..." : "Update Member"}
          </button>
        </form>
      </Modal>


      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Member"
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
            {selectedMember?.full_name}
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
              onClick={deleteMember}
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


      <Modal
        isOpen={isQrModalOpen}
        onClose={() => {
          setIsQrModalOpen(false);
          setQrImageBase64(null);
        }}
        title="Member QR Card"
        icon={QrCode}
        maxWidth="max-w-lg"
      >
        <div className="flex flex-col items-center justify-center py-4">
          <div
            ref={cardRef}
            className="bg-gradient-to-br from-zinc-900 to-black rounded-2xl border-2 border-classic-gold border-4 p-8 text-center max-w-md w-full shadow-2xl"
            style={{ backgroundColor: "#0a0a0a" }}
          >

            <div className="mb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-classic-gold/20 flex items-center justify-center">
                  <img
                    src={Logo}
                    alt="Capra Fitness Logo"
                    className="w-8 h-8"
                  />
                </div>
                <span className="text-gradient font-bold text-lg tracking-tight">
                  CAPRA FITNESS
                </span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-classic-gold/30 to-transparent" />
            </div>


            <div className="bg-white p-4 rounded-2xl inline-block mb-4 shadow-lg">
              {isLoadingQr ? (
                <div className="w-40 h-40 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-classic-gold animate-spin" />
                </div>
              ) : qrImageBase64 ? (
                <img
                  src={qrImageBase64}
                  alt={`QR code for ${selectedMember?.full_name}`}
                  className="w-40 h-40 object-contain"
                />
              ) : (
                <div className="w-40 h-40 bg-zinc-100 flex items-center justify-center rounded-xl">
                  <QrCode className="w-20 h-20 text-zinc-400" />
                </div>
              )}
            </div>


            <div className="mb-4">
              <h3 className="text-white font-bold text-lg">
                {selectedMember?.full_name}
              </h3>
              <p className="text-zinc-400 text-sm font-mono mt-1">
                ID: {selectedMember?.memberID}
              </p>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-classic-gold/30 to-transparent my-4" />


            <div className="text-left">
              <p className="text-classic-gold text-xs font-semibold mb-2">
                HOW TO USE:
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-classic-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-classic-gold text-[10px] font-bold">
                      1
                    </span>
                  </div>
                  <p className="text-zinc-400 text-xs">
                    Present this QR code at the gym entrance
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-classic-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-classic-gold text-[10px] font-bold">
                      2
                    </span>
                  </div>
                  <p className="text-zinc-400 text-xs">
                    Scan your QR code in the gym's QR scanner to check in!
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                  </div>
                  <p className="text-zinc-400 text-xs">
                    You're checked in! Enjoy your workout
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-classic-gold/10">
              <p className="text-zinc-600 text-[10px] text-center">
                Valid for CAPRA FITNESS members only
              </p>
            </div>
          </div>

          <button
            onClick={downloadQRCard}
            disabled={isDownloading || isLoadingQr}
            className="mt-6 w-[400px] py-3 bg-classic-gold text-black rounded-xl font-semibold hover:bg-light-gold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download QR Card
              </>
            )}
          </button>

          <p className="text-zinc-500 text-xs text-center mt-4 max-w-[400px]">
            Click download to save this card as an image. Print it and bring to
            the gym!
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default Member;