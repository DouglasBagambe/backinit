import Constants from "expo-constants";
import { loadCatalogueFromBases } from "./api-client";
import type { Catalogue } from "./types";

const configuredBase = String(
  Constants.expoConfig?.extra?.apiBaseUrl ||
    "https://backinit.live/api",
).replace(/\/$/, "");

const bases = [
  configuredBase,
  "https://backinit.live/api",
  "https://backinit-api-pgaq.onrender.com",
  "https://db.backinit.live/api",
].filter((value, index, values) => values.indexOf(value) === index);

export async function loadCatalogue(): Promise<Catalogue> {
  return loadCatalogueFromBases(bases);
}
