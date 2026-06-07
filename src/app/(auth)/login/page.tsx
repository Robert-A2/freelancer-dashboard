"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function friendlyError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials"))
    return "Email or password is incorrect. Please try again.";
  if (msg.includes("email not confirmed"))
    return "Please check your inbox and confirm your email address before signing in.";
  if (msg.includes("too many requests") || msg.includes("rate limit"))
    return "Too many attempts. Please wait a moment and try again.";
  if (msg.includes("user not found"))
    return "No account found with this email address.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Connection problem. Check your internet and try again.";
  return "Something went wrong. Please try again.";
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function BrandHeader() {
  return (
    <div className="mb-8 text-center">
      <h1 className="text-2xl font-bold text-[#D8E8F4]">Freelancer OS</h1>
      <p className="text-[#7299B4] text-sm mt-1">Financial clarity built for freelancers</p>
    </div>
  );
}

type Mode = "signin" | "forgot" | "sent";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode]             = useState<Mode>("signin");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  async function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(friendlyError(error.message)); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleForgotPassword(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { setError(friendlyError(error.message)); return; }
    setMode("sent");
  }

  if (mode === "sent") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#0D1B2B]">
        <div className="w-full max-w-sm">
          <BrandHeader />
          <div className="card text-center space-y-5">
            <div className="w-14 h-14 bg-[#3AB5A020] rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-[#3AB5A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#D8E8F4]">Check your email</h2>
              <p className="text-sm text-[#7299B4] mt-1">
                We sent a password reset link to{" "}
                <span className="text-[#D8E8F4] font-medium">{resetEmail}</span>
              </p>
            </div>
            <p className="text-xs text-[#4A6882]">
              Didn&apos;t receive it? Check your spam folder or{" "}
              <button
                onClick={() => { setMode("forgot"); setError(""); }}
                className="text-[#3AB5A0] hover:underline"
              >
                try again
              </button>
              .
            </p>
            <div className="pt-2 border-t border-[#1E3550]">
              <button
                onClick={() => { setMode("signin"); setError(""); }}
                className="text-sm text-[#4A6882] hover:text-[#D8E8F4] transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#0D1B2B]">
        <div className="w-full max-w-sm">
          <BrandHeader />
          <div className="card">
            <h2 className="text-lg font-semibold mb-1">Reset your password</h2>
            <p className="text-sm text-[#7299B4] mb-6">
              Enter your email and we&apos;ll send you a link to create a new password.
            </p>

            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div>
                <label className="label block mb-2">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>

              {error && (
                <p className="text-sm text-[#D97070] bg-[#D9707010] px-4 py-3 rounded-xl">{error}</p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner /> Sending link…
                  </span>
                ) : "Send reset link"}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button
                onClick={() => { setMode("signin"); setError(""); }}
                className="text-sm text-[#4A6882] hover:text-[#D8E8F4] transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0D1B2B]">
      <div className="w-full max-w-sm">
        <BrandHeader />

        <div className="card">
          <h2 className="text-lg font-semibold mb-6">Sign in</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="label block mb-2">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label">Password</label>
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setResetEmail(email); setError(""); }}
                  className="text-xs text-[#4A6882] hover:text-[#3AB5A0] transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input pr-12"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3A5470] hover:text-[#D8E8F4] transition-colors p-1 rounded"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
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

            {error && (
              <p className="text-sm text-[#D97070] bg-[#D9707010] px-4 py-3 rounded-xl">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> Signing in…
                </span>
              ) : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-[#4A6882] mt-5">
            No account?{" "}
            <Link href="/signup" className="text-[#3AB5A0] hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
