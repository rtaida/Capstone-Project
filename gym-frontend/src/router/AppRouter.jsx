import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";


import LandingPage from "../pages/LandingPage";
import Login from "../pages/Login";
import Register from "../pages/Register";
import ForgotPassword from "../pages/ForgotPassword";
import AdminSetup from "../pages/AdminSetup";


import AdminStaffDashboard from "../pages/AdminStaff/AdminStaffDashboard";
import ScannerOnlyPage from "../pages/AdminStaff/ScannerOnlyPage";
import TrainerDashboard from "../pages/Trainer/TrainerDashboard";
import MemberDashboard from "../pages/Member/MemberDashboard";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    if (!user || !user.email) {
      navigate("/login");
      return;
    }

    
    
    
    if (user.role === "member") {
      const syncMember = async () => {
        try {
          const api = `${import.meta.env.VITE_API_URL || "/api"}/member_api.php`;
          const params = new URLSearchParams({
            action: "sync_member",
            id: String(user.memberID || user.id || 0),
            email: String(user.email || ""),
          });
          const response = await fetch(`${api}?${params.toString()}`, {
            cache: "no-store",
          });
          const data = await response.json();

          if (data.success && data.member) {
            const syncedUser = {
              ...user,
              id: Number(data.member.memberID),
              memberID: Number(data.member.memberID),
              fullName: data.member.full_name,
              email: data.member.email,
            };
            localStorage.setItem("user", JSON.stringify(syncedUser));
            window.dispatchEvent(
              new CustomEvent("member-synchronized", { detail: syncedUser }),
            );
          }
        } catch (error) {
          
          console.warn("Member synchronization skipped:", error);
        }
      };

      syncMember();
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      
      if (user.role === "admin" || user.role === "staff") {
        navigate("/admin");
      } else if (user.role === "trainer") {
        navigate("/trainer");
      } else if (user.role === "member") {
        navigate("/member");
      } else {
        navigate("/login");
      }
    }
  }, [user, navigate, allowedRoles]);

  if (!user || !user.email) {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  return children;
};

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/admin-setup" element={<AdminSetup />} />

        
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin", "staff"]}>
              <AdminStaffDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/scanner"
          element={
            <ProtectedRoute allowedRoles={["admin", "staff"]}>
              <ScannerOnlyPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/trainer"
          element={
            <ProtectedRoute allowedRoles={["trainer"]}>
              <TrainerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/member"
          element={
            <ProtectedRoute allowedRoles={["member"]}>
              <MemberDashboard />
            </ProtectedRoute>
          }
        />

        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
