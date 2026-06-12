import { GLOBAL_MERCHANTS } from "./global";
import { UK_MERCHANTS } from "./uk";
import { FRANCE_MERCHANTS } from "./france";
import { EUROPE_MERCHANTS } from "./europe";
import type { SeedMerchant } from "./types";

export type { SeedMerchant } from "./types";

export const ALL_SEED_MERCHANTS: SeedMerchant[] = [
  ...GLOBAL_MERCHANTS,
  ...UK_MERCHANTS,
  ...FRANCE_MERCHANTS,
  ...EUROPE_MERCHANTS,
];
