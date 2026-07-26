import Navbar from "@/components/ui/Navbar";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Each page redirects unauthenticated visitors itself — this only supplies
  // the identity AccountDrawer needs, so it degrades to blanks rather than
  // duplicating that redirect logic here.
  const dbUser = user ? await prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true } }) : null;
  const fullName = dbUser?.fullName ?? user?.user_metadata?.full_name ?? "";
  const email = user?.email ?? "";

  return (
    <div className="min-h-screen bg-[#0D1B2B]">
      <Navbar fullName={fullName} email={email} />
      {/* pb-28 clears the fixed bottom nav, shown below Navbar's 1400px
          breakpoint (see comment there for why 1400 specifically);
          min-[1400px]:pb-12 removes the reserved space once the top nav takes over */}
      <main className="max-w-5xl mx-auto px-5 pt-8 pb-28 sm:px-6 min-[1400px]:pt-12 min-[1400px]:pb-12">{children}</main>
    </div>
  );
}
