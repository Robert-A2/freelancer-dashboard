// Projects deliberately steps outside the dark analytics-dashboard shell —
// this is where a freelancer puts together a client engagement and where a
// payment link gets born, so it gets its own calm, paper-white "premium
// business" surface instead of the dark navy used everywhere else. The
// left-1/2/-mx-[50vw] pattern breaks the background out to full viewport
// width regardless of the outer layout's max-w-5xl content constraint, while
// the inner wrapper reproduces that same constraint so content still lines
// up exactly where every other page's content does.
export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen bg-premium -mt-8 min-[1400px]:-mt-12 -mb-28 min-[1400px]:-mb-12">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 pt-8 pb-28 min-[1400px]:pt-12 min-[1400px]:pb-12">
        {children}
      </div>
    </div>
  );
}
