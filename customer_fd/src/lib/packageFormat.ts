import { ASSET_BASE_URL } from "@/lib/apiClient";

export function fmtDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export function getBullets(description: string | null): string[] {
  if (!description) return [];
  return description.split("\n").map((l) => l.trim()).filter(Boolean);
}

export function imageSrc(image_url: string | null) {
  return image_url ? `${ASSET_BASE_URL}${image_url}` : null;
}
