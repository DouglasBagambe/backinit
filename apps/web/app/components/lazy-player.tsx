"use client";
import dynamic from "next/dynamic";
export const LazyPlayer = dynamic(
  () => import("./player").then((m) => m.Player),
  {
    loading: () => (
      <div className="panel" aria-busy="true">
        Loading player…
      </div>
    ),
  },
);
