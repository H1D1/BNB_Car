"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window`, so it is only ever rendered client-side.
export const CarMapLazy = dynamic(() => import("./CarMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" />,
});
