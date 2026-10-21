import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
} from "lucide-react";
import bgImage from "../assets/Capra bg.jpg";
import logo from "../assets/logo.png";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const passwordCriteria = useMemo(
    () => ({
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[^A-Za-z0-9]/.test(newPassword),
    }),
    [newPassword]
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setStep("password");
        setMessage("Recovery link verified. Choose a new password.");
        window.history.replaceState(null, "", window.location.pathname);
      }
    });

    if (window.location.hash.includes("type=recovery")) {
      supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
        if (sessionError) {
          console.error("Unable to validate password recovery session:", sessionError);
          setError(sessionError.message);
        } else if (session) {
          setStep("password");
          setMessage("Recovery link verified. Choose a new password.");
          window.history.replaceState(null, "", window.location.pathname);
        }
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const clearFeedback = () => {
    setMessage("");
    setError("");
  };

  const requestOtp = async (event) => {
    event?.preventDefault();
    clearFeedback();

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          { redirectTo: `${window.location.origin}/forgot-password` },
        );
        if (recoveryError) throw recoveryError;
        setEmail(normalizedEmail);
        setMessage("If an account exists for this email, a password recovery link has been sent.");
        setResendCooldown(60);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/request_password_reset.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to send the verification code.");
      }
      setEmail(normalizedEmail);
      setStep("otp");
      setResendCooldown(60);
      setMessage("If an account exists for this email, a 6-digit verification code has been sent.");
    } catch (requestError) {
      console.error("Password recovery request failed:", requestError);
      if (
        isSupabaseConfigured &&
        /email rate limit exceeded/i.test(requestError.message || "")
      ) {
        setResendCooldown(60);
        setError(
          "Supabase temporarily limited recovery emails for this project. Please wait before trying again. If this continues, the project owner may need to configure a custom SMTP provider in Supabase."
        );
      } else {
        setError(requestError.message || "Unable to request password recovery.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    clearFeedback();

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/verify_password_reset_otp.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Invalid verification code.");
      }
      setResetToken(data.resetToken);
      setStep("password");
      setMessage("Email verified. Create your new password below.");
    } catch (requestError) {
      console.error("Verify OTP error:", requestError);
      setError(requestError.message || "Unable to verify the code.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    clearFeedback();

    const validPassword = Object.values(passwordCriteria).every(Boolean);
    if (!validPassword) {
      setError("Password must be at least 8 characters and include uppercase, lowercase, number, and special character.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (updateError) throw updateError;
        setStep("success");
        setMessage("Your password has been updated successfully.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/reset_password.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resetToken, newPassword }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to change your password.");
      }
      setStep("success");
      setMessage(data.message);
    } catch (requestError) {
      console.error("Password update failed:", requestError);
      setError(requestError.message || "Unable to change your password.");
    } finally {
      setIsLoading(false);
    }
  };

  const title = {
    email: "Forgot Password?",
    otp: "Verify Your Email",
    password: "Create New Password",
    success: "Password Changed",
  }[step];

  const subtitle = {
    email: isSupabaseConfigured
      ? "Enter your registered email and we'll send you a secure password recovery link."
      : "Enter your registered email and we'll send you a verification code.",
    otp: `Enter the 6-digit code sent to ${email}.`,
    password: "Your email is verified. Set a strong new password.",
    success: "Your password has been updated successfully.",
  }[step];
  const progressSteps = isSupabaseConfigured
    ? ["email", "password"]
    : ["email", "otp", "password"];

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgImage})`, filter: "brightness(0.2)" }}
      />
      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-7 text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <img src={logo} alt="Capra Fitness" className="h-12 w-12" />
              <span className="text-3xl font-bold text-gradient">Capra Fitness</span>
            </div>
            <h1 className="mb-2 text-3xl font-bold text-white">{title}</h1>
            <p className="text-zinc-400">{subtitle}</p>
          </div>

          <div className="rounded-2xl border border-classic-gold/20 bg-soft-gray/5 p-7 backdrop-blur-xl shadow-2xl">
            {step !== "success" && (
              <div className="mb-7 flex items-center justify-center gap-2">
                {progressSteps.map((item, index) => {
                  const active = progressSteps.indexOf(step) >= index;
                  return (
                    <div key={item} className="flex items-center gap-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-classic-gold text-black" : "bg-zinc-800 text-zinc-500"}`}>
                        {index + 1}
                      </div>
                      {index < progressSteps.length - 1 && <div className={`h-px w-10 ${active && progressSteps.indexOf(step) > index ? "bg-classic-gold" : "bg-zinc-700"}`} />}
                    </div>
                  );
                })}
              </div>
            )}

            {message && (
              <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {error && (
              <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === "email" && (
              <form onSubmit={requestOtp}>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Registered Email</label>
                <div className="relative mb-6">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 py-3 pl-10 pr-4 text-white outline-none focus:border-classic-gold"
                    placeholder="name@example.com"
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                <button type="submit" disabled={isLoading || (isSupabaseConfigured && resendCooldown > 0)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient py-3 font-bold text-black transition hover:scale-[1.02] disabled:opacity-50">
                  {isLoading
                    ? isSupabaseConfigured ? "Sending Recovery Link..." : "Sending Code..."
                    : isSupabaseConfigured && resendCooldown > 0
                      ? `Try again in ${resendCooldown}s`
                      : <>{isSupabaseConfigured ? "Send Recovery Link" : "Send Verification Code"} <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={verifyOtp}>
                <div className="mb-5 flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-classic-gold/30 bg-classic-gold/10">
                    <KeyRound className="h-7 w-7 text-classic-gold" />
                  </div>
                </div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Verification Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mb-6 w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] text-white outline-none focus:border-classic-gold"
                  placeholder="000000"
                  disabled={isLoading}
                  autoComplete="one-time-code"
                />
                <button type="submit" disabled={isLoading || otp.length !== 6} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient py-3 font-bold text-black transition hover:scale-[1.02] disabled:opacity-50">
                  {isLoading ? "Verifying..." : <>Verify Code <ArrowRight className="h-4 w-4" /></>}
                </button>
                <button type="button" disabled={isLoading || resendCooldown > 0} onClick={requestOtp} className="w-full text-sm text-classic-gold disabled:text-zinc-600">
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend verification code"}
                </button>
                <button type="button" onClick={() => { clearFeedback(); setStep("email"); setOtp(""); }} className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-zinc-500 hover:text-zinc-300">
                  <ArrowLeft className="h-4 w-4" /> Change email
                </button>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={resetPassword}>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-zinc-300">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 py-3 pl-10 pr-12 text-white outline-none focus:border-classic-gold"
                      placeholder="Create a strong password"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">
                      {showPassword ? <EyeOff className="h-5 w-5 text-zinc-500" /> : <Eye className="h-5 w-5 text-zinc-500" />}
                    </button>
                  </div>
                </div>

                <div className="mb-5 flex flex-wrap gap-2 text-xs">
                  {[
                    [passwordCriteria.length, "8+ chars"],
                    [passwordCriteria.uppercase, "Uppercase"],
                    [passwordCriteria.lowercase, "Lowercase"],
                    [passwordCriteria.number, "Number"],
                    [passwordCriteria.special, "Special"],
                  ].map(([valid, label]) => (
                    <span key={label} className={`rounded-full border px-2 py-1 ${valid ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 bg-zinc-800/50 text-zinc-500"}`}>
                      {valid ? "✓" : "•"} {label}
                    </span>
                  ))}
                </div>

                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-zinc-300">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 py-3 pl-10 pr-12 text-white outline-none focus:border-classic-gold"
                      placeholder="Confirm your new password"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">
                      {showConfirmPassword ? <EyeOff className="h-5 w-5 text-zinc-500" /> : <Eye className="h-5 w-5 text-zinc-500" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient py-3 font-bold text-black transition hover:scale-[1.02] disabled:opacity-50">
                  {isLoading ? "Changing Password..." : <>Change Password <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            )}

            {step === "success" && (
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
                  <CheckCircle className="h-9 w-9 text-emerald-400" />
                </div>
                <p className="mb-6 text-zinc-300">You can now use your new password to access your account.</p>
                <button onClick={() => navigate("/login")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient py-3 font-bold text-black transition hover:scale-[1.02]">
                  Back to Login <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step !== "success" && (
              <div className="mt-6 text-center">
                <Link to="/login" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-classic-gold">
                  <ArrowLeft className="h-4 w-4" /> Back to Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
