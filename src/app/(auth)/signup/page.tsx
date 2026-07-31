"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

function friendlyError(raw: string, t: ReturnType<typeof useTranslations<"auth.signup.errors">>): string {
  const msg = raw.toLowerCase();
  if (msg.includes("user already registered") || msg.includes("already been registered"))
    return t("alreadyRegistered");
  if (msg.includes("password should be at least") || msg.includes("password is too short"))
    return t("passwordTooShort");
  if (msg.includes("unable to validate email") || msg.includes("invalid email"))
    return t("invalidEmail");
  if (msg.includes("email rate limit") || msg.includes("too many requests"))
    return t("rateLimit");
  return t("generic");
}

// The signup flow can't roll back supabase.auth.signUp() if this fails (that
// needs the admin/service-role client, not available client-side), so the
// only real options are retry-then-surface or stay silent — staying silent
// is exactly the "empty dashboard, no idea why" failure mode found in the
// competitor complaint audit (Wave/QuickBooks users losing tax filings and
// invoices to the same class of un-surfaced failure). Three attempts with a
// short backoff absorbs a transient blip; a real failure is shown to the
// user instead of leaving an orphaned auth user with no app-side record.
async function createUserRecord(id: string, fullName: string, email: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, fullName, email }),
      });
      if (res.ok) return true;
    } catch {
      // network error — fall through to retry/backoff below
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 500));
  }
  return false;
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
  const t = useTranslations("auth.signup");
  const tErrors = useTranslations("auth.signup.errors");
  const tAuth = useTranslations("auth");
  const tc = useTranslations("common");

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
      setError(friendlyError(signUpError.message, tErrors));
      setLoading(false);
      return;
    }

    if (data.user) {
      const created = await createUserRecord(data.user.id, fullName, email);
      if (!created) {
        setError(tErrors("accountSetupFailed"));
        setLoading(false);
        return;
      }
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
            <h1 className="text-2xl font-bold text-[#E8F0F8]">{tc("appName")}</h1>
            <p className="text-[#7BA8C4] text-sm mt-1">{tc("tagline")}</p>
          </div>

          <div className="card text-center space-y-5">
            <div className="w-14 h-14 bg-[#3AB5A020] rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-[#3AB5A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[#E8F0F8]">{t("confirm.heading")}</h2>
              <p className="text-sm text-[#7BA8C4] mt-1">
                {t("confirm.body")}{" "}
                <span className="text-[#E8F0F8] font-medium">{email}</span>
              </p>
            </div>

            <p className="text-sm text-[#7BA8C4]">
              {t("confirm.instructions")}
            </p>

            <div className="pt-1">
              {resentDone ? (
                <p className="text-sm text-[#4CC4A4]">{t("confirm.resendSent")}</p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-sm text-[#3AB5A0] hover:underline disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {resending && <Spinner />}
                  {resending ? t("confirm.sending") : t("confirm.resend")}
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-[#1E3550] space-y-2">
              <Link href="/login" className="block text-sm text-[#3AB5A0] hover:underline font-medium">
                {t("confirm.goToSignIn")}
              </Link>
              <p className="text-xs text-[#6A97B4]">
                {t("confirm.checkSpam")}
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
          <h1 className="text-2xl font-bold text-[#E8F0F8]">{tc("appName")}</h1>
          <p className="text-[#7BA8C4] text-sm mt-1">{tc("tagline")}</p>
        </div>

        <div className="card">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">{t("heading")}</h2>
            <p className="text-sm text-[#7BA8C4] mt-1">
              {t("subtitle")}
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="label block mb-2">{t("fullName")}</label>
              <input
                type="text"
                className="input"
                placeholder={t("fullNamePlaceholder")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
                autoComplete="name"
              />
            </div>

            <div>
              <label className="label block mb-2">{t("email")}</label>
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
              <label className="label block mb-2">{t("password")}</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input pr-12"
                  placeholder={t("passwordPlaceholder")}
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
                  aria-label={showPassword ? tAuth("hidePassword") : tAuth("showPassword")}
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
                <p className="text-xs text-[#D4A254] mt-1.5">{t("passwordHint")}</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-[#E5484D] bg-[#E5484D10] px-4 py-3 rounded-xl">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> {t("creatingAccount")}
                </span>
              ) : t("createAccount")}
            </button>
          </form>

          <p className="text-center text-sm text-[#6A97B4] mt-5">
            {t("alreadyHaveAccount")}{" "}
            <Link href="/login" className="text-[#3AB5A0] hover:underline font-medium">{t("signIn")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
