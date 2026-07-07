import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockInvoices, mockVehicles, mockPackages } from "@/data/mockData";
import { FileText, Download, Printer, Eye, Car } from "lucide-react";
import { toast } from "sonner";

export default function Invoices() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  const handleDownload = (invoiceId: string) => {
    toast.success("Invoice downloaded successfully");
  };

  const handlePrint = (invoiceId: string) => {
    window.print();
    toast.success("Print dialog opened");
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Invoices & Payments</h1>
        <p className="text-muted-foreground">View and manage your service invoices</p>
      </div>

      {mockInvoices.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No invoices yet</h3>
            <p className="text-muted-foreground">Your invoices will appear here after service completion</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {mockInvoices.map((invoice) => {
            const vehicle = mockVehicles.find((v) => v.id === invoice.vehicleId);
            const pkg = mockPackages.find((p) => p.id === invoice.packageId);
            return (
              <Card key={invoice.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="h-16 w-16 bg-cta/10 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="h-8 w-8 text-cta" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-xl font-semibold">Invoice #{invoice.id}</h3>
                            <p className="text-muted-foreground">
                              {vehicle?.make} {vehicle?.model} - {pkg?.name}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              invoice.paid
                                ? "bg-status-completed/10 text-status-completed border-status-completed/20"
                                : "bg-status-booked/10 text-status-booked border-status-booked/20"
                            }
                          >
                            {invoice.paid ? "Paid" : "Unpaid"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm mt-4">
                          <div>
                            <p className="text-muted-foreground">Date</p>
                            <p className="font-medium">{invoice.date}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Booking ID</p>
                            <p className="font-medium">{invoice.bookingId}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Amount</p>
                            <p className="font-bold text-cta text-lg">${invoice.total}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 lg:w-48">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleDownload(invoice.id)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </Button>
                      <Button variant="outline" className="w-full" onClick={() => handlePrint(invoice.id)}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {mockInvoices.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Invoice Details Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {mockInvoices.map((invoice) => {
              const pkg = mockPackages.find((p) => p.id === invoice.packageId);
              return (
                <div key={invoice.id} className="border-b border-border last:border-0 py-4 first:pt-0">
                  <h3 className="font-semibold mb-3">Invoice #{invoice.id}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Base Package ({pkg?.name})</span>
                      <span className="font-medium">${invoice.baseAmount.toFixed(2)}</span>
                    </div>
                    {invoice.additionalCharges.map((charge, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{charge.item}</span>
                        <span className="font-medium">${charge.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    {invoice.discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-cta">Discount</span>
                        <span className="font-medium text-cta">-${invoice.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
                      <span>Total</span>
                      <span className="text-cta">${invoice.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
