import type { Category, ChargeMapping } from "./types";

/**
 * Charge -> revenue category mapping (34 rows supplied by the business, 17 Oct 2026).
 * Seeded into the `chargeMappings` collection by scripts/seed-mappings.mjs; edit the
 * collection once seeded. This list is only used if the collection is empty.
 * Charges not listed fall into "Other".
 */
export const DEFAULT_MAPPINGS: ChargeMapping[] = ([
  ["REPAIR AND MAINTENANCE CHARGES", "M&R"],
  ["TANK RENT", "EXIM"],
  ["HANDLING FEES", "EXIM"],
  ["OCEAN FREIGHT CHARGES", "EXIM"],
  ["STORAGE CHARGES", "M&R"],
  ["REPO TRUCING IN ORIGIN", "EXIM"],
  ["TANK PREPARATION CHARGES", "EXIM"],
  ["DOCUMENTATION CHARGES", "EXIM"],
  ["LADEN STORAGE", "EXIM"],
  ["AGENCY COMMISSION", "EXIM"],
  ["DEMURRAGE CHARGES", "Detention"],
  ["TANK CLEANING & PREPARATION CHARGES", "M&R"],
  ["BL AMENDMENT CHARGES", "EXIM"],
  ["DEM-IMP", "Detention"],
  ["CUSTOM CLEARANCE CHARGES ORIGIN", "EXIM"],
  ["DEM-EXP", "Detention"],
  ["LEASE RENT CHARGES", "Lease"],
  ["DETENTION CHARGES", "Detention"],
  ["OTHER CHARGES", "EXIM"],
  ["IMPORT DETENTION CHARGES", "EXIM"],
  ["ORIGIN TRANSPORTATION CHARGES", "EXIM"],
  ["MANIFEST CHARGES", "EXIM"],
  ["PORT HANDLING CHARGES", "EXIM"],
  ["DETENTION COMMISION", "Detention"],
  ["EXPORT DETENTION CHARGES", "Detention"],
  ["DESTINATION HANDLING CHARGES", "EXIM"],
  ["LEAK TEST", "M&R"],
  ["MANLID GASKET", "M&R"],
  ["LIFT ON/LIFT OFF CHARGES", "M&R"],
  ["TRANSPORT AT ORIGIN", "EXIM"],
  ["DESTINATION PORT SECURITY SURCHARGES", "EXIM"],
  ["CUSTOM CLEARANCE CHARGES", "EXIM"],
  ["DESTINATION TRANSPORTATION CHARGES", "EXIM"],
  ["OTHER FREIGHT CHARGES", "EXIM"],
] as Array<[string, Category]>).map(([chargeName, revenueCategory]) => ({ chargeName, revenueCategory }));

export const normCharge = (s: string | undefined | null) => (s || "").trim().toUpperCase();
