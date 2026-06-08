"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DELETED_ITEMS = [
  "Account",
  "Uploaded CSV files",
  "Transactions",
  "Categories and corrections",
  "Dashboard data",
  "Analytics",
  "Forecasts",
  "Historical insights",
];

const CONFIRM_WORD = "DELETE";

type Step = "closed" | "confirming" | "deleting" | "done";

export default function DeleteAccountSection({ email }: { email: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("closed");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function close() {
    setStep("closed");
    setInput("");
    setError(null);
  }

  async function handleDelete() {
    setStep("deleting");
    setError(null);

    const res = await fetch("/api/account", { method: "DELETE" });

    if (!res.ok) {
      setError("Something went wrong while deleting your account. Please try again.");
      setStep("confirming");
      return;
    }

    setStep("done");
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1800);
  }

  return (
    <>
      <div className="card border-[#D9707025]">
        <p className="label text-[#D97070] mb-1">Danger Zone</p>
        <p className="text-sm text-[#7BA8C4] leading-relaxed mb-4">
          Permanently delete your account and every record associated with it —
          uploads, transactions, categories, analytics, and forecasts. This cannot be undone.
        </p>
        <button
          onClick={() => setStep("confirming")}
          className="text-sm font-semibold px-5 py-3 rounded-xl bg-[#D9707015] hover:bg-[#D9707025] text-[#D97070] transition-colors duration-150 min-h-[48px]"
        >
          Delete Account
        </button>
      </div>

      {step !== "closed" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#132537] border border-[#243F5E] rounded-2xl shadow-xl shadow-black/30 p-6 md:p-7">

            {step === "done" ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-4 bg-[#4CC4A420] rounded-full flex items-center justify-center text-[#4CC4A4] text-xl font-bold">
                  ✓
                </div>
                <p className="text-lg font-semibold text-[#E8F0F8] mb-1.5">Account successfully deleted</p>
                <p className="text-sm text-[#7BA8C4]">Taking you back to the homepage…</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#D9707015] rounded-full flex items-center justify-center text-[#D97070] text-xl flex-shrink-0">
                    ⚠
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#E8F0F8]">Delete Account</h2>
                    <p className="text-xs text-[#D97070] font-medium">This action is permanent and cannot be undone</p>
                  </div>
                </div>

                <p className="text-sm text-[#A8C6E0] mb-2">
                  Deleting <span className="font-medium text-[#E8F0F8]">{email}</span> will permanently remove the following:
                </p>
                <ul className="bg-[#1A3048] rounded-xl px-4 py-3 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                  {DELETED_ITEMS.map((item) => (
                    <li key={item} className="text-xs text-[#7BA8C4] flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#D97070] flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>

                <label className="block text-sm text-[#A8C6E0] mb-2">
                  To confirm, type <span className="font-mono font-semibold text-[#D97070]">{CONFIRM_WORD}</span> below:
                </label>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={step === "deleting"}
                  className="input mb-4 font-mono tracking-wide"
                />

                {error && (
                  <p className="text-sm text-[#D97070] mb-4">{error}</p>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={close}
                    disabled={step === "deleting"}
                    className="btn-secondary flex-1 order-2 sm:order-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={input !== CONFIRM_WORD || step === "deleting"}
                    className="flex-1 order-1 sm:order-2 font-semibold px-6 py-3 rounded-xl transition-colors duration-150 min-h-[48px] bg-[#D97070] hover:bg-[#C75F5F] text-[#0D1B2B] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {step === "deleting" ? "Deleting…" : "Delete Account"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
