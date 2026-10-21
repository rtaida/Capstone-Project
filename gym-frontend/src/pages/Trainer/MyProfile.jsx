import { useEffect, useState } from "react";
import {
  Award,
  Briefcase,
  BriefcaseBusiness,
  CheckCircle,
  CircleX,
  Mail,
  Phone,
  Star,
  UserCheck,
  UserRoundPen,
  Users,
  X,
} from "lucide-react";
import SuccessModal from "../../components/memberModal/SuccessModal";
import NothingChangeModal from "../../components/memberModal/NothingChangeModal";

function TrainerMyProfile({ dashboardSessions = [], user = {}, profileForm, setProfileForm, focusSection = "" }) {
  const [showProfileEditor, setShowProfileEditor] = useState(false);

  useEffect(() => {
    if (!focusSection) return;
    document.getElementById(focusSection)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusSection]);

  const totalBookedClients = (dashboardSessions || []).reduce(
    (sum, session) => sum + Number(session.booking_count || 0),
    0,
  );

  const approvedSessions = (dashboardSessions || []).filter(
    (s) => String(s.status || "").toLowerCase() === "approved"
  );
  const finishedSessions = (dashboardSessions || []).filter(
    (session) => String(session.status || "").toLowerCase() === "finished"
  );
  const rejectedSessions = (dashboardSessions || []).filter(
    (session) => String(session.status || "").toLowerCase() === "rejected"
  );
  const ratedSessions = (dashboardSessions || []).filter(
    (session) => Number(session.rating || 0) > 0
  );

  const profileStats = [
    {
      label: "Booked Clients",
      value: totalBookedClients,
      icon: Users,
      color: "text-classic-gold",
      bg: "bg-classic-gold/10",
      border: "border-classic-gold/20",
    },
    {
      label: "Finished Sessions",
      value: finishedSessions.length,
      icon: CheckCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Rejected",
      value: rejectedSessions.length,
      icon: CircleX,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    },
    {
      label: "Performance",
      value: `${ratedSessions.length ? (ratedSessions.reduce((sum, s) => sum + Number(s.rating || 0), 0) / ratedSessions.length || 0).toFixed(1) : "0.0"}/5`,
      icon: Star,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
    },
  ];

  const [profileMessage, setProfileMessage] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [originalProfileForm, setOriginalProfileForm] = useState(profileForm);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showNothingChangeModal, setShowNothingChangeModal] = useState(false);
  const [bookedMembers, setBookedMembers] = useState({});
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirm_password: "",
  });
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    const bookedSessions = (dashboardSessions || []).filter(
      (session) => Number(session.booking_count || 0) > 0,
    );
    if (!bookedSessions.length) {
      setBookedMembers({});
      return undefined;
    }

    const token = localStorage.getItem("auth_token") || localStorage.getItem("token") || localStorage.getItem("authToken") || "";
    let cancelled = false;
    Promise.all(
      bookedSessions.map(async (session) => {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || "/api"}/trainer_api.php?action=get_session_booked_members&session_id=${encodeURIComponent(session.id)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const data = await response.json();
          return [session.id, data.success ? data.members || [] : []];
        } catch (error) {
          console.error("Error loading booked member details:", error);
          return [session.id, []];
        }
      }),
    ).then((entries) => {
      if (!cancelled) setBookedMembers(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [dashboardSessions]);

  const handleProfileSave = async () => {
    const token = localStorage.getItem("auth_token") || localStorage.getItem("token") || localStorage.getItem("authToken") || "";

    const profileChanged = JSON.stringify(profileForm) !== JSON.stringify(originalProfileForm);
    const passwordChanged = Boolean(passwordForm.password || passwordForm.confirm_password);
    if (!profileChanged && !passwordChanged) {
      setShowProfileEditor(false);
      setPasswordForm({ password: "", confirm_password: "" });
      setPasswordError("");
      setProfileMessage("");
      setShowNothingChangeModal(true);
      return;
    }

    if (passwordForm.password && passwordForm.password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    if (passwordForm.password !== passwordForm.confirm_password) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordError("");
    if (!token) {
      setProfileMessage("Your login session has expired. Please log in again.");
      return;
    }

    setIsSavingProfile(true);
    setProfileMessage("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "/api"}/trainer_api.php?action=update_trainer_profile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...profileForm,
            password: passwordForm.password || "",
          }),
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setProfileMessage(data.message || "Unable to update your profile.");
        return;
      }

      const profile = data.profile || {};
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      const updatedUser = {
        ...currentUser,
        fullName: profile.full_name || profileForm.full_name,
        full_name: profile.full_name || profileForm.full_name,
        email: profile.email || profileForm.email,
        phone_number: profile.phone_number || profileForm.phone_number,
        expertise_area: profile.expertise_area || profileForm.expertise_area,
        profile_photo: profile.profile_photo || profileForm.profile_photo || "",
      };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      setProfileForm({
        full_name: profile.full_name || profileForm.full_name,
        email: profile.email || profileForm.email,
        phone_number: profile.phone_number || profileForm.phone_number,
        expertise_area: profile.expertise_area || profileForm.expertise_area,
        profile_photo: profile.profile_photo || profileForm.profile_photo || "",
      });
      setPasswordForm({ password: "", confirm_password: "" });
      setPasswordError("");
      setOriginalProfileForm({
        full_name: profile.full_name || profileForm.full_name,
        email: profile.email || profileForm.email,
        phone_number: profile.phone_number || profileForm.phone_number,
        expertise_area: profile.expertise_area || profileForm.expertise_area,
      });
      setProfileMessage("");
      setShowProfileEditor(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error updating trainer profile:", error);
      setProfileMessage("Network error. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Profile Updated"
        message="Your trainer profile was updated successfully."
      />

      <NothingChangeModal
        isOpen={showNothingChangeModal}
        onClose={() => setShowNothingChangeModal(false)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Trainer details, activity, and performance summary.
          </p>
        </div>
        <button
          onClick={() => {
            setPasswordForm({ password: "", confirm_password: "" });
            setPasswordError("");
            setProfileMessage("");
            setOriginalProfileForm({ ...profileForm });
            setShowProfileEditor(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-classic-gold/30 bg-classic-gold/10 px-4 py-2 text-sm font-medium text-classic-gold hover:bg-classic-gold/20 transition-all"
        >
          <UserRoundPen className="w-4 h-4" />
          Edit Profile
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {profileStats.map((card, index) => (
          <div key={index} className={`rounded-xl border ${card.border} bg-black/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-black/50 hover:shadow-lg hover:shadow-classic-gold/5`}>
            <div className="flex items-start justify-between">
              <div className={`p-2.5 rounded-lg ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <span className="text-zinc-600 text-xs font-mono">#{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div className="mt-4">
              <p className="text-zinc-400 text-sm">{card.label}</p>
              <p className="text-white text-2xl font-bold mt-1">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="xl:order-2 rounded-2xl border border-classic-gold/10 bg-black/40 p-6 transition-all duration-300 hover:border-classic-gold/30 hover:bg-black/50 hover:shadow-lg hover:shadow-classic-gold/5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 text-classic-gold" />
              Overall performance
            </h3>
          </div>
          <div className="rounded-2xl border border-classic-gold/10 bg-zinc-900/40 p-4">
            <p className="text-zinc-400 text-sm">Current score</p>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-3xl font-bold text-white">
                {ratedSessions.length
                  ? `${(
                      ratedSessions.reduce(
                        (sum, s) => sum + Number(s.rating || 0),
                        0,
                      ) / ratedSessions.length || 0
                    ).toFixed(1)}`
                  : "0.0"}
              </span>
              <span className="text-zinc-500 mb-1">/ 5.0</span>
            </div>
            <div className="mt-4 h-2.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-classic-gold to-yellow-500"
                style={{
                  width: `${Math.min(100, ratedSessions.length * 20)}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="xl:order-1 xl:col-span-2 rounded-2xl border border-classic-gold/10 bg-black/40 p-6 transition-all duration-300 hover:border-classic-gold/30 hover:bg-black/50 hover:shadow-lg hover:shadow-classic-gold/5">
          <h3 className="text-white font-semibold flex items-center gap-2 mb-5">
            <BriefcaseBusiness className="w-4 h-4 text-classic-gold" />
            Trainer Information
          </h3>

          <div className="flex flex-col sm:flex-row gap-6">
            <div className="shrink-0 flex justify-center sm:justify-start">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-classic-gold/40 to-classic-gold/10 flex items-center justify-center ring-2 ring-classic-gold/30 overflow-hidden">
                {profileForm.profile_photo || user?.profile_photo ? (
                  <img src={profileForm.profile_photo || user.profile_photo} alt="Trainer profile" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-10 h-10 text-classic-gold" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm flex-1">
              <div className="flex items-center gap-3 text-zinc-300">
                <Users className="w-4 h-4 text-classic-gold" />
                <span className="text-zinc-400">Name:</span>
                <span className="text-white font-medium truncate">{profileForm.full_name || user?.fullName || user?.full_name || "Coach"}</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-300">
                <Mail className="w-4 h-4 text-classic-gold" />
                <span className="text-zinc-400">Email:</span>
                <span className="text-white font-medium truncate">{profileForm.email || user?.email || "Not available"}</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-300">
                <Phone className="w-4 h-4 text-classic-gold" />
                <span className="text-zinc-400">Phone:</span>
                <span className="text-white font-medium">{profileForm.phone_number || user?.phone_number || user?.phone || "Not available"}</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-300">
                <Briefcase className="w-4 h-4 text-classic-gold" />
                <span className="text-zinc-400">Specialty:</span>
                <span className="text-white font-medium">{profileForm.expertise_area || user?.expertise_area || user?.specialization || "General training"}</span>
              </div>
            </div>
          </div>
        </div>

      <div id="client-overview" className="xl:order-3 rounded-xl bg-black/40 backdrop-blur-md border border-classic-gold/10 p-6 scroll-mt-24 transition-all duration-300 hover:border-classic-gold/30 hover:bg-black/50 hover:shadow-lg hover:shadow-classic-gold/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-classic-gold" />
            Client Overview
          </h3>
          <span className="text-zinc-500 text-xs uppercase tracking-wide">Live activity</span>
        </div>

        <div className="space-y-3">
          {(dashboardSessions || []).filter((session) => Number(session.booking_count || 0) > 0).length > 0 ? (
            (dashboardSessions || []).filter((session) => Number(session.booking_count || 0) > 0).slice(0, 6).map((session) => (
              <div key={session.id} className="rounded-lg border border-classic-gold/10 bg-zinc-900/40 px-4 py-3 transition-all duration-200 hover:border-classic-gold/30 hover:bg-zinc-900/70 hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-white font-medium">{session.session_type}</p>
                    <p className="text-zinc-500 text-xs mt-1">
                      {new Date(session.start_time).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="text-zinc-300 text-sm whitespace-nowrap">{Number(session.booking_count || 0)} booked</span>
                </div>
                <div className="mt-3 space-y-2">
                  {(bookedMembers[session.id] || []).map((member) => (
                    <div key={member.memberID} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-classic-gold/10 pt-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-white font-medium">
                        <UserCheck className="w-3.5 h-3.5 text-classic-gold" />
                        {member.full_name}
                      </span>
                      <span className="text-zinc-400">{member.email || "Email unavailable"}</span>
                      <span className="text-zinc-500">{member.phone || "Phone unavailable"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-zinc-500">
              No booked clients yet.
            </div>
          )}
        </div>
      </div>

      </div>

      {showProfileEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowProfileEditor(false)} />
          <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-classic-gold/15 bg-[#111111] p-6 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-xl font-semibold">Edit profile</h3>
              <button onClick={() => setShowProfileEditor(false)} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="sm:col-span-2">
                <label className="block text-zinc-300 mb-2 text-sm">Profile image</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file || file.size > 5 * 1024 * 1024) return;
                    const reader = new FileReader();
                    reader.onload = () => setProfileForm((current) => ({ ...current, profile_photo: String(reader.result || "") }));
                    reader.readAsDataURL(file);
                  }}
                  className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3 py-2.5 text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-classic-gold file:px-3 file:py-1.5 file:font-semibold file:text-black"
                />
                {profileForm.profile_photo && <img src={profileForm.profile_photo} alt="Profile preview" className="mt-2 h-16 w-16 rounded-full object-cover ring-2 ring-classic-gold/30" />}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-300 mb-2 text-sm">Full name</label>
                <input
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3 py-2.5 text-white outline-none focus:border-classic-gold"
                />
              </div>
              <div>
                <label className="block text-zinc-300 mb-2 text-sm">Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3 py-2.5 text-white outline-none focus:border-classic-gold"
                />
              </div>
              <div>
                <label className="block text-zinc-300 mb-2 text-sm">Phone</label>
                <input
                  value={profileForm.phone_number}
                  onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3 py-2.5 text-white outline-none focus:border-classic-gold"
                />
              </div>
              <div>
                <label className="block text-zinc-300 mb-2 text-sm">Expertise area</label>
                <input
                  value={profileForm.expertise_area}
                  onChange={(e) => setProfileForm({ ...profileForm, expertise_area: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3 py-2.5 text-white outline-none focus:border-classic-gold"
                />
              </div>
              </div>
              <div className="pt-2 border-t border-zinc-800/80">
                <p className="text-zinc-500 text-xs mb-3">Leave password fields blank to keep your current password.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-300 mb-2 text-sm">Change password</label>
                    <input
                      type="password"
                      value={passwordForm.password}
                      onChange={(e) => {
                        setPasswordForm({ ...passwordForm, password: e.target.value });
                        setPasswordError("");
                      }}
                      className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3 py-2.5 text-white outline-none focus:border-classic-gold"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 mb-2 text-sm">Confirm password</label>
                    <input
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(e) => {
                        setPasswordForm({ ...passwordForm, confirm_password: e.target.value });
                        setPasswordError("");
                      }}
                      className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3 py-2.5 text-white outline-none focus:border-classic-gold"
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
                {passwordError && (
                  <p className="mt-2 text-sm text-red-400">{passwordError}</p>
                )}
              </div>
            </div>

            {profileMessage && (
              <p className="mt-4 text-sm text-zinc-300">{profileMessage}</p>
            )}

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => {
                  setShowProfileEditor(false);
                  setPasswordForm({ password: "", confirm_password: "" });
                  setPasswordError("");
                  setProfileMessage("");
                }}
                className="rounded-xl border border-zinc-700 bg-transparent px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProfileSave}
                disabled={isSavingProfile}
                className="rounded-xl border border-classic-gold/40 bg-classic-gold px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-classic-gold/10 transition-all hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingProfile ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrainerMyProfile;
