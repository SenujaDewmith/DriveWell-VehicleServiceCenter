import { apiClient } from "@/lib/apiClient";

export interface Feedback {
  feedback_id: number;
  reservation_id: number;
  customer_id: number;
  rating: number;
  comment: string | null;
  submitted_at: string;
  booking_ref: string;
  service_date: string;
  make: string | null;
  model: string | null;
  vehicle_type: string | null;
  plate_no: string | null;
  package_name: string;
  customer_name?: string;
}

export interface SubmitFeedbackPayload {
  reservation_id: number;
  rating: number;
  comment?: string;
}

export interface Testimonial {
  feedback_id: number;
  rating: number;
  comment: string;
  display_name: string;
}

export const feedbackService = {
  getFeedback: () => apiClient.get<{ feedback: Feedback[] }>("/feedback"),

  submitFeedback: (data: SubmitFeedbackPayload) =>
    apiClient.post<{ message: string }>("/feedback", data),

  // Public — no auth required, used on the landing page.
  getPublicTestimonials: () => apiClient.get<{ testimonials: Testimonial[] }>("/feedback/public"),
};