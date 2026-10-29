"use client";
import dynamic from "next/dynamic";
import { BrandLoading } from "./brand";
export const LazyPlayer = dynamic(
  () => import("./player").then((m) => m.Player),
  {
    loading: () => (
      <div className="player-loading" aria-busy="true">
        <BrandLoading label="Loading player" />
      </div>
    ),
  },
);
