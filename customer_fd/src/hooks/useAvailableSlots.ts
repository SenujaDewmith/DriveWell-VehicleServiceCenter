import { useEffect, useState } from "react";
import { bookingsService, type AvailableSlot } from "@/services/bookings.service";
import { toast } from "sonner";

export function useAvailableSlots(selectedDate: string, packageId: number | null) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [dateAvailable, setDateAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedDate || !packageId) return;
    setIsLoading(true);
    bookingsService
      .getAvailableSlots(selectedDate, packageId)
      .then((res) => {
        setDateAvailable(res.available);
        setSlots(res.slots);
        if (!res.available) toast.error(res.reason ?? "No availability on this date");
      })
      .catch(() => toast.error("Failed to check availability"))
      .finally(() => setIsLoading(false));
  }, [selectedDate, packageId]);

  return { slots, dateAvailable, isLoading };
}
