import { apiClient } from "@/lib/apiClient";

export interface Invoice {
  id: string;
  bookingId: string;
  amount: number;
  discount: number;
  total: number;
  status: "unpaid" | "paid";
  issuedAt: string;
  paidAt?: string;
}

export const invoicesService = {
  getInvoices: () => apiClient.get<Invoice[]>("/invoices"),

  getInvoice: (id: string) => apiClient.get<Invoice>(`/invoices/${id}`),
};
