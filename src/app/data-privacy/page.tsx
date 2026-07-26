export default function DataPrivacyPage() {
  const neverItems = [
    "We never sell your data to anyone",
    "We never share your data with third parties for advertising",
    "We never use your financial data to train AI models",
    "We never store your raw CSV or bank statement",
    "We never access your bank account directly — you export the CSV yourself",
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16 md:py-20">

        <a href="/" className="text-sm text-[#6B7280] hover:text-[#111827] transition-colors">
          ← Back to home
        </a>

        <h1 className="text-3xl font-bold text-[#111827] mt-6 mb-3 tracking-tight">Your data</h1>
        <p className="text-[15px] text-[#4B5563] leading-relaxed mb-14">
          Plain and simple — here is exactly what happens to your information when you use Nonodia.
        </p>

        <div className="space-y-12">

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">What stays on your device</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              Your bank statement CSV is read entirely in your browser. The raw file never travels to our server — not even briefly. You can verify this yourself by opening browser DevTools and watching the network requests while you upload. You will not see your file contents in any request.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">What we store</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed mb-4">
              From your CSV, we store the structured rows only: transaction dates, amounts, merchant or payee descriptions, and the categories we assign. We do not store bank account numbers, sort codes, IBANs, or any credential that could identify or access your bank account.
            </p>
            <p className="text-[15px] text-[#4B5563] leading-relaxed mb-4">
              If you create projects and milestone invoices, we also store the project and client names you enter, milestone amounts, and due dates. If you connect Stripe to accept milestone payments, we store your Stripe account ID so we know where to send them — we never see or store your clients&rsquo; card numbers; Stripe collects those directly, and Nonodia&rsquo;s fee is deducted automatically from your payout, never charged separately to your client.
            </p>
            <p className="text-[15px] text-[#4B5563] leading-relaxed mb-4">
              If you fill in your financial profile, we store the country, business type, and VAT details you provide, used only to estimate your tax reserve.
            </p>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              If you upload a logo for your client-facing payment pages, it&rsquo;s stored so it can be displayed there.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">Who else handles your data</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              We rely on two outside providers to run Nonodia: <strong className="text-[#111827] font-medium">Supabase</strong>, for your account login, database, and file storage, and <strong className="text-[#111827] font-medium">Stripe</strong>, for processing milestone payments and holding the funds you receive. Neither is permitted to use your data for anything beyond providing that service to us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">What we never do</h2>
            <ul className="space-y-2.5">
              {neverItems.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[15px] text-[#4B5563]">
                  <span className="text-[#2FA393] flex-shrink-0 mt-1">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">How to delete everything</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed mb-4">
              Go to Settings → Delete my data. This permanently removes your account, transactions, projects, uploaded branding, and financial profile from our database. It happens immediately. There is no waiting period and no recovery after deletion.
            </p>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              If you&rsquo;ve connected Stripe, we also close that Stripe account as part of deletion. Stripe can refuse this if the account still holds a balance or a pending payout — in that case we&rsquo;ll tell you and help you resolve it, rather than silently leaving it open.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">Who runs this</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              Nonodia is built and run by Robert Arthur. If you have any questions about your data, email{" "}
              <a href="mailto:robertkofi.arthur@gmail.com" className="text-[#2FA393] hover:underline">
                robertkofi.arthur@gmail.com
              </a>{" "}
              directly. You will get a reply from a real person, not a support ticket system.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#111827] mb-3">GDPR</h2>
            <p className="text-[15px] text-[#4B5563] leading-relaxed">
              If you are based in the EU or UK, you have the right to access, correct, and delete your personal data at any time. To exercise any of these rights, email{" "}
              <a href="mailto:robertkofi.arthur@gmail.com" className="text-[#2FA393] hover:underline">
                robertkofi.arthur@gmail.com
              </a>. We will respond within 72 hours.
            </p>
          </section>

        </div>

        <p className="text-xs text-[#9CA3AF] mt-16">Last updated: July 2026</p>

      </div>
    </div>
  );
}
