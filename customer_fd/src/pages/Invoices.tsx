import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { invoicesService } from "@/services/invoices.service";
import { FileText, Printer, Loader2 } from "lucide-react";

export default function Invoices() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  const invoicesQuery = useQuery({
    queryKey: ["invoices"],
    queryFn: () => invoicesService.getInvoices().then((r) => r.invoices),
    enabled: !!user,
  });
  const invoices = invoicesQuery.data ?? [];
  const loading = invoicesQuery.isPending;
  const error = invoicesQuery.isError ? "Failed to load invoices. Please try again later." : "";

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Invoices & Payments</h1>
        <p className="text-muted-foreground">View and manage your service invoices</p>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-cta" />
        </div>
      )}

      {!loading && error && (
        <Card className="text-center py-12 border-destructive/30">
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && invoices.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No invoices yet</h3>
            <p className="text-muted-foreground">Your invoices will appear here after service completion</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && invoices.length > 0 && (
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <Card key={invoice.invoice_id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="h-16 w-16 bg-cta/10 rounded-lg flex items-center justify-center shrink-0">
                      <FileText className="h-8 w-8 text-cta" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-xl font-semibold">
                            Invoice {invoice.booking_ref ?? `#${invoice.invoice_id}`}
                          </h3>
                          <p className="text-muted-foreground">
                            {invoice.make} {invoice.model} ({invoice.plate_no}) — {invoice.package_name}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            invoice.payment_status === "Paid"
                              ? "bg-status-completed/10 text-status-completed border-status-completed/20"
                              : "bg-status-booked/10 text-status-booked border-status-booked/20"
                          }
                        >
                          {invoice.payment_status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm mt-4">
                        <div>
                          <p className="text-muted-foreground">Service Date</p>
                          <p className="font-medium">{invoice.service_date}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payment Method</p>
                          <p className="font-medium">{invoice.payment_method ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Amount</p>
                          <p className="font-bold text-cta text-lg">LKR {parseFloat(invoice.total_amount).toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{invoice.package_name}</span>
                          <span className="font-medium">LKR {parseFloat(invoice.base_amount).toLocaleString()}</span>
                        </div>
                        {invoice.items.map((item) => (
                          <div key={item.invoice_item_id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {item.description}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                            </span>
                            <span className="font-medium">LKR {parseFloat(item.line_total).toLocaleString()}</span>
                          </div>
                        ))}
                        {parseFloat(invoice.discount) > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-cta">Discount</span>
                            <span className="font-medium text-cta">-LKR {parseFloat(invoice.discount).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
                          <span>Total</span>
                          <span className="text-cta">LKR {parseFloat(invoice.total_amount).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 lg:w-48">
                    <Button variant="outline" className="w-full" onClick={() => window.print()}>
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
