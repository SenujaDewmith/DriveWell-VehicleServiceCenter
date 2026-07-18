import { apiClient } from "@/lib/apiClient";

export interface InvoiceItem {
  invoice_item_id: number;
  catalog_item_id: number | null;
  description: string;
  unit_price: string;
  quantity: number;
  line_total: string;
}

export interface Invoice {
  invoice_id: number;
  reservation_id: number;
  base_amount: string;
  additional_charges: string;
  discount: string;
  total_amount: string;
  payment_status: "Paid" | "Unpaid";
  payment_method: string | null;
  notes: string | null;
  generated_at: string;
  booking_ref: string | null;
  service_date: string | null;
  booking_status: string;
  make: string | null;
  model: string | null;
  vehicle_type: string | null;
  plate_no: string | null;
  package_name: string | null;
  items: InvoiceItem[];
}

export const invoicesService = {
  getInvoices: () => apiClient.get<{ invoices: Invoice[] }>("/invoices"),
  getInvoice: (id: number) => apiClient.get<{ invoice: Invoice }>(`/invoices/${id}`),
};
