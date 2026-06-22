export default function DataPrivacyPage() {
  const neverItems = [
    "We never sell your data to anyone",
    "We never share your data with third parties for advertising",
    "We never use your financial data to train AI models",
    "We never store your raw CSV or bank statement",
    "We never access your bank account directly — you export the CSV yourself",
  ];

  return (
    <div className="min-h-screen bg-[#0B1929]">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-16 space-y-6">

        <div>
          <a href="/upload" className="text-xs text-[#6A97B4] hover:text-[#E8F0F8] transition-colors">
            ← Back to upload
          </a>
          <h1 className="text-2xl font-bold text-[#E8F0F8] mt-4">Your data</h1>
          <p className="text-sm text-[#7BA8C4] mt-2 leading-relaxed">
            Plain and simple — here is exactly what happens to your information when you use Freelancer OS.
          </p>
        </div>

        <div className="card space-y-2">
          <h2 className="text-base font-semibold text-[#E8F0F8]">What stays on your device</h2>
          <p className="text-sm text-[#7BA8C4] leading-relaxed">
            Your bank statement CSV is read entirely in your browser. The raw file never travels to our server — not even briefly. You can verify this yourself by opening browser DevTools and watching the network requests while you upload. You will not see your file contents in any request.
          </p>
        </div>

        <div className="card space-y-2">
          <h2 className="text-base font-semibold text-[#E8F0F8]">What we store</h2>
          <p className="text-sm text-[#7BA8C4] leading-relaxed">
            We store the structured rows extracted from your CSV: transaction dates, amounts, merchant or payee descriptions, and the categories we assign. We do not store bank account numbers, sort codes, IBANs, or any credential that could identify or access your bank account.
          </p>
        </div>

        <div className="card space-y-3">
          <h2 className="text-base font-semibold text-[#E8F0F8]">What we never do</h2>
          <ul className="space-y-2">
            {neverItems.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-[#7BA8C4]">
                <span className="text-[#3AB5A0] flex-shrink-0 mt-0.5">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="card space-y-2">
          <h2 className="text-base font-semibold text-[#E8F0F8]">How to delete everything</h2>
          <p className="text-sm text-[#7BA8C4] leading-relaxed">
            Go to Settings → Delete my data. This permanently removes all your transactions, categories, imports, and your account from our database. It happens immediately. There is no waiting period and no recovery after deletion.
          </p>
        </div>

        <div className="card space-y-2">
          <h2 className="text-base font-semibold text-[#E8F0F8]">Who runs this</h2>
          <p className="text-sm text-[#7BA8C4] leading-relaxed">
            Freelancer OS is built and run by Robert Arthur. If you have any questions about your data, email{" "}
            <a href="mailto:robertkofi.arthur@gmail.com" className="text-[#3AB5A0] hover:underline">
              robertkofi.arthur@gmail.com
            </a>{" "}
            directly. You will get a reply from a real person, not a support ticket system.
          </p>
        </div>

        <div className="card space-y-2">
          <h2 className="text-base font-semibold text-[#E8F0F8]">GDPR</h2>
          <p className="text-sm text-[#7BA8C4] leading-relaxed">
            If you are based in the EU or UK, you have the right to access, correct, and delete your personal data at any time. To exercise any of these rights, email{" "}
            <a href="mailto:robertkofi.arthur@gmail.com" className="text-[#3AB5A0] hover:underline">
              robertkofi.arthur@gmail.com
            </a>. We will respond within 72 hours.
          </p>
        </div>

        <p className="text-xs text-[#6A97B4] text-center pb-4">Last updated: June 2026</p>

      </div>
    </div>
  );
}
