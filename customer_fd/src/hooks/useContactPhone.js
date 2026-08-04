import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";

// Module-level cache: the number is the same for every caller in a session and rarely
// changes, so the five call sites (Footer, FAQ, Bookings, BookingDetails, Vehicles) share
// one fetch instead of each hitting the public /config/contact endpoint separately.
let cachedPhone;
let pendingFetch = null;

function fetchContactPhone() {
  if (!pendingFetch) {
    pendingFetch = apiClient
      .get("/config/contact")
      .then((data) => {
        cachedPhone = data.contact_phone ?? null;
        return cachedPhone;
      })
      .catch(() => {
        cachedPhone = null;
        return null;
      });
  }
  return pendingFetch;
}

// Returns the service center's contact phone number, or null while loading / if unset.
export function useContactPhone() {
  const [phone, setPhone] = useState(cachedPhone ?? null);

  useEffect(() => {
    if (cachedPhone !== undefined) return;
    let cancelled = false;
    fetchContactPhone().then((value) => {
      if (!cancelled) setPhone(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return phone;
}
