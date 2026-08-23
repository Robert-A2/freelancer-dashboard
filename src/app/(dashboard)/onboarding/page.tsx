import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { needsOnboarding } from "@/lib/onboarding";
import OnboardingWizard from "./OnboardingWizard";

export const dynamic = "force-dynamic";

// Shown only to a genuinely brand-new user (no CSV history, no manual setup
// — spec section 4). Anyone with existing transactions or a cash checkpoint
// already is sent straight to the real dashboard, never back through this.
export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const needsIt = await needsOnboarding(user.id);
  if (!needsIt) redirect("/dashboard");

  return <OnboardingWizard />;
}
