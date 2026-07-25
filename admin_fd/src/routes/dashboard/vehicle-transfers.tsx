import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeftRight, Search } from "lucide-react";
import { api, BASE } from "@/lib/api";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PlateNumberInput } from "@/components/PlateNumberInput";
import { isValidSriLankanPlate } from "@/lib/plateNumber";

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

interface PersonRef {
  user_id: number;
  email: string;
  full_name: string | null;
}

interface TransferRequestRow {
  request_id: number;
  status: "Pending" | "Approved" | "Rejected";
  contact_phone: string;
  created_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  vehicle: {
    vehicle_id: number;
    plate_no: string;
    make: string;
    model: string;
    vehicle_type: string;
    year: number | null;
  };
  requester: PersonRef;
  current_owner: PersonRef | null;
}

function DocumentImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load document");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (failed) return <p className="text-sm text-destructive">Failed to load document</p>;
  if (!src)
    return (
      <div className="flex items-center justify-center h-40 rounded-md border border-border text-sm text-muted-foreground">
        Loading...
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      className="w-full max-h-64 rounded-md border border-border object-contain bg-muted"
    />
  );
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

  const [requests, setRequests] = useState<TransferRequestRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [reviewRequest, setReviewRequest] = useState<TransferRequestRow | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const load = (plate?: string) => {
    setLoading(true);
    const query = plate ? `?plate=${encodeURIComponent(plate)}` : "";
    api
      .get<{ vehicles: DetachedVehicle[] }>(`/api/admin/vehicles/detached${query}`)
      .then((d) => setVehicles(d.vehicles))
      .catch(() => setError("Failed to load detached vehicles"))
      .finally(() => setLoading(false));
  };

  const loadRequests = () => {
    setRequestsLoading(true);
    api
      .get<{ requests: TransferRequestRow[] }>(
        "/api/admin/vehicles/transfer-requests?status=Pending",
      )
      .then((d) => setRequests(d.requests))
      .catch(() => setError("Failed to load transfer requests"))
      .finally(() => setRequestsLoading(false));
  };

  useEffect(() => {
    load();
    loadRequests();
  }, []);

  if (role !== "manager") return <Navigate to="/dashboard" />;

  const openReview = (request: TransferRequestRow) => {
    setReviewRequest(request);
    setReviewError("");
    setRejectReason("");
    setShowRejectInput(false);
  };

  const approveRequest = async () => {
    if (!reviewRequest) return;
    setReviewing(true);
    setReviewError("");
    try {
      await api.post(
        `/api/admin/vehicles/transfer-requests/${reviewRequest.request_id}/approve`,
        {},
      );
      setSuccess(
        `${reviewRequest.vehicle.plate_no} transferred to ${reviewRequest.requester.full_name ?? reviewRequest.requester.email}`,
      );
      setError("");
      setReviewRequest(null);
      loadRequests();
      load(plateFilter);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setReviewing(false);
    }
  };

  const rejectRequest = async () => {
    if (!reviewRequest) return;
    setReviewing(true);
    setReviewError("");
    try {
      await api.post(`/api/admin/vehicles/transfer-requests/${reviewRequest.request_id}/reject`, {
        reason: rejectReason || undefined,
      });
      setSuccess(`Transfer request for ${reviewRequest.vehicle.plate_no} rejected`);
      setError("");
      setReviewRequest(null);
      loadRequests();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setReviewing(false);
    }
  };

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
    if (!isValidSriLankanPlate(transferPlate)) {
      setDialogError("Enter a valid Sri Lankan plate number (e.g. CAB-1234)");
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
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-accent border border-accent/30 bg-accent/5 rounded-md px-3 py-2">
          {success}
        </p>
      )}

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">
            Transfer Requests{requests.length > 0 ? ` (${requests.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="detached">Detached Vehicles</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <div className="rounded-lg border border-border bg-card">
            {requestsLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plate</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Current Owner</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.request_id}>
                      <TableCell className="font-medium text-foreground">
                        {r.vehicle.plate_no}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {r.vehicle.make} {r.vehicle.model} ({r.vehicle.vehicle_type})
                        {r.vehicle.year ? ` — ${r.vehicle.year}` : ""}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {r.requester.full_name ?? "—"}
                        <div className="text-xs text-muted-foreground">{r.requester.email}</div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {r.current_owner ? (
                          <>
                            {r.current_owner.full_name ?? "—"}
                            <div className="text-xs text-muted-foreground">
                              {r.current_owner.email}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => openReview(r)}
                          className="text-xs font-medium text-accent hover:underline"
                        >
                          Review
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {requests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No pending transfer requests
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="detached" className="space-y-4">
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
                            <div className="text-xs text-muted-foreground">
                              {v.previous_owner.email}
                            </div>
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
        </TabsContent>
      </Tabs>

      <Dialog open={showDialog} onOpenChange={(open) => !transferring && setShowDialog(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Vehicle Ownership</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Works for any plate — currently active or already detached. Use this after verifying
              proof of sale/ownership in person.
            </p>
            {dialogError && (
              <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
                {dialogError}
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Plate Number</label>
              <PlateNumberInput
                value={transferPlate}
                onChange={setTransferPlate}
                error={!!dialogError}
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

      <Dialog
        open={!!reviewRequest}
        onOpenChange={(open) => {
          if (reviewing) return;
          if (!open) setReviewRequest(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Transfer Request</DialogTitle>
          </DialogHeader>
          {reviewRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Vehicle</p>
                  <p className="font-medium text-foreground">
                    {reviewRequest.vehicle.plate_no} — {reviewRequest.vehicle.make}{" "}
                    {reviewRequest.vehicle.model}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Submitted</p>
                  <p className="font-medium text-foreground">
                    {new Date(reviewRequest.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Requester</p>
                  <p className="font-medium text-foreground">
                    {reviewRequest.requester.full_name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">{reviewRequest.requester.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contact Phone</p>
                  <a
                    href={`tel:${reviewRequest.contact_phone}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {reviewRequest.contact_phone}
                  </a>
                </div>
                <div>
                  <p className="text-muted-foreground">Current Owner</p>
                  <p className="font-medium text-foreground">
                    {reviewRequest.current_owner?.full_name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {reviewRequest.current_owner?.email ?? "—"}
                  </p>
                </div>
              </div>

              {reviewError && (
                <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
                  {reviewError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Logbook Photo</p>
                  <DocumentImage
                    url={`${BASE}/api/admin/vehicles/transfer-requests/${reviewRequest.request_id}/documents/logbook`}
                    alt="Vehicle logbook"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">NIC Photo</p>
                  <DocumentImage
                    url={`${BASE}/api/admin/vehicles/transfer-requests/${reviewRequest.request_id}/documents/nic`}
                    alt="Requester NIC"
                  />
                </div>
              </div>

              {showRejectInput && (
                <Textarea
                  placeholder="Reason for rejection (optional, shown to the requester)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              )}
            </div>
          )}
          <DialogFooter>
            {!showRejectInput ? (
              <button
                onClick={() => setShowRejectInput(true)}
                disabled={reviewing}
                className="rounded-md border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
              >
                Reject
              </button>
            ) : (
              <button
                onClick={rejectRequest}
                disabled={reviewing}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {reviewing ? "Rejecting..." : "Confirm Reject"}
              </button>
            )}
            <button
              onClick={approveRequest}
              disabled={reviewing}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {reviewing ? "Approving..." : "Approve"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
