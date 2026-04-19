import type { TemplateCheckpoint } from "@/lib/types";

// Default 20-point Umbra Standard template. Mirrors seed_phase3.sql and
// is the fallback when a row hasn't been inserted yet (fresh dev DB).
export const DEFAULT_CHECKPOINTS: TemplateCheckpoint[] = [
  { id: "surface_shingle_integrity", label: "Shingle integrity", category: "Roof Surface", weight: 6, order: 1 },
  { id: "surface_granule_loss", label: "Granule loss / aging", category: "Roof Surface", weight: 5, order: 2 },
  { id: "surface_algae_moss", label: "Algae / moss / debris", category: "Roof Surface", weight: 4, order: 3 },
  { id: "surface_visible_damage", label: "Visible damage (hail, impact, lift)", category: "Roof Surface", weight: 6, order: 4 },
  { id: "surface_ridge_hip", label: "Ridge and hip condition", category: "Roof Surface", weight: 4, order: 5 },
  { id: "flashing_plumbing_vents", label: "Plumbing vents seal", category: "Penetrations & Flashing", weight: 5, order: 6 },
  { id: "flashing_chimney", label: "Chimney flashing", category: "Penetrations & Flashing", weight: 5, order: 7 },
  { id: "flashing_skylight", label: "Skylight seals", category: "Penetrations & Flashing", weight: 5, order: 8 },
  { id: "flashing_step_wall", label: "Step flashing at walls", category: "Penetrations & Flashing", weight: 5, order: 9 },
  { id: "flashing_valley", label: "Valley condition", category: "Penetrations & Flashing", weight: 5, order: 10 },
  { id: "drainage_gutters", label: "Gutters (debris, sag, detachment)", category: "Drainage", weight: 5, order: 11 },
  { id: "drainage_downspouts", label: "Downspouts", category: "Drainage", weight: 5, order: 12 },
  { id: "drainage_drip_edge", label: "Drip edge installation", category: "Drainage", weight: 5, order: 13 },
  { id: "structural_deck_sag", label: "Roof deck sag / unevenness", category: "Structural", weight: 6, order: 14 },
  { id: "structural_fascia_soffit", label: "Fascia and soffit condition", category: "Structural", weight: 5, order: 15 },
  { id: "structural_attic_vent", label: "Attic ventilation", category: "Structural", weight: 4, order: 16 },
  { id: "interior_water_staining", label: "Water staining on deck underside", category: "Attic / Interior Signs", weight: 5, order: 17 },
  { id: "interior_daylight", label: "Daylight through roof", category: "Attic / Interior Signs", weight: 5, order: 18 },
  { id: "environment_roof_age", label: "Overall roof age vs. material lifespan", category: "Environmental / Aging", weight: 5, order: 19 },
  { id: "environment_tree_overhang", label: "Tree overhang / surrounding risks", category: "Environmental / Aging", weight: 5, order: 20 },
];

export const DEFAULT_TEMPLATE_NAME = "Umbra Standard 20-Point";

export function sortCheckpoints(
  checkpoints: TemplateCheckpoint[],
): TemplateCheckpoint[] {
  return [...checkpoints].sort((a, b) => a.order - b.order);
}

export function groupCheckpointsByCategory(
  checkpoints: TemplateCheckpoint[],
): Record<string, TemplateCheckpoint[]> {
  const grouped: Record<string, TemplateCheckpoint[]> = {};
  for (const cp of sortCheckpoints(checkpoints)) {
    (grouped[cp.category] ??= []).push(cp);
  }
  return grouped;
}

export function totalWeight(checkpoints: TemplateCheckpoint[]): number {
  return checkpoints.reduce((sum, c) => sum + (c.weight || 0), 0);
}
