"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function friendlyError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("user already registered") || msg.includes("already been registered"))
    return "An account with this email already exists. Try signing in instead.";
  if (msg.includes("password should be at least") || msg.includes("password is too short"))
    return "Password must be at least 8 characters.";
  if (msg.includes("unable to validate email") || msg.includes("invalid email"))
    return "Please enter a valid email address.";
  if (msg.includes("email rate limit") || msg.includes("too many requests"))
    return "Too many attempts. Please wait a moment and try again.";
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

type Mode = "signup" | "confirm";

export default function SignupPage() {
  const router = useRouter();

  const [mode, setMode]         = useState<Mode>("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [resending, setResending]     = useState(false);
  const [resentDone, setResentDone]   = useState(false);

  async function handleSignup(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      setError(friendlyError(signUpError.message));
      setLoading(false);
      return;
    }

    if (data.user) {
      await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.user.id, fullName, email }),
      });
    }

    if (data.session) {
      router.push("/dashboard?firstUpload=true");
      router.refresh();
    } else {
      setLoading(false);
      setMode("confirm");
    }
  }

  async function handleResend() {
    setResending(true);
    setResentDone(false);
    const supabase = createClient();
    await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    setResentDone(true);
  }

  if (mode === "confirm") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#0D1B2B]">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-[#E8F0F8]">Freelancer OS</h1>
            <p className="text-[#7BA8C4] text-sm mt-1">Financial clarity built for freelancers</p>
          </div>

          <div className="card text-center space-y-5">
            <div className="w-14 h-14 bg-[#3AB5A020] rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-[#3AB5A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[#E8F0F8]">Check your inbox</h2>
              <p className="text-sm text-[#7BA8C4] mt-1">
                We sent a confirmation link to{" "}
                <span className="text-[#E8F0F8] font-medium">{email}</span>
              </p>
            </div>

            <p className="text-sm text-[#7BA8C4]">
              Click the link in the email to activate your account, then sign in below.
            </p>

            <div className="pt-1">
              {resentDone ? (
                <p className="text-sm text-[#4CC4A4]">Email sent again. Check your inbox and spam folder.</p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-sm text-[#3AB5A0] hover:underline disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {resending && <Spinner />}
                  {resending ? "Sending…" : "Resend confirmation email"}
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-[#1E3550] space-y-2">
              <Link href="/login" className="block text-sm text-[#3AB5A0] hover:underline font-medium">
                Go to sign in →
              </Link>
              <p className="text-xs text-[#6A97B4]">
                Check your spam folder if you don&apos;t see the email.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0D1B2B]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#E8F0F8]">Freelancer OS</h1>
          <p className="text-[#7BA8C4] text-sm mt-1">Financial clarity built for freelancers</p>
        </div>

        <div className="card">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Create your account</h2>
            <p className="text-sm text-[#7BA8C4] mt-1">
              Upload your bank CSV and understand your money in minutes.
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="label block mb-2">Full name</label>
              <input
                type="text"
                className="input"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
                autoComplete="name"
              />
            </div>

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
              <label className="label block mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input pr-12"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6A97B4] hover:text-[#E8F0F8] transition-colors p-1 rounded"
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
              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-[#D4A254] mt-1.5">At least 8 characters needed.</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-[#D97070] bg-[#D9707010] px-4 py-3 rounded-xl">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> Creating account…
                </span>
              ) : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-[#6A97B4] mt-5">
            Already have an account?{" "}
            <Link href="/login" className="text-[#3AB5A0] hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
