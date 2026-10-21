import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Mail, UserRound } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

function AdminSetup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("Capra Fitness Administrator");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isSupabaseConfigured || !supabase) {
      setError("Administrator setup is not connected to Supabase yet.");
      return;
    }
    if (password.length < 14) {
      setError("Use a unique password with at least 14 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: "ramosjaredonarse07@gmail.com",
        password,
        options: { data: { full_name: fullName.trim() } },
      });

      if (signUpError) throw signUpError;
      setPassword("");
      setConfirmPassword("");

      if (data.session) {
        const { error: claimError } = await supabase.rpc("claim_initial_admin");
        if (claimError) throw claimError;
        setMessage("Administrator access is ready. Redirecting to sign in.");
        window.setTimeout(() => navigate("/login", { replace: true }), 1500);
      } else {
        setMessage(
          "Check the ramosjaredonarse07@gmail.com inbox and confirm the account. Then sign in to finish the one-time administrator setup.",
        );
      }
    } catch (setupError) {
      console.error("Administrator setup failed:", setupError);
      setError(setupError.message || "Administrator setup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-white">
      <section className="mx-auto max-w-lg">
        <Link to="/login" className="mb-8 inline-flex items-center gap-2 text-zinc-300 hover:text-white">
          <ArrowLeft size={18} /> Back to login
        </Link>
        <div className="rounded-2xl border border-classic-gold/20 bg-zinc-900/80 p-8">
          <h1 className="mb-2 text-2xl font-bold">Initial administrator setup</h1>
          <p className="mb-6 text-sm text-zinc-300">
            This one-time setup creates <strong>ramosjaredonarse07@gmail.com</strong> in Supabase Auth.
            Choose a unique password privately; it is never stored in this app’s source.
          </p>
          {!isSupabaseConfigured && (
            <p role="alert" className="mb-5 rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-200">
              Supabase configuration is not set on this deployment.
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-sm text-zinc-200">
              Administrator name
              <span className="relative mt-2 block">
                <UserRound className="absolute left-3 top-3.5 text-zinc-500" size={18} />
                <input
                  required
                  maxLength={100}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-3 pl-10 pr-3"
                />
              </span>
            </label>
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-3 text-sm text-zinc-300">
              <Mail className="mr-2 inline" size={16} /> ramosjaredonarse07@gmail.com
            </div>
            <label className="block text-sm text-zinc-200">
              New password (14 characters minimum)
              <span className="relative mt-2 block">
                <Lock className="absolute left-3 top-3.5 text-zinc-500" size={18} />
                <input
                  required
                  type="password"
                  minLength={14}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-3 pl-10 pr-3"
                />
              </span>
            </label>
            <label className="block text-sm text-zinc-200">
              Confirm password
              <input
                required
                type="password"
                minLength={14}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-3"
              />
            </label>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured}
              className="w-full rounded-lg bg-classic-gold px-4 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Setting up..." : "Create administrator account"}
            </button>
          </form>
          <p className="mt-5 text-xs text-zinc-400">
            This is a one-time bootstrap. Once an administrator exists, no other account can claim initial admin access.
          </p>
        </div>
      </section>
    </main>
  );
}

export default AdminSetup;
