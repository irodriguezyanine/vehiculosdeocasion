import { extractGlo3dOperationDetails } from "@/lib/vehicle-draft-sources";
import type { CatalogItem } from "@/types/catalog";
import type { EditorVehicleDetails } from "@/types/editor";

export function extractGlo3dEditorDetails(item: CatalogItem): Partial<EditorVehicleDetails> {
  return extractGlo3dOperationDetails(item);
}

export function mergeEditorDetailsPreferPrimary(
  primary: EditorVehicleDetails,
  fallback: Partial<EditorVehicleDetails>,
): EditorVehicleDetails {
  const merged: EditorVehicleDetails = { ...fallback };
  for (const [key, value] of Object.entries(primary)) {
    if (value !== undefined && String(value).trim() !== "") {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}
