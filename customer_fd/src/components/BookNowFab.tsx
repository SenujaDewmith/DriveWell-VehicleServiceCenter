import { useLocation, useNavigate } from "react-router-dom";
import { Calendar } from "lucide-react";

// Pages where a floating "Book Now" would be redundant (already booking) or
// off-focus (auth forms) — hidden there rather than shown everywhere.
const HIDDEN_ON = ["/book", "/login", "/register"];

export function BookNowFab() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <span
        className="absolute inset-0 rounded-full bg-cta/50 animate-ping motion-reduce:animate-none"
        aria-hidden
      />
      <button
        type="button"
        onClick={() => navigate("/book")}
        className="relative flex items-center gap-2 rounded-full bg-cta text-cta-foreground px-5 py-3.5 font-semibold shadow-lg shadow-cta/30 transition-transform hover:scale-105 active:scale-95 animate-cta-pop motion-reduce:animate-none"
      >
        <Calendar className="h-5 w-5" />
        <span className="hidden sm:inline">Book Now</span>
      </button>
    </div>
  );
}
