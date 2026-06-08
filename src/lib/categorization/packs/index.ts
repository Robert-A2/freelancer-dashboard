import type { MerchantPack } from "../types";
import { GLOBAL_PACK } from "./global";
import { FRANCE_PACK } from "./france";

/**
 * Every active merchant pack, merged by the engine into one lookup table.
 * Adding a new country is a pure data change: write `packs/<country>.ts`
 * exporting a `MerchantPack`, then add it to this array — the matching
 * engine itself never needs to change.
 */
export const ACTIVE_PACKS: MerchantPack[] = [GLOBAL_PACK, FRANCE_PACK];
