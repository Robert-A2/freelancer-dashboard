import DemoNavbar from "@/components/demo/DemoNavbar";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0D1B2B] overflow-x-hidden">
      <DemoNavbar />

      {/* Demo banner — persistent, below the navbar */}
      <div className="bg-[#D4A25410] border-b border-[#D4A25430]">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4A254] flex-shrink-0" />
          <p className="text-xs text-[#D4A254] font-medium">
            Demo Account — All data shown is fictional. This is Sophie Martin, Freelance UX Designer.
          </p>
          <a href="/signup" className="ml-auto text-xs font-semibold text-[#3AB5A0] hover:text-[#4CC4A4] transition-colors flex-shrink-0">
            Use your own data →
          </a>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-5 pt-8 pb-28 sm:px-6 md:pt-12 md:pb-12">
        {children}
      </main>
    </div>
  );
}
