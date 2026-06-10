"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} disabled={signingOut} className="btn-secondary flex-shrink-0">
      {signingOut ? t("signingOut") : tc("buttons.signOut")}
    </button>
  );
}
