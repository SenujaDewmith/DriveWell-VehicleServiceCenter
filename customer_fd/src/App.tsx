import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import Landing from "./pages/Landing";
import About from "./pages/About";
import FAQ from "./pages/FAQ";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Vehicles from "./pages/Vehicles";
import VehicleServiceHistory from "./pages/VehicleServiceHistory";
import Services from "./pages/Services";
import BookService from "./pages/BookService";
import Bookings from "./pages/Bookings";
import BookingDetails from "./pages/BookingDetails";
import Invoices from "./pages/Invoices";
import Feedback from "./pages/Feedback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  // Wait for the session check to finish before deciding — otherwise a
  // logged-in user doing a hard refresh gets bounced to /login for a frame
  // while the cookie is still being verified against the backend.
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-cta" />
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
}

// Inverse of ProtectedRoute — keeps an already-authenticated user off /login
// and /register (e.g. hitting the URL directly or the back button after
// logging in) instead of showing them an auth form there's no reason to fill in.
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-cta" />
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

// Plain BrowserRouter (not the data-router API) doesn't reset scroll on navigation —
// without this, going from a scrolled-down list to a details page (or back) lands
// wherever the browser last left the viewport instead of the top of the new page.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Layout>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
                <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
                <Route path="/services" element={<Services />} />
                <Route path="/about" element={<About />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/vehicles" element={<ProtectedRoute><Vehicles /></ProtectedRoute>} />
                <Route path="/vehicles/:id/history" element={<ProtectedRoute><VehicleServiceHistory /></ProtectedRoute>} />
                {/* Not wrapped in ProtectedRoute — BookService gates itself with an inline
                    AuthModal so an unauthenticated visitor keeps their in-progress selection
                    (e.g. ?package=) instead of being redirected away to /login. */}
                <Route path="/book" element={<BookService />} />
                <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
                <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetails /></ProtectedRoute>} />
                <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
                <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
