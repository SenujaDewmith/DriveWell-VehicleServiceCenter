import { apiClient } from "@/lib/apiClient";
export const invoicesService = {
    getInvoices: () => apiClient.get("/invoices"),
    getInvoice: (id) => apiClient.get(`/invoices/${id}`),
};
