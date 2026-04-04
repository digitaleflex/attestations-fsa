"use client";

import { useEffect, useState } from "react";
import NextTopLoader from "nextjs-toploader";

export function TopLoader() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <NextTopLoader
      color="#16a34a"
      initialPosition={0.08}
      crawlSpeed={200}
      height={3}
      crawl={true}
      showSpinner={false}
      easing="ease"
      speed={200}
      shadow="0 0 10px #16a34a,0 0 5px #16a34a"
    />
  );
}
