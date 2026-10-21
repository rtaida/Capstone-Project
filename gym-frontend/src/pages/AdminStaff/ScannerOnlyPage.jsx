import { ArrowLeft, QrCode, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AdminStaffScanner from "./AdminStaffScanner";

function ScannerOnlyPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#090909] text-white">
      <header className="border-b border-classic-gold/10 bg-black/80 px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-lg bg-classic-gold/15 p-2 text-classic-gold">
              <QrCode className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-white sm:text-base">Capra Fitness Scanner</h1>
              <p className="text-xs text-zinc-500">Attendance and walk-in registration</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 transition hover:border-classic-gold/40 hover:text-classic-gold sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
        <AdminStaffScanner />
      </main>
    </div>
  );
}

export default ScannerOnlyPage;
