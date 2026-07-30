import { apiClient } from "@/lib/apiClient";
export const feedbackService = {
    getFeedback: () => apiClient.get("/feedback"),
    submitFeedback: (data) => apiClient.post("/feedback", data),
    // Public — no auth required, used on the landing page.
    getPublicTestimonials: () => apiClient.get("/feedback/public"),
};
