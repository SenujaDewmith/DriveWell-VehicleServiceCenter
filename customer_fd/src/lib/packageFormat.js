import { ASSET_BASE_URL } from "@/lib/apiClient";
export function fmtDuration(mins) {
    if (mins < 60)
        return `${mins} min`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
}
export function getBullets(description) {
    if (!description)
        return [];
    return description.split("\n").map((l) => l.trim()).filter(Boolean);
}
export function imageSrc(image_url) {
    return image_url ? `${ASSET_BASE_URL}${image_url}` : null;
}
