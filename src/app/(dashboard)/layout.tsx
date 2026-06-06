import Navbar from "@/components/ui/Navbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F8F5]">
      <Navbar />
      {/* pb-24 on mobile clears the fixed bottom nav; md:pb-8 removes it on desktop */}
      <main className="max-w-6xl mx-auto px-4 pt-6 pb-24 md:pt-8 md:pb-8">{children}</main>
    </div>
  );
}
