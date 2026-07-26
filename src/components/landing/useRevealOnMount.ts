"use client";

import { useEffect, useState } from "react";

// False for one frame after mount, then true — enough for a "start at zero,
// then animate to real value" effect (progress bars, etc) on every mount.
// Pair with a `key` prop on the parent so page switches remount and re-animate.
export default function useRevealOnMount(): boolean {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return revealed;
}
