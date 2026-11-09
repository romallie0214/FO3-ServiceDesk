import { LoaderCircle } from 'lucide-react';
import { Shimmer } from '@shimmer-from-structure/react';
import type { ReactNode } from 'react';
import type { DashboardTicket } from '../../hooks/useAdminDashboard';
import './DashboardLoading.css';

// Only used while the real dashboard data is loading; never submitted to the API.
export const dashboardTemplateTickets: DashboardTicket[] = Array.from({ length: 5 }, (_, index) => ({
  id: -(index + 1), ticket_number: 'ICT-000000', subject: 'Service request subject',
  requestor_name: 'Employee name', office_location: 'Office location', status: 'Open',
  created_at: '2026-01-01T00:00:00+08:00',
}));

export default function DashboardLoading({ loading, children, initialPlaceholder = false, label = 'Loading dashboard...' }: { loading: boolean; children: ReactNode; empty?: boolean; initialPlaceholder?: boolean; label?: string }) {
  const showLoader = loading;
  if (initialPlaceholder && loading) return <div className="list-initial-loading" role="status" aria-live="polite"><LoaderCircle size={18} aria-hidden="true" /><span>{label}</span></div>;
  return <div className="dashboard-loading" aria-busy={showLoader}>
    {showLoader && <span className="dashboard-loading-status" role="status">{label}</span>}
    <div inert={showLoader}>
      <Shimmer loading={showLoader} backgroundColor="var(--dashboard-skeleton-base)" shimmerColor="var(--dashboard-skeleton-wave)">
        {children}
      </Shimmer>
    </div>
  </div>;
}