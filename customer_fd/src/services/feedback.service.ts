import { apiClient } from "@/lib/apiClient";

export interface Feedback {
  id: string;
  bookingId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface CreateFeedbackPayload {
  bookingId: string;
  rating: number;
  comment: string;
}

export const feedbackService = {
  getFeedback: () => apiClient.get<Feedback[]>("/feedback"),

  submitFeedback: (data: CreateFeedbackPayload) =>
    apiClient.post<Feedback>("/feedback", data),
};
