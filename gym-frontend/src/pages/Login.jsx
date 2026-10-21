import { useEffect, useState } from "react";
import bgImage from "../assets/Capra bg.jpg";
import logo from "../assets/logo.png";
import { Link, useNavigate } from "react-router-dom";
import { persistAuthToken, clearAuthToken } from "../services/api";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  XCircle,
  X,
  Shield,
  Terminal,
} from "lucide-react";


const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";


const LoginSkeleton = () => {
  return (
    <div className="w-full max-w-md animate-pulse">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-12 h-12 rounded-full bg-zinc-700"></div>
          <div className="h-8 w-40 bg-zinc-700 rounded-lg"></div>
        </div>
        <div className="h-8 w-48 bg-zinc-700 rounded-lg mx-auto mb-2"></div>
        <div className="h-4 w-64 bg-zinc-700 rounded-lg mx-auto"></div>
      </div>

      <div className="bg-soft-gray/5 backdrop-blur-xl border border-classic-gold/20 rounded-2xl p-8">
        <div className="mb-5">
          <div className="h-4 w-28 bg-zinc-700 rounded mb-2"></div>
          <div className="h-12 w-full bg-zinc-700/50 rounded-xl"></div>
        </div>

        <div className="mb-5">
          <div className="h-4 w-20 bg-zinc-700 rounded mb-2"></div>
          <div className="h-12 w-full bg-zinc-700/50 rounded-xl"></div>
        </div>

        <div className="flex justify-end mb-6">
          <div className="h-4 w-32 bg-zinc-700 rounded"></div>
        </div>

        <div className="h-12 w-full bg-zinc-700 rounded-xl"></div>

        <div className="mt-6 text-center">
          <div className="h-4 w-48 bg-zinc-700 rounded mx-auto"></div>
        </div>
      </div>
    </div>
  );
};

