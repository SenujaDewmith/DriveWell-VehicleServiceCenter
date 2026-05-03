import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { ManagerOverview } from "@/components/manager/ManagerOverview";
import { SupervisorDashboard } from "@/components/supervisor/SupervisorDashboard";
import { CashierDashboard } from "@/components/cashier/CashierDashboard";
import { StaffDashboard } from "@/components/staff/StaffDashboard";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardIndex,
});

function DashboardIndex() {
  const { role } = useAuth();

  switch (role) {
    case "manager":
      return <ManagerOverview />;
    case "supervisor":
      return <SupervisorDashboard />;
    case "cashier":
      return <CashierDashboard />;
    case "staff":
      return <StaffDashboard />;
    default:
      return <Navigate to="/login" />;
  }
}
