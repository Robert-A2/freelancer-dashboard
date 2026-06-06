"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ResetPasswordForm() {
  const router      = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);
  const [ready, setReady]         = useState(false);
  const [exchanging, setExchanging] = useState(true);

  // Exchange the one-time code from the email link for a valid session
  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("This reset link is invalid or has already been used. Please request a new one.");
      setExchanging(false);
      return;
    }
    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      setExchanging(false);
      if (error) {
        setError("This reset link has expired. Please request a new one.");
      } else {
        setReady(true);
        // Remove the code from the URL so a refresh doesn't try to exchange it again
        router.replace("/reset-password");
      }
    });
  }, [searchParams, router]);

  async function handleReset(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match. Please check and try again.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError("Failed to update your password. Please try again.");
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0A1020]">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#F8FAFC]">Freelancer OS</h1>
          <p className="text-[#94A3B8] text-sm mt-1">Financial clarity built for freelancers</p>
        </div>

        {/* Exchanging code */}
        {exchanging && (
          <div className="card flex items-center justify-center gap-3 py-10">
            <Spinner />
            <p className="text-sm text-[#94A3B8]">Verifying your reset link…</p>
          </div>
        )}

        {/* Invalid / expired link */}
        {!exchanging && !ready && (
          <div className="card text-center space-y-4">
            <div className="w-14 h-14 bg-[#EF444415] rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#F8FAFC]">Link expired</h2>
              <p className="text-sm text-[#94A3B8] mt-1">{error}</p>
            </div>
            <a
              href="/login"
              onClick={(e) => { e.preventDefault(); router.push("/login"); }}
              className="btn-primary inline-block text-sm"
            >
              Request a new link
            </a>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="card text-center space-y-4">
            <div className="w-14 h-14 bg-[#14B8A620] rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-[#14B8A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#F8FAFC]">Password updated</h2>
              <p className="text-sm text-[#94A3B8] mt-1">Taking you to your dashboard…</p>
            </div>
          </div>
        )}

        {/* Set new password form */}
        {ready && !success && (
          <div className="card">
            <div className="mb-6">
              <h2 className="text-lg font-semibold">Set a new password</h2>
              <p className="text-xs text-[#94A3B8] mt-1">
                Choose something strong, at least 8 characters.
              </p>
            </div>

            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="label block mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    className="input pr-12"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors p-1"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                  >
                    {showPwd ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.477 10.477A3 3 0 0013.5 13.5M6.228 6.228A10.45 10.45 0 003 12c1.854 4.205 6.2 7 9 7a10.4 10.4 0 004.772-1.228M9.772 9.772A3 3 0 0112 9c1.657 0 3 1.343 3 3a3 3 0 01-.228 1.127M17.772 17.772C16.147 18.572 14.102 19 12 19c-2.8 0-7.146-2.795-9-7a10.445 10.445 0 012.228-3.772" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="label block mb-1.5">Confirm password</label>
                <input
                  type={showPwd ? "text" : "password"}
                  className="input"
                  placeholder="Repeat your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              {/* Strength hint */}
              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-[#F59E0B]">Password needs at least 8 characters.</p>
              )}
              {password.length >= 8 && confirm.length > 0 && password !== confirm && (
                <p className="text-xs text-[#EF4444]">Passwords don't match.</p>
              )}
              {password.length >= 8 && confirm.length > 0 && password === confirm && (
                <p className="text-xs text-[#22C55E]">Passwords match ✓</p>
              )}

              {error && (
                <p className="text-sm text-[#EF4444] bg-[#EF444415] px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={loading || password.length < 8 || password !== confirm}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner /> Updating password…
                  </span>
                ) : "Update password"}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0A1020]">
        <div className="flex items-center gap-3 text-[#94A3B8]">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
