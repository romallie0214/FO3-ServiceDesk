import { useAuth } from '../context/AuthContext';
//import SupervisorDashboard from './SupervisorDashboard';
import StaffDashboard from './StaffDashboard';
import IctmsDashboard from './IctmsDashboard';
import SuperAdminDashboard from './SuperAdminDashboard';

export default function Dashboard() {
  const { user } = useAuth();

  // if (user?.role === 'supervisor')  return <SupervisorDashboard />;
  if ((user?.area_admin_service_ids?.length ?? 0) > 0) return <SuperAdminDashboard />;
  if (user?.role === 'dswd_staff')  return <StaffDashboard />;
  if (user?.role === 'ictms_staff') return <IctmsDashboard />;
  if (user?.role === 'super_admin') return <SuperAdminDashboard />;

  return <IctmsDashboard />; // fallback
}
