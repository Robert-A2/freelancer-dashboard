export function Sk({
  className = "",
  h = "h-4",
  w = "w-full",
  rounded = "rounded-lg",
}: {
  className?: string;
  h?: string;
  w?: string;
  rounded?: string;
}) {
  return (
    <div className={`bg-[#ECEEE9] animate-pulse ${h} ${w} ${rounded} ${className}`} />
  );
}

export function SkCard({ children, sm = false }: { children: React.ReactNode; sm?: boolean }) {
  return (
    <div className={sm ? "card-sm" : "card"}>
      {children}
    </div>
  );
}
