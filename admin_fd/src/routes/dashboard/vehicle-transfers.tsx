import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeftRight, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export const Route = createFileRoute("/dashboard/vehicle-transfers")({
  component: VehicleTransfersPage,
});

interface DetachedVehicle {
  vehicle_id: number;
  plate_no: string;
  make: string;
  model: string;
  vehicle_type: string;
  year: number | null;
  detached_at: string | null;
  previous_owner: { user_id: number; email: string; full_name: string | null } | null;
}

function VehicleTransfersPage() {
  const { role } = useAuth();
  const [vehicles, setVehicles] = useState<DetachedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [plateFilter, setPlateFilter] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showDialog, setShowDialog] = useState(false);
  const [transferPlate, setTransferPlate] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const load = (plate?: string) => {
    setLoading(true);
    const query = plate ? `?plate=${encodeURIComponent(plate)}` : "";
    api
      .get<{ vehicles: DetachedVehicle[] }>(`/api/admin/vehicles/detached${query}`)
      .then((d) => setVehicles(d.vehicles))
      .catch(() => setError("Failed to load detached vehicles"))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  if (role !== "manager") return <Navigate to="/dashboard" />;

  const openTransferDialog = (plate = "") => {
    setTransferPlate(plate);
    setNewOwnerEmail("");
    setDialogError("");
    setShowDialog(true);
  };

  const submitTransfer = async () => {
    if (!transferPlate.trim() || !newOwnerEmail.trim()) {
      setDialogError("Plate number and new owner email are required");
      return;
    }
    setTransferring(true);
    setDialogError("");
    try {
      await api.post("/api/admin/vehicles/force-transfer", {
        plate_no: transferPlate.trim(),
        new_owner_email: newOwnerEmail.trim(),
      });
      setShowDialog(false);
      setSuccess(`${transferPlate.trim().toUpperCase()} transferred successfully`);
      setError("");
      load(plateFilter);
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Vehicle Transfers</h1>
        <button
          onClick={() => openTransferDialog()}
          className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          <ArrowLeftRight className="h-4 w-4" /> Transfer Vehicle Ownership
        </button>
      </div>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-accent border border-accent/30 bg-accent/5 rounded-md px-3 py-2">{success}</p>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search by plate number..."
            value={plateFilter}
            onChange={(e) => setPlateFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(plateFilter)}
            className="w-full pl-8 border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={() => load(plateFilter)}
          className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
        >
          Search
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plate</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Previous Owner</TableHead>
                <TableHead>Detached On</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v) => (
                <TableRow key={v.vehicle_id}>
                  <TableCell className="font-medium text-foreground">{v.plate_no}</TableCell>
                  <TableCell className="text-foreground">
                    {v.make} {v.model} ({v.vehicle_type}){v.year ? ` — ${v.year}` : ""}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {v.previous_owner ? (
                      <>
                        {v.previous_owner.full_name ?? "—"}
                        <div className="text-xs text-muted-foreground">{v.previous_owner.email}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {v.detached_at ? new Date(v.detached_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => openTransferDialog(v.plate_no)}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Force Transfer
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {vehicles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No detached vehicles found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => !transferring && setShowDialog(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Vehicle Ownership</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Works for any plate — currently active or already detached. Use this after verifying proof of
              sale/ownership in person.
            </p>
            {dialogError && (
              <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{dialogError}</p>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Plate Number</label>
              <input
                value={transferPlate}
                onChange={(e) => setTransferPlate(e.target.value)}
                placeholder="e.g. CAA-1234"
                className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">New Owner Email</label>
              <input
                type="email"
                value={newOwnerEmail}
                onChange={(e) => setNewOwnerEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowDialog(false)}
              disabled={transferring}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:border-muted-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={submitTransfer}
              disabled={transferring}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {transferring ? "Transferring..." : "Transfer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
