// Three-bar mark used next to the "Nonodia" wordmark on the marketing
// landing page navbar/footer — the ascending bars echo the runway/growth
// idea (short → tall) without needing an external logo asset.
export default function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="12" width="5" height="10" rx="1.5" fill="#4F46E5" />
      <rect x="9.5" y="6" width="5" height="16" rx="1.5" fill="#4F46E5" />
      <rect x="17" y="2" width="5" height="20" rx="1.5" fill="#4F46E5" />
    </svg>
  );
}
