import Image from "next/image";

// Landing page only — presents the real, unedited product photo (a Dell
// laptop displaying the actual Nonodia dashboard). Pure responsive
// container + image + spacing; no recreated UI, no business logic. The
// photo itself is the asset — this component only decides how large it
// renders and how much room it gets at each breakpoint.
export default function ProductLaptopShowcase() {
  return (
    <div className="w-full max-w-[400px] sm:max-w-[560px] mx-auto lg:max-w-[560px] lg:mx-0">
      <Image
        src="/showcase/nonodia-laptop-showcase.png"
        alt="Nonodia financial dashboard displayed on a laptop"
        width={1280}
        height={940}
        sizes="(min-width: 1024px) 560px, (min-width: 640px) 560px, 400px"
        className="w-full h-auto rounded-2xl shadow-[0_24px_60px_-24px_rgba(13,27,43,0.28)]"
      />
    </div>
  );
}
