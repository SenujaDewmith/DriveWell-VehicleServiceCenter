import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { getCroppedImageBlob } from "@/lib/cropImage";

interface AvatarEditorDialogProps {
  imageSrc: string | null;
  onOpenChange: (open: boolean) => void;
  onSave: (blob: Blob) => Promise<void>;
}

export function AvatarEditorDialog({ imageSrc, onOpenChange, onSave }: AvatarEditorDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCropperReady, setIsCropperReady] = useState(false);

  // Reset the editor's transform state whenever a new image is loaded into it,
  // so leftover pan/zoom from a previous selection doesn't carry over. The
  // Cropper measures its container on mount, and shadcn's Dialog scales in
  // from 95% (see dialog.tsx's data-[state=open]:zoom-in-95) — mounting the
  // Cropper before that transition settles gives it the wrong size, so it
  // stays hidden behind a placeholder until the ~200ms animation is done.
  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError(null);
    setIsCropperReady(false);
    if (!imageSrc) return;
    const timer = setTimeout(() => setIsCropperReady(true), 250);
    return () => clearTimeout(timer);
  }, [imageSrc]);

  const handleDialogOpenChange = (open: boolean) => {
    if (isSaving) return; // don't allow dismissing mid-upload
    if (!open) onOpenChange(false);
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsSaving(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      await onSave(blob);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save avatar");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!imageSrc} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Avatar</DialogTitle>
          <DialogDescription>
            Drag to reposition and use the slider to zoom, then save.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-md bg-muted">
          {imageSrc && isCropperReady ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <Slider
            min={1}
            max={3}
            step={0.05}
            value={[zoom]}
            onValueChange={([value]) => setZoom(value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !croppedAreaPixels}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? "Saving..." : "Save Avatar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
