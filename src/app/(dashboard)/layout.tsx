import Navbar from "@/components/ui/Navbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F8F5]">
      <Navbar />
      {/* pb-24 on mobile clears the fixed bottom nav; md:pb-8 removes it on desktop */}
      <main className="max-w-5xl mx-auto px-5 pt-8 pb-28 sm:px-6 md:pt-12 md:pb-12">{children}</main>
    </div>
  );
}
