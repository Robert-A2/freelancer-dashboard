import type { Metadata } from "next";

// Reachable from the homepage footer, but never meant to compete with the
// homepage as its own search result — same reasoning as the demo's robots
// export (src/app/demo/layout.tsx): index: false keeps it out of search
// results while follow: true still lets crawlers pass through it normally.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16 md:py-20">

        <a href="/" className="text-sm text-[#6B7280] hover:text-[#111827] transition-colors">
          ← Back to home
        </a>

        <h1 className="text-3xl font-bold text-[#111827] mt-6 mb-3 tracking-tight">Terms of Service</h1>
        <p className="text-[15px] text-[#4B5563] leading-relaxed mb-14">
          Plain language, no fine print designed to be missed. This is the actual agreement between you and Nonodia.
        </p>

        <div className="space-y-12">

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">What Nonodia is</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              Nonodia is a financial dashboard for freelancers: it reads your uploaded bank CSV to show cashflow, forecasts, and client insights, and it optionally lets you send clients milestone invoices they can pay by card through Stripe. It is not a bank, does not hold your money, and is not an accountant or tax advisor — estimates it shows you (like tax reserve amounts) are estimates, not filed tax advice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">Your account</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              You need an account to use Nonodia, and you&rsquo;re responsible for the accuracy of what you enter — client names, invoice amounts, financial profile details — and for keeping your login credentials secure. You must be legally able to enter into contracts to use Nonodia, and to actually invoice the clients you bill through it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">Fees</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              Nonodia&rsquo;s core dashboard, unlimited projects, and branding are free — no subscription, no credit card required. The only fee is 0.3% of each milestone payment your client pays through Nonodia via Stripe. This is deducted automatically from your payout when the payment clears; it is never added to what your client pays, and it is never charged if you aren&rsquo;t getting paid.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">Payments and Stripe</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed mb-4">
              Milestone payments are processed by Stripe, not Nonodia — money your client pays goes directly to your own Stripe account, minus Nonodia&rsquo;s fee. You&rsquo;re responsible for your own Stripe account being in good standing (Stripe requires identity verification before it will pay out to you), and for resolving any payment dispute or chargeback your client raises with Stripe directly.
            </p>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              Nonodia is not a party to the contract between you and your client. We provide the invoicing and payment link; the work, its quality, and the agreement to be paid for it are between you and your client alone.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">Ending your account</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              You can delete your account at any time from Settings — see our <a href="/data-privacy" className="text-[#2FA393] hover:underline">Data Privacy</a> page for exactly what that removes. We may suspend or close an account used to violate these terms (for example, to defraud a client or evade Stripe&rsquo;s own terms), and we&rsquo;ll tell you why if we do.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">No warranty, limited liability</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              Nonodia is provided as-is. We work to keep it accurate and available, but forecasts, tax reserve estimates, and categorization are estimates based on the data you provide, not guarantees. To the extent permitted by law, Nonodia isn&rsquo;t liable for business decisions made based on these estimates, or for the actions of third parties we rely on (Stripe, Supabase) that are outside our control.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">Changes to these terms</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              If we change these terms in a way that matters, we&rsquo;ll update the date below and, for significant changes, email you directly rather than expecting you to check back.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">Questions</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              Nonodia is built and run by Robert Arthur. Email{" "}
              <a href="mailto:robertkofi.arthur@gmail.com" className="text-[#2FA393] hover:underline">
                robertkofi.arthur@gmail.com
              </a>{" "}
              with any question about these terms — you&rsquo;ll get a reply from a real person.
            </p>
          </section>

        </div>

        <p className="text-xs text-[#9CA3AF] mt-16">Last updated: July 2026</p>

      </div>
    </div>
  );
}
