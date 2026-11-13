import { it, expect } from "vitest";
import {
  findChannelLogo,
  indexChannelLogos,
} from "../apps/api/src/providers/channel-artwork";
it("imports colour logos by channel identity and region without channel-specific URL rules", () => {
  const index = indexChannelLogos(
    [
      { id: "rugby.za", name: "SuperSport Rugby", country: "ZA" },
      { id: "sky.uk", name: "Sky Sports Golf", country: "UK" },
      { id: "sky.ie", name: "Sky Sports Golf", country: "IE" },
    ],
    [
      {
        channel: "rugby.za",
        in_use: true,
        url: "https://images.example.com/rugby.png",
        tags: [],
      },
      {
        channel: "rugby.za",
        in_use: true,
        url: "https://images.example.com/white.png",
        tags: ["white"],
      },
      {
        channel: "sky.uk",
        in_use: true,
        url: "https://images.example.com/uk.png",
      },
      {
        channel: "sky.ie",
        in_use: true,
        url: "https://images.example.com/ie.png",
      },
    ],
  );
  expect(findChannelLogo(index, "SuperSport Rugby")).toBe(
    "https://images.example.com/rugby.png",
  );
  expect(findChannelLogo(index, "Sky Sports Golf HD UK")).toBe(
    "https://images.example.com/uk.png",
  );
  expect(findChannelLogo(index, "Sky Sports Golf DE")).toBeNull();
  expect(findChannelLogo(index, "Unrelated Sports")).toBeNull();
});
it("rejects inactive and non-HTTPS logos rather than inventing artwork", () => {
  expect(
    indexChannelLogos(
      [{ id: "x", name: "X", country: "GB" }],
      [
        { channel: "x", in_use: false, url: "https://example.com/old.png" },
        { channel: "x", in_use: true, url: "javascript:bad" },
      ],
    ),
  ).toEqual([]);
});
