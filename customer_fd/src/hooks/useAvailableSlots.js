import { useEffect, useState } from "react";
import { bookingsService } from "@/services/bookings.service";
import { toast } from "sonner";
export function useAvailableSlots(selectedDate, packageId, vehicleId, excludeReservationId) {
    const [slots, setSlots] = useState([]);
    const [dateAvailable, setDateAvailable] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    useEffect(() => {
        if (!selectedDate || !packageId)
            return;
        setIsLoading(true);
        bookingsService
            .getAvailableSlots(selectedDate, packageId, vehicleId, excludeReservationId)
            .then((res) => {
            setDateAvailable(res.available);
            setSlots(res.slots);
            if (!res.available)
                toast.error(res.reason ?? "No availability on this date");
        })
            .catch(() => toast.error("Failed to check availability"))
            .finally(() => setIsLoading(false));
    }, [selectedDate, packageId, vehicleId, excludeReservationId]);
    return { slots, dateAvailable, isLoading };
}
