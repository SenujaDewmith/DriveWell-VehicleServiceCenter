import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { saveBlob } from "@/lib/downloadBlob";

// Fetches a server-rendered PDF (real vector text/tables/charts, not a DOM
// screenshot) and saves it via a throwaway object URL.
export function DownloadPdfButton({ path, filename }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      const { blob, filename: serverFilename } = await api.downloadFile(path);
      saveBlob(blob, serverFilename || filename);
    } catch {
      setError("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {downloading ? "Generating..." : "Download PDF"}
      </button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
