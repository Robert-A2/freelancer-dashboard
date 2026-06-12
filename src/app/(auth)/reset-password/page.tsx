"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t  = useTranslations("auth.resetPassword");
  const tErrors = useTranslations("auth.resetPassword.errors");
  const tAuth = useTranslations("auth");
  const tc = useTranslations("common");

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);
  const [ready, setReady]         = useState(false);
  const [exchanging, setExchanging] = useState(true);

  useEffect(() => {
    const hasRecoveryParams =
      searchParams.get("code") !== null ||
      window.location.hash.includes("type=recovery");

    if (!hasRecoveryParams) {
      setError(tErrors("invalidLink"));
      setExchanging(false);
      return;
    }

    const supabase = createClient();

    // The Supabase browser client automatically detects the recovery code
    // (or token) in the URL and establishes the session on initialization,
    // emitting a PASSWORD_RECOVERY event. Calling exchangeCodeForSession
    // ourselves here would consume the single-use code a second time and
    // always fail, so we just listen for the result instead.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setExchanging(false);
        setReady(true);
      }
    });

    // In case initialization already finished (and emitted the event)
    // before this listener was attached.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setExchanging(false);
        setReady(true);
      }
    });

    const timeout = setTimeout(() => {
      setExchanging((current) => {
        if (current) setError(tErrors("expiredLink"));
        return false;
      });
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [searchParams]);

  async function handleReset(e: React.SyntheticEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) { setError(tErrors("passwordTooShort")); return; }
    if (password !== confirm) { setError(tErrors("passwordsNoMatch")); return; }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) { setError(tErrors("updateFailed")); return; }
    setSuccess(true);
    setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0D1B2B]">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#E8F0F8]">{tc("appName")}</h1>
          <p className="text-[#7BA8C4] text-sm mt-1">{tc("tagline")}</p>
        </div>

        {exchanging && (
          <div className="card flex items-center justify-center gap-3 py-10">
            <Spinner />
            <p className="text-sm text-[#7BA8C4]">{t("verifying")}</p>
          </div>
        )}

        {!exchanging && !ready && (
          <div className="card text-center space-y-5">
            <div className="w-14 h-14 bg-[#D9707010] rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-[#D97070]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#E8F0F8]">{t("linkExpiredHeading")}</h2>
              <p className="text-sm text-[#7BA8C4] mt-1">{error}</p>
            </div>
            <button onClick={() => router.push("/login")} className="btn-primary text-sm">
              {t("requestNewLink")}
            </button>
          </div>
        )}

        {success && (
          <div className="card text-center space-y-5">
            <div className="w-14 h-14 bg-[#4CC4A420] rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-[#4CC4A4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#E8F0F8]">{t("successHeading")}</h2>
              <p className="text-sm text-[#7BA8C4] mt-1">{t("successBody")}</p>
            </div>
          </div>
        )}

        {ready && !success && (
          <div className="card">
            <div className="mb-6">
              <h2 className="text-lg font-semibold">{t("heading")}</h2>
              <p className="text-sm text-[#7BA8C4] mt-1">
                {t("subtitle")}
              </p>
            </div>

            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label className="label block mb-2">{t("newPassword")}</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    className="input pr-12"
                    placeholder={t("newPasswordPlaceholder")}
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6A97B4] hover:text-[#E8F0F8] transition-colors p-1"
                    aria-label={showPwd ? tAuth("hidePassword") : tAuth("showPassword")}
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
                <label className="label block mb-2">{t("confirmPassword")}</label>
                <input
                  type={showPwd ? "text" : "password"}
                  className="input"
                  placeholder={t("confirmPasswordPlaceholder")}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-[#D4A254]">{t("passwordHint")}</p>
              )}
              {password.length >= 8 && confirm.length > 0 && password !== confirm && (
                <p className="text-xs text-[#D97070]">{t("passwordsNoMatch")}</p>
              )}
              {password.length >= 8 && confirm.length > 0 && password === confirm && (
                <p className="text-xs text-[#4CC4A4]">{t("passwordsMatch")}</p>
              )}

              {error && (
                <p className="text-sm text-[#D97070] bg-[#D9707010] px-4 py-3 rounded-xl">{error}</p>
              )}

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={loading || password.length < 8 || password !== confirm}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner /> {t("updating")}
                  </span>
                ) : t("updatePassword")}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations("auth.resetPassword");
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0D1B2B]">
        <div className="flex items-center gap-3 text-[#6A97B4]">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {t("loading")}
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
