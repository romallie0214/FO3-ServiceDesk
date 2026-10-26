import { useEffect, useState } from 'react';
import { api } from '../services/api';

export interface DashboardTicket {
  id: number; ticket_number: string; subject: string; status: string;
  created_at: string; updated_at?: string; assigned_to?: string | number | null;
  requestor?: string | null; requestor_name?: string | null; office_location?: string | null;
  service_area_id?: number | null;
}
interface DashboardUser { id: number; deleted_at?: string | null; }
interface ServiceArea { id: number; code: string; name: string; is_active: number; }
interface DashboardData {
  tickets: DashboardTicket[]; users: DashboardUser[]; serviceAreas: ServiceArea[];
  csmCount: number | null; kbCount: number | null;
}
export function useAdminDashboard() {
  const [data, setData] = useState<DashboardData>({ tickets: [], users: [], serviceAreas: [], csmCount: null, kbCount: null });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const endpoints = ['/tickets', '/users', '/service-areas', '/csm', '/knowledge-base'];
    Promise.allSettled(endpoints.map(path => api.get(path))).then(results => {
      if (!active) return;
      const array = <T,>(index: number): T[] => {
        const result = results[index];
        return result.status === 'fulfilled' && Array.isArray(result.value.data) ? result.value.data : [];
      };
      setData({ tickets: array<DashboardTicket>(0), users: array<DashboardUser>(1), serviceAreas: array<ServiceArea>(2),
        csmCount: results[3].status === 'fulfilled' ? array(3).length : null,
        kbCount: results[4].status === 'fulfilled' ? array(4).length : null });
      setFailed(results.flatMap((r, i) => r.status === 'rejected' ? [endpoints[i]] : []));
      setLoading(false);
    });
    return () => { active = false; };
  }, [revision]);
  return { ...data, loading, failed, refresh: () => setRevision(value => value + 1) };
}