function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [showSqlPopup, setShowSqlPopup] = useState(false);
  const [sqlDetails, setSqlDetails] = useState({ field: "", attempt: "" });
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    if (lockoutSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setLockoutSeconds((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  
  useState(() => {
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const detectSqlInjection = (input) => {
    if (!input) return false;
    const sqlPatterns = [
      /(\bSELECT\b.*\bFROM\b)/i,
      /(\bINSERT\b.*\bINTO\b)/i,
      /(\bUPDATE\b.*\bSET\b)/i,
      /(\bDELETE\b.*\bFROM\b)/i,
      /(\bDROP\b.*\bTABLE\b)/i,
      /(--)/,
      /(;)/,
      /('.*OR.*'.*=.*')/i,
      /(%27)|(')/,
      /(%22)|(")/,
    ];
    for (const pattern of sqlPatterns) {
      if (pattern.test(input)) return true;
    }
    return false;
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    if (detectSqlInjection(value)) {
      setSqlDetails({ field: "Email", attempt: value });
      setShowSqlPopup(true);
      setEmail("");
    } else {
      setEmail(value);
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const validateEmail = (email) => {
    if (!email) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Enter a valid email address";
    return "";
  };

  const validatePassword = (password) => {
    if (!password) return "Password is required";
    const minimumLength = 8;
    if (password.length < minimumLength) {
      return `Password must be at least ${minimumLength} characters`;
    }
    return "";
  };

  const emailError = touched.email ? validateEmail(email) : "";
  const passwordError = touched.password ? validatePassword(password) : "";
  const isFormValid = !emailError && !passwordError && email && password;
  const isLockedOut = lockoutSeconds > 0;
  const lockoutLabel = `${Math.floor(lockoutSeconds / 60)}:${String(lockoutSeconds % 60).padStart(2, "0")}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLockedOut) return;
    setTouched({ email: true, password: true });

    if (isFormValid) {
      setIsLoading(true);
      setErrorMessage("");

      try {
        let data;
        if (isSupabaseConfigured && supabase) {
          const { data: authData, error: authError } =
            await supabase.auth.signInWithPassword({ email, password });
          if (authError) throw authError;
          if (!authData.user || !authData.session) {
            throw new Error("Sign-in did not return an active session.");
          }

          let { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, full_name, role, admin_id, trainer_id, member_id")
            .eq("id", authData.user.id)
            .single();
          if (profileError) throw profileError;

          if (authData.user.email?.toLowerCase() === "ramosjaredonarse07@gmail.com" && profile.role !== "admin") {
            const { error: claimError } = await supabase.rpc("claim_initial_admin");
            if (claimError) throw claimError;
            const result = await supabase
              .from("profiles")
              .select("id, full_name, role, admin_id, trainer_id, member_id")
              .eq("id", authData.user.id)
              .single();
            if (result.error) throw result.error;
            profile = result.data;
          }

          data = {
            success: true,
            token: authData.session.access_token,
            user: {
              id: profile.admin_id || profile.trainer_id || profile.member_id || profile.id,
              auth_id: profile.id,
              admin_id: profile.admin_id,
              trainer_id: profile.trainer_id,
              member_id: profile.member_id,
              fullName: profile.full_name || authData.user.email,
              full_name: profile.full_name || authData.user.email,
              email: authData.user.email,
              role: profile.role,
              type: profile.role === "admin" ? "Admin" : profile.role,
            },
          };
        } else {
          const response = await fetch(`${API_BASE_URL}/login.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

          const contentType = response.headers.get("content-type") || "";
          data = contentType.includes("application/json")
            ? await response.json()
            : {
                success: false,
                message: `Server returned ${response.status} ${response.statusText}. Please check the backend URL and Apache.`,
              };
          if (!response.ok || !data.success) {
            if (response.status === 429) {
              const retryAfter = Math.max(1, Number(data.retry_after) || 240);
              setLockoutSeconds(retryAfter);
              setErrorMessage(`Too many failed login attempts. Login is locked for ${Math.ceil(retryAfter / 60)} minutes.`);
            } else {
              setErrorMessage(data.message || "Invalid email or password");
            }
            setShowErrorPopup(true);
            return;
          }
        }

        if (data.success) {
          localStorage.setItem("user", JSON.stringify(data.user));
          clearAuthToken();
          if (data.token) {
            persistAuthToken(data.token);
          }

          const userRole = data.user.role;

          if (userRole === "admin" || userRole === "staff") {
            navigate("/admin");
          } else if (userRole === "trainer") {
            navigate("/trainer");
          } else if (userRole === "member") {
            navigate("/member");
          } else {
            navigate("/");
          }
        } else {
          setErrorMessage(data.message || "Invalid email or password");
          setShowErrorPopup(true);
        }
      } catch (error) {
        console.error("Login error:", error);
        setErrorMessage(
          error?.message
            ? `Unable to reach the login server: ${error.message}`
            : "Unable to reach the login server. Please check Apache and the API URL."
        );
        setShowErrorPopup(true);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const closePopup = () => {
    setShowErrorPopup(false);
    setErrorMessage("");
  };

  const closeSqlPopup = () => {
    setShowSqlPopup(false);
    setSqlDetails({ field: "", attempt: "" });
  };

  if (isPageLoading) {
    return (
      <div style={{ position: "relative", minHeight: "100vh" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: "brightness(0.20)",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: "1rem",
            paddingRight: "1rem",
          }}
        >
          <LoginSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: "brightness(0.20)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: "1rem",
          paddingRight: "1rem",
        }}
      >
        
        {showSqlPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/90 backdrop-blur-md">
            <div className="max-w-md w-full bg-gradient-to-br from-red-950 to-black border-2 border-red-600 rounded-2xl p-6 shadow-2xl shadow-red-600/40">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-red-600/20 border-2 border-red-600 flex items-center justify-center animate-pulse">
                      <Terminal className="w-7 h-7 text-red-500" />
                    </div>
                    <div className="absolute -top-1 -right-1">
                      <div className="w-4 h-4 bg-red-600 rounded-full animate-ping"></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-red-500">
                      SECURITY ALERT!
                    </h3>
                  </div>
                </div>
                <button
                  onClick={closeSqlPopup}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={closeSqlPopup}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg"
              >
                I Understand
              </button>
            </div>
          </div>
        )}

        
        {showErrorPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
            <div className="max-w-sm w-full bg-red-950/95 border border-red-500/50 rounded-2xl p-6 shadow-2xl shadow-red-500/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-red-400">
                    Login Failed
                  </h3>
                </div>
                <button onClick={closePopup} className="text-zinc-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-zinc-300 text-sm mb-6">{errorMessage}</p>
              <button
                onClick={closePopup}
                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        
        <Link
          to="/"
          aria-label="Back to landing page"
          title="Back to landing page"
          className="group absolute left-6 top-6 z-10 inline-flex h-10 w-14 items-center justify-center rounded-lg border border-classic-gold/20 bg-black/30 text-zinc-300 transition-all hover:-translate-x-0.5 hover:border-classic-gold/60 hover:bg-classic-gold/10 hover:text-classic-gold"
        >
          <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
        </Link>

        <div className="w-full max-w-md">

          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src={logo} alt="Logo" className="w-12 h-12" />
              <span className="text-3xl font-bold text-gradient">
                Capra Fitness
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-zinc-400">
              Login to continue your fitness journey
            </p>
          </div>

          <div className="bg-soft-gray/5 backdrop-blur-xl border border-classic-gold/20 rounded-2xl p-8">
            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={() => setTouched({ ...touched, email: true })}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold"
                    placeholder="name@example.com"
                    disabled={isLoading || isLockedOut}
                  />
                </div>
                {emailError && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {emailError}
                  </p>
                )}
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={handlePasswordChange}
                    onBlur={() => setTouched({ ...touched, password: true })}
                    className="w-full pl-10 pr-12 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold"
                    placeholder="your password"
                    disabled={isLoading || isLockedOut}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-zinc-500" />
                    ) : (
                      <Eye className="w-5 h-5 text-zinc-500" />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {passwordError}
                  </p>
                )}
              </div>

              <div className="flex justify-end mb-6">
                <Link
                  to="/forgot-password"
                  className="text-sm text-classic-gold hover:text-light-gold"
                >
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading || isLockedOut || !isFormValid}
                className="w-full py-3 bg-gradient text-black font-bold rounded-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLockedOut ? (
                  <>Please try again in ({lockoutLabel})</>
                ) : isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Login <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="mt-6 text-center">
                <p className="text-zinc-400">
                  Don't have an account?{" "}
                  <Link
                    to="/register"
                    className="text-classic-gold hover:text-light-gold font-semibold"
                  >
                    Register here
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
