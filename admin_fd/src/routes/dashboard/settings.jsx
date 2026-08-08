import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PhoneNumberInput } from "@/components/ui/phone-number-input";
import { isValidSriLankanPhone } from "@/lib/phoneNumber";

export function SettingsPage() {
  const [contactPhone, setContactPhone] = useState("");
  const [savedContactPhone, setSavedContactPhone] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState("");
  const [contactSuccess, setContactSuccess] = useState("");

  useEffect(() => {
    api
      .get("/api/config")
      .then(({ config }) => {
        setContactPhone(config.contact_phone ?? "");
        setSavedContactPhone(config.contact_phone ?? "");
      })
      .catch(() => {});
  }, []);

  const saveContactPhone = async () => {
    if (!isValidSriLankanPhone(contactPhone)) {
      setContactError("Enter a valid 9-digit number after +94");
      return;
    }
    setSavingContact(true);
    setContactError("");
    setContactSuccess("");
    try {
      await api.put("/api/config/contact", { contact_phone: contactPhone.trim() });
      setSavedContactPhone(contactPhone.trim());
      setContactSuccess("Contact phone saved.");
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Business Settings</h1>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Contact Information</h3>
          <button
            onClick={saveContactPhone}
            disabled={savingContact || contactPhone.trim() === savedContactPhone}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {savingContact ? "Saving..." : "Save Changes"}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Shown to customers on the public site and wherever they hit a self-service dead end
          (e.g. a booking too close to its appointment time to cancel online).
        </p>
        {contactError && <p className="text-sm text-destructive">{contactError}</p>}
        {contactSuccess && <p className="text-sm text-accent">{contactSuccess}</p>}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-muted-foreground">Support Phone Number</label>
          <div className="w-full sm:w-64">
            <PhoneNumberInput value={contactPhone} onChange={setContactPhone} />
          </div>
        </div>
      </div>
    </div>
  );
}
