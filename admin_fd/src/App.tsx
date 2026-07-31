import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { Index } from "@/routes/index";
import { LoginPage } from "@/routes/login";
import { DashboardRoute } from "@/routes/dashboard";
import { DashboardIndex } from "@/routes/dashboard/index";
import { ActivityPage } from "@/routes/dashboard/activity";
import { BookingsPage } from "@/routes/dashboard/bookings";
import { ChargeCatalogPage } from "@/routes/dashboard/charge-catalog";
import { PackagesPage } from "@/routes/dashboard/packages";
import { PerformancePage } from "@/routes/dashboard/performance";
import { RevenuePage } from "@/routes/dashboard/revenue";
import { SchedulePage } from "@/routes/dashboard/schedule";
import { UsersPage } from "@/routes/dashboard/users";
import { VehicleCatalogPage } from "@/routes/dashboard/vehicle-catalog";
import { VehicleTransfersPage } from "@/routes/dashboard/vehicle-transfers";
import { VolumePage } from "@/routes/dashboard/volume";
import { NotFoundPage } from "@/routes/NotFound";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardRoute />}>
              <Route index element={<DashboardIndex />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="charge-catalog" element={<ChargeCatalogPage />} />
              <Route path="packages" element={<PackagesPage />} />
              <Route path="performance" element={<PerformancePage />} />
              <Route path="revenue" element={<RevenuePage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="vehicle-catalog" element={<VehicleCatalogPage />} />
              <Route path="vehicle-transfers" element={<VehicleTransfersPage />} />
              <Route path="volume" element={<VolumePage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
