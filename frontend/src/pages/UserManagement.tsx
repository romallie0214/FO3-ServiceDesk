import Pagination from '../components/Pagination';
import { showErrorToast } from '../utils/notifications';
import AppTable from '../components/AppTable';
import { Search, SlidersHorizontal, ChevronDown, Users, ShieldCheck, Plus, UserCheck, Wrench, Pencil, UserRoundX, RotateCcw, LockKeyhole, LockKeyholeOpen, ShieldOff } from 'lucide-react';
import './UserManagement.css';

import SummaryCards from '../components/dashboard/SummaryCards';

import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

type UserRole = 'super_admin' | 'supervisor' | 'ictms_staff' | 'dswd_staff';


interface RecoveryAccount {
  empno: string;
  full_name: string;
  email: string;
  role?: UserRole;
  division?: string;
  harmonyAvailable: boolean;
  deactivated: boolean;
  locked: boolean;
  lockedUntil: string | null;
  lockReason: string | null;
}

type RecoveryAction = 'lock' | 'unlock' | 'reset_mfa';

interface User {
  id: number;
  empno: string;
  full_name: string;
  email: string;
  role: UserRole;
  division: string;
  unit: string;
  deleted_at: string | null;
  service_assignments?: string | null;
}

interface ServiceArea { id: number; code: string; name: string; is_active: number; }
type ServiceAreaRole = 'admin' | 'supervisor' | 'technical_staff';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'super_admin',  label: 'FO3 Super Admin' },
  { value: 'dswd_staff',   label: 'FO3 User' },
];

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  super_admin:  { bg: '#EEEDFE', color: '#3C3489' },
  supervisor:   { bg: '#E8F1FA', color: '#0D3B6E' },
  ictms_staff:  { bg: '#E8F5EE', color: '#1B6B3A' },
  dswd_staff:   { bg: '#FEF3DC', color: '#CC7700' },
};

const SERVICE_ROLE_CARDS = [
  { value: 'admin',            label: 'Area Admin',       color: '#3C3489' },
  { value: 'supervisor',       label: 'Supervisor',       color: '#0D3B6E' },
  { value: 'technical_staff',  label: 'Technical Staff',  color: '#1B6B3A' },
];

const inputStyle: React.CSSProperties = {
  padding: 'clamp(5px, 1.5vw, 7px) clamp(8px, 1.5vw, 10px)',
  border: '1px solid #C8D0DC',
  borderRadius: 4,
  fontSize: 'clamp(10px, 1.8vw, 12px)',
  width: '100%',
  background: '#fff',
  color: '#2A2A2A',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'clamp(8px, 1.5vw, 10px)',
  fontWeight: 500,
  color: '#5A6475',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  display: 'block',
  marginBottom: 4,
};

const EMPTY_FORM = {
  empno: '',
  full_name: '',
  email: '',
  role: 'dswd_staff' as UserRole,
  division: '',
  unit: '',
};
interface OLPickerProps {
  all:      { code: number; name: string }[];
  selected: { code: number; name: string }[];
  loading:  boolean;
  search:   string;
  onSearchChange: (v: string) => void;
  onToggle: (loc: { code: number; name: string }) => void;
}

function OfficeLocationPicker({ all, selected, loading, search, onSearchChange, onToggle }: OLPickerProps) {
  if (loading) return (
    <div style={{
      fontSize: 'clamp(9px, 1.8vw, 11px)',
      color: '#888',
      padding: '8px 0',
    }}>
      Loading office locations...
    </div>
  );

  const filtered = all.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <input
        placeholder="Search office location..."
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        style={{
          padding: 'clamp(5px, 1.5vw, 6px) clamp(8px, 1.5vw, 10px)',
          border: '1px solid #C8D0DC',
          borderRadius: 4,
          fontSize: 'clamp(10px, 1.8vw, 12px)',
          width: '100%',
          marginBottom: 6,
          boxSizing: 'border-box',
        }}
      />

      {/* Checklist */}
      <div style={{
        border: '1px solid #C8D0DC',
        borderRadius: 4,
        maxHeight: 150,
        overflowY: 'auto',
        background: '#fff',
      }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: 12,
            fontSize: 'clamp(9px, 1.8vw, 11px)',
            color: '#aaa',
            textAlign: 'center',
          }}>
            No results found.
          </div>
        ) : filtered.map(loc => {
          const checked = selected.some(s => s.code === loc.code);
          return (
            <label key={loc.code} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 'clamp(4px, 1.5vw, 6px) clamp(8px, 1.5vw, 10px)',
              cursor: 'pointer',
              fontSize: 'clamp(10px, 1.8vw, 12px)',
              borderBottom: '0.5px solid #EEF1F5',
              background: checked ? '#E8F5EE' : '#fff',
            }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(loc)}
              />
              <span style={{ color: checked ? '#1B6B3A' : '#1A2A3A' }}>
                {loc.name}
              </span>
              {checked && (
                <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: '#1B6B3A', fontWeight: 600 }}>✓</span>
              )}
            </label>
          );
        })}
      </div>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {selected.map(loc => (
            <span key={loc.code} style={{
              fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 3,
              background: '#E8F5EE', color: '#1B6B3A',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {loc.name}
              <button onClick={() => onToggle(loc)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#8B1A1A', fontSize: 'var(--text-base)', padding: 0, lineHeight: 1,
              }}>×</button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
export default function UserManagement() {
  const filtersRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismissFilters(event: PointerEvent) {
      if (filtersRef.current?.open && event.target instanceof Node && !filtersRef.current.contains(event.target)) filtersRef.current.open = false;
    }
    function handleFilterEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && filtersRef.current?.open) {
        filtersRef.current.open = false;
        filtersRef.current.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', dismissFilters);
    document.addEventListener('keydown', handleFilterEscape);
    return () => { document.removeEventListener('pointerdown', dismissFilters); document.removeEventListener('keydown', handleFilterEscape); };
  }, []);

  const { user: currentUser, token } = useAuth();
  const isFO3SuperAdmin = currentUser?.role === 'super_admin';
  const managedAreaIds = currentUser?.role === 'super_admin' ? null : (currentUser?.area_admin_service_ids || []);
  const isServiceAdmin = managedAreaIds !== null && managedAreaIds.length > 0;
  const [users, setUsers] = useState<User[]>([]);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [serviceAreaFilter, setServiceAreaFilter] = useState('');
  const [recoverySearch, setRecoverySearch] = useState('');
  const [recoveryRoleFilter, setRecoveryRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [recoveryAccounts, setRecoveryAccounts] = useState<RecoveryAccount[]>([]);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'recovery'>('users');
  const [toast, setToast] = useState({ msg: '', type: '' });

  // Modal state
  const [showModal, setShowModal]   = useState(false);
  const [editUser, setEditUser]     = useState<User | null>(null);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [saving, setSaving]         = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [resettingEmpno, setResettingEmpno] = useState<string | null>(null);
  const [unlockingEmpno, setUnlockingEmpno] = useState<string | null>(null);
  const [lockingEmpno, setLockingEmpno] = useState<string | null>(null);
  const [recoveryTarget, setRecoveryTarget] = useState<{ action: RecoveryAction; user: Pick<User, 'empno' | 'full_name'> } | null>(null);

  // ERM wizard state (Add User only)
  interface Division  { division_code: string; division_name: string; }
  interface UnitItem  { unit_code: string;     unit_name: string;     }
  interface ErmEmployee { empno: string; full_name: string; email: string; position_classification_id: string | null; }
  interface OfficeLocation { code: number; name: string; }

  const [divisions, setDivisions]         = useState<Division[]>([]);
  const [units, setUnits]                 = useState<UnitItem[]>([]);
  const [employees, setEmployees]         = useState<ErmEmployee[]>([]);
  const [selDivision, setSelDivision]     = useState<Division | null>(null);
  const [selUnit, setSelUnit]             = useState<UnitItem | null>(null);
  const [selEmployee, setSelEmployee]     = useState<ErmEmployee | null>(null);
  const [empSearch, setEmpSearch]         = useState('');
  const [loadingDivs, setLoadingDivs]     = useState(false);
  const [loadingUnits, setLoadingUnits]   = useState(false);
  const [loadingEmps, setLoadingEmps]     = useState(false);
  const [wizardRole, setWizardRole]       = useState<UserRole>('dswd_staff');

  const [allOfficeLocations, setAllOfficeLocations] = useState<OfficeLocation[]>([]);
  const [selectedLocations,  setSelectedLocations]  = useState<OfficeLocation[]>([]);
  const [loadingLocs,        setLoadingLocs]         = useState(false);
  const [locSearch,          setLocSearch]           = useState('');
  const [userLocations,      setUserLocations]       = useState<Record<string, OfficeLocation[]>>({});
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [serviceAccess, setServiceAccess] = useState<Record<number, ServiceAreaRole | ''>>({});
  const [serviceAccessLoading, setServiceAccessLoading] = useState(false);

  useEffect(() => { fetchUsers(); }, [showDeactivated]);

  useEffect(() => {
    if (!isFO3SuperAdmin) return;
    api.get('/service-areas')
      .then(res => setServiceAreas(res.data.filter((area: ServiceArea) => Boolean(area.is_active))))
      .catch(() => {});
  }, [isFO3SuperAdmin]);

  useEffect(() => {
    if (activeTab !== 'recovery') return;
    setRecoveryLoading(true);
    api.get('/users/admin/account-recovery', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setRecoveryAccounts(res.data))
    .catch((err: any) => {
      setRecoveryAccounts([]);
      showToast(err.response?.data?.error || 'Unable to load account recovery records.', 'error');
    })
      .finally(() => setRecoveryLoading(false));
  }, [activeTab, token]);

  async function fetchUsers() {
    try {
      const res = await api.get('/users', {
        params: showDeactivated ? { include_deleted: '1' } : {},
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);

      // Fetch office locations for each user
      const locMap: Record<string, OfficeLocation[]> = {};
      await Promise.all(
        res.data.map(async (u: User) => {
          if (!u.empno) return;
          try {
            const locRes = await api.get(`/users/empno/${u.empno}/office-locations`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            locMap[u.empno] = locRes.data;
          } catch { locMap[u.empno] = []; }
        })
      );
      setUserLocations(locMap);
    } catch (err) {
      showToast('Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 3000);
  }

 async function openCreate() {
  setEditUser(null);
  setForm({ ...EMPTY_FORM });
  setSelDivision(null);
  setSelUnit(null);
  setSelEmployee(null);
  setEmpSearch('');
  setWizardRole('dswd_staff');
  setUnits([]);
  setEmployees([]);
  setSelectedLocations([]);
  setLocSearch('');
  setServiceAccess({});
  setServiceAccessLoading(true);
  setLoadingDivs(true);
  setLoadingLocs(true);
  setShowModal(true);   // ✅ open modal immediately so user sees it loading

  // ✅ allSettled — one failure won't kill the other
  const [divRes, locRes] = await Promise.allSettled([
    api.get('/users/erm/divisions'),
    api.get('/users/erm/all-office-locations'),
  ]);

  setDivisions(
    divRes.status === 'fulfilled' ? divRes.value.data : []
  );
  setAllOfficeLocations(
    locRes.status === 'fulfilled' ? locRes.value.data : []
  );
  try {
    const areasRes = await api.get('/service-areas');
    setServiceAreas(areasRes.data.filter((area: ServiceArea) => area.is_active && (!managedAreaIds || managedAreaIds.includes(area.id))));
  } catch {
    setServiceAreas([]);
  } finally {
    setServiceAccessLoading(false);
  }

  setLoadingDivs(false);
  setLoadingLocs(false);
}

  async function openEdit(u: User) {
    setEditUser(u);
    setForm({
      empno:     u.empno     ?? '',
      full_name: u.full_name ?? '',
      email:     u.email     ?? '',
      role:      u.role,
      division:  u.division  ?? '',
      unit:      u.unit      ?? '',
    });
    setSelectedLocations([]);
    setLocSearch('');
    setShowModal(true);
    setServiceAccessLoading(true);

    // ✅ Load all locations + already assigned
    setLoadingLocs(true);
    try {
      const [allRes, assignedRes] = await Promise.all([
        api.get('/users/erm/all-office-locations'),
        api.get(`/users/empno/${u.empno}/office-locations`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setAllOfficeLocations(allRes.data);
      setSelectedLocations(assignedRes.data);
    } catch {
      setAllOfficeLocations([]);
      setSelectedLocations([]);
    } finally {
      setLoadingLocs(false);
    }

    try {
      const areasRes = await api.get('/service-areas');
      const activeAreas = areasRes.data.filter((area: ServiceArea) => area.is_active && (!managedAreaIds || managedAreaIds.includes(area.id)));
      setServiceAreas(activeAreas);
      const access: Record<number, ServiceAreaRole | ''> = {};
      await Promise.all(activeAreas.map(async (area: ServiceArea) => {
        const staffRes = await api.get(`/service-areas/${area.id}/staff`);
        const assignment = staffRes.data.find((item: any) => item.user_id === u.id);
        access[area.id] = assignment?.service_role || '';
      }));
      setServiceAccess(access);
    } catch {
      setServiceAreas([]);
      setServiceAccess({});
    } finally {
      setServiceAccessLoading(false);
    }
  }

  async function updateServiceAccess(areaId: number, role: ServiceAreaRole | '') {
    if (!editUser) return;
    try {
      const currentAreaIds = Object.entries(serviceAccess)
        .filter(([, currentRole]) => Boolean(currentRole))
        .map(([currentAreaId]) => Number(currentAreaId));
      await Promise.all(currentAreaIds
        .filter(currentAreaId => currentAreaId !== areaId || !role)
        .map(currentAreaId => api.delete(`/service-areas/${currentAreaId}/staff/${editUser.id}`)));
      if (role) await api.put(`/service-areas/${areaId}/staff/${editUser.id}`, { service_role: role });
      setServiceAccess(role ? { [areaId]: role } : {});
      showToast(role ? 'Service access updated.' : 'Service access removed.');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Unable to update service access.', 'error');
    }
  }

  const selectedServiceAreaId = Object.entries(serviceAccess).find(([, role]) => Boolean(role))?.[0] || '';
  const selectedServiceRole = selectedServiceAreaId ? serviceAccess[Number(selectedServiceAreaId)] || '' : '';

  function setNewUserServiceArea(areaId: string) {
    if (!areaId) { setServiceAccess({}); return; }
    setServiceAccess({ [Number(areaId)]: selectedServiceRole || 'technical_staff' });
  }

  function setNewUserServiceRole(role: ServiceAreaRole | '') {
    if (!selectedServiceAreaId) return;
    setServiceAccess(role ? { [Number(selectedServiceAreaId)]: role } : {});
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (editUser) {
      if (!form.role) { showErrorToast('Role is required.'); return; }
      setSaving(true);
      try {
        await api.put(`/users/${editUser.id}`, form);

        // ✅ Save office locations
        await api.post(`/users/empno/${editUser.empno}/office-locations`, {
          locations: selectedLocations,
        }, { headers: { Authorization: `Bearer ${token}` } });

        showToast(`${editUser.full_name} updated successfully.`);
        setShowModal(false);
        fetchUsers();
      } catch (err: any) {
        showErrorToast(err.response?.data?.error || 'Failed to save user.');
      } finally { setSaving(false); }

    } else {
      if (!selEmployee) { showErrorToast('Please select an employee.'); return; }
      setSaving(true);
      try {
        const createdUser = await api.post('/users', {
          empno:     selEmployee.empno,
          full_name: selEmployee.full_name,
          email:     selEmployee.email,
          role:      wizardRole,
          division:  selDivision?.division_name ?? '',
          unit:      selUnit?.unit_name ?? '',
          ...(managedAreaIds ? { service_area_id: managedAreaIds[0] } : {}),
        });

        // ✅ Save office locations for new user
        await Promise.all(
          Object.entries(serviceAccess)
            .filter(([, role]) => Boolean(role))
            .map(([areaId, role]) => api.put(`/service-areas/${areaId}/staff/${createdUser.data.id}`, { service_role: role }))
        );

        await api.post(`/users/empno/${selEmployee.empno}/office-locations`, {
          locations: selectedLocations,
        }, { headers: { Authorization: `Bearer ${token}` } });

        showToast(`${selEmployee.full_name} added successfully.`);
        setShowModal(false);
        fetchUsers();
      } catch (err: any) {
        showErrorToast(err.response?.data?.error || 'Failed to add user.');
      } finally { setSaving(false); }
    }
  }

  async function handleDivisionSelect(div: { division_code: string; division_name: string }) {
    setSelDivision(div);
    setSelUnit(null);
    setSelEmployee(null);
    setEmployees([]);
    setEmpSearch('');
    setLoadingUnits(true);
    try {
      const res = await api.get(`/users/erm/units/${div.division_code}`);
      setUnits(res.data);
    } catch { setUnits([]); }
    finally { setLoadingUnits(false); }
  }

  async function handleUnitSelect(unit: { unit_code: string; unit_name: string }) {
    setSelUnit(unit);
    setSelEmployee(null);
    setEmpSearch('');
    setLoadingEmps(true);
    try {
      const res = await api.get('/users/erm/employees', {
        params: {
          division_code: selDivision?.division_code,
          unit_code: unit.unit_code,
          unit_name: unit.unit_name,
        },
      });
      setEmployees(res.data);
    } catch { setEmployees([]); }
    finally { setLoadingEmps(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await api.delete('/users/' + deleteTarget.id);
      showToast(deleteTarget.full_name + ' deactivated.' + (response.data.activeTicketCount ? ' Reassign ' + response.data.activeTicketCount + ' active ticket(s).' : ''));
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: any) {
      showErrorToast(err.response?.data?.error || 'Failed to deactivate user.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleRestore(target: User) {
    if (!window.confirm('Restore access for ' + target.full_name + '?')) return;
    try {
      await api.patch('/users/' + target.id + '/restore');
      showToast(target.full_name + ' restored. They can sign in again.');
      fetchUsers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Unable to restore user.', 'error');
    }
  }

  async function handleResetMfa(target: Pick<User, 'empno' | 'full_name'>) {
    setResettingEmpno(target.empno);
    try {
      await api.post(`/users/admin/reset-mfa/${encodeURIComponent(target.empno)}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showToast(`MFA reset for ${target.full_name}. They must enroll again at next login.`);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Unable to reset MFA.', 'error');
    } finally {
      setResettingEmpno(null);
    }
  }

  async function handleUnlockAccount(target: Pick<User, 'empno' | 'full_name'>) {
    setUnlockingEmpno(target.empno);
    try {
      await api.post(`/users/admin/unlock-account/${encodeURIComponent(target.empno)}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showToast(`ICTMS login lockout cleared for ${target.full_name}.`);
      setRecoveryAccounts(current => current.map(account => account.empno === target.empno
        ? { ...account, locked: false, lockedUntil: null, lockReason: null }
        : account));
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Unable to unlock the account.', 'error');
    } finally {
      setUnlockingEmpno(null);
    }
  }

  async function handleLockAccount(target: Pick<User, 'empno' | 'full_name'>) {
    setLockingEmpno(target.empno);
    try {
      await api.post(`/users/admin/lock-account/${encodeURIComponent(target.empno)}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showToast(`ICTMS account locked for ${target.full_name}.`);
      setRecoveryAccounts(current => current.map(account => account.empno === target.empno
        ? { ...account, locked: true, lockedUntil: null, lockReason: 'Locked by administrator' }
        : account));
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Unable to lock the account.', 'error');
    } finally {
      setLockingEmpno(null);
    }
  }

  async function confirmRecoveryAction() {
    if (!recoveryTarget) return;
    if (recoveryTarget.action === 'lock') await handleLockAccount(recoveryTarget.user);
    else if (recoveryTarget.action === 'unlock') await handleUnlockAccount(recoveryTarget.user);
    else await handleResetMfa(recoveryTarget.user);
    setRecoveryTarget(null);
  }

  function getInitials(name: string) {
    return name?.split(' ')
      .filter(w => w.length > 0)
      .map(w => w[0].toUpperCase())
      .join('')
      .slice(0, 2) ?? '??';
  }

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.division.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || (isServiceAdmin
      ? (u.service_assignments || '').split(';;').some(assignment => assignment.endsWith(`|${roleFilter}`))
      : u.role === roleFilter);
    const matchServiceArea = !serviceAreaFilter || (u.service_assignments || '').split(';;')
      .some(assignment => assignment.startsWith(`${serviceAreaFilter}|`));
    return matchSearch && matchRole && matchServiceArea;
  });

  const filteredRecoveryAccounts = recoveryAccounts.filter(account => {
    const matchSearch = !recoverySearch || [account.full_name, account.email, account.division, account.empno]
      .filter(Boolean).some(value => String(value).toLowerCase().includes(recoverySearch.toLowerCase()));
    const matchRole = !recoveryRoleFilter || account.role === recoveryRoleFilter;
    return matchSearch && matchRole;
  });

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, serviceAreaFilter, showDeactivated, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedUsers = filtered.slice(pageStart, pageStart + pageSize);

  const roleCounts = isServiceAdmin
    ? SERVICE_ROLE_CARDS.map(role => ({
      ...role,
      count: users.filter(u => !u.deleted_at && (u.service_assignments || '').split(';;').some(assignment => assignment.endsWith(`|${role.value}`))).length,
    }))
    : ROLES.map(role => ({
      ...role,
      color: ROLE_COLORS[role.value].color,
      count: users.filter(u => u.role === role.value && !u.deleted_at).length,
    }));

  if (loading) return (
    <div style={{ color: 'var(--gov-navy)', padding: 40, textAlign: 'center' }}>
      Loading users...
    </div>
  );

  return (
    <div className="user-management-page">
      {/* BREADCRUMB */}
      <div style={{
        fontSize: 'clamp(9px, 1.8vw, 11px)',
        color: '#4A4A4A',
        marginBottom: 14,
      }}>
        Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>
          / User Management
        </span>
      </div>

      <div className="user-management-tabs" role="group" aria-label="User management sections">
        <button aria-pressed={activeTab === 'users'} onClick={() => setActiveTab('users')}><Users size={15} />Users &amp; Access</button>
        <button aria-pressed={activeTab === 'recovery'} onClick={() => setActiveTab('recovery')}><ShieldCheck size={15} />Account Recovery</button>
      </div>

      {activeTab === 'recovery' && (
        <div style={{ background: '#fff', border: '0.5px solid #D0D9E4', borderRadius: 8, padding: 18 }}>
          <div style={{ background: '#FEF3DC', borderLeft: '3px solid #CC7700', padding: '10px 12px', marginBottom: 16, fontSize: 'var(--text-sm)', color: '#5A4200', lineHeight: 1.5 }}>
            Use these actions only after verifying the user’s identity. <strong>Lock Account</strong> blocks ICTMS login until an administrator unlocks it. <strong>Unlock Account</strong> clears any ICTMS lockout; neither action changes an HR/Harmony password. <strong>Reset MFA</strong> removes all MFA factors and signs the user out.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14, padding: 10, border: '1px solid #D5DFEA', borderRadius: 6, background: '#F8FAFD' }}>
            <input value={recoverySearch} onChange={e => setRecoverySearch(e.target.value)} placeholder="Search name, email, division..." style={{ flex: '1 1 320px', minWidth: 200, padding: '8px 10px', border: '1px solid #C8D0DC', borderRadius: 4, background: '#fff' }} />
            <select value={recoveryRoleFilter} onChange={e => setRecoveryRoleFilter(e.target.value)} style={{ minWidth: 140, padding: '8px 10px', border: '1px solid #C8D0DC', borderRadius: 4, background: '#fff' }}>
              <option value="">All Roles</option>
              {ROLES.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
            {(recoverySearch || recoveryRoleFilter) && <button type="button" onClick={() => { setRecoverySearch(''); setRecoveryRoleFilter(''); }} style={{ padding: '8px 12px', border: '1px solid #C8D0DC', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#4A4A4A' }}>Clear</button>}
            <span style={{ color: '#62748A', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>{filteredRecoveryAccounts.length} account{filteredRecoveryAccounts.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <AppTable className="user-management-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr>{['User', 'Employee No.', 'Account status', 'Profile status', 'Recovery actions'].map(h => <th key={h} style={{ textAlign: 'left', padding: '9px 10px', background: 'var(--gov-navy)', color: '#fff', fontSize: 'var(--text-xs)' }}>{h}</th>)}</tr></thead>
              <tbody>{recoveryLoading ? <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center' }}>Loading account recovery records...</td></tr> : filteredRecoveryAccounts.length === 0 ? <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#667' }}>No accounts match the selected filters.</td></tr> : filteredRecoveryAccounts.map(u => <tr key={u.empno} style={{ borderBottom: '1px solid #EEF1F5' }}>
                <td style={{ padding: '10px' }}><strong>{u.full_name}</strong><br /><span style={{ fontSize: 'var(--text-xs)', color: '#667' }}>{u.email}</span></td>
                <td style={{ padding: '10px', fontSize: 'var(--text-sm)' }}>{u.empno}</td>
                <td style={{ padding: '10px', fontSize: 'var(--text-sm)' }}><span title={u.lockReason || undefined} style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 12, background: u.deactivated ? '#F0F0F0' : u.locked ? '#FDE8E8' : '#E8F5EE', color: u.deactivated ? '#666' : u.locked ? '#8B1A1A' : '#1B6B3A', fontWeight: 600 }}>{u.deactivated ? 'Deactivated' : u.locked ? 'Locked' : 'Active'}</span></td>
                <td style={{ padding: '10px', fontSize: 'var(--text-sm)' }}>{u.harmonyAvailable ? 'Local profile linked' : 'Tracking record only'}</td>
                <td style={{ padding: '10px', display: 'flex', gap: 8 }}>
                  {u.deactivated ? <span style={{ color: '#667', fontSize: 'var(--text-xs)' }}>Restore in Users & Access</span> : u.empno === currentUser?.empno ? <span style={{ color: '#667', fontSize: 'var(--text-xs)', fontStyle: 'italic' }}>Self-recovery actions are not allowed</span> : <>
                    {u.locked ? <button onClick={() => setRecoveryTarget({ action: 'unlock', user: u })} disabled={unlockingEmpno === u.empno} style={{ padding: '5px 10px', border: '1px solid #9AC9AA', background: '#E8F5EE', color: '#1B6B3A', borderRadius: 4, cursor: 'pointer' }}>{unlockingEmpno === u.empno ? 'Unlocking…' : <><LockKeyholeOpen size={13} />Unlock Account</>}</button> : <button onClick={() => setRecoveryTarget({ action: 'lock', user: u })} disabled={lockingEmpno === u.empno} style={{ padding: '5px 10px', border: '1px solid #E8C887', background: '#FEF3DC', color: '#8A5200', borderRadius: 4, cursor: 'pointer' }}>{lockingEmpno === u.empno ? 'Locking…' : <><LockKeyhole size={13} />Lock Account</>}</button>}
                    <button onClick={() => setRecoveryTarget({ action: 'reset_mfa', user: u })} disabled={resettingEmpno === u.empno} style={{ padding: '5px 10px', border: '1px solid #E4B4B4', background: '#FDE8E8', color: '#8B1A1A', borderRadius: 4, cursor: 'pointer' }}>{resettingEmpno === u.empno ? 'Resetting…' : <><ShieldOff size={13} />Reset MFA</>}</button>
                  </>}
                </td>
              </tr>)}</tbody>
            </AppTable>
          </div>
        </div>
      )}

      {activeTab === 'users' && <>
      {/* INFO STRIP */}
      <div style={{
        background: '#E8F1FA',
        borderLeft: '3px solid var(--gov-navy)',
        borderRadius: '0 4px 4px 0',
        padding: 'clamp(8px, 2vw, 12px)',
        fontSize: 'clamp(9px, 1.8vw, 12px)',
        color: 'var(--gov-navy)',
        marginBottom: 14,
        lineHeight: 1.5,
      }}>
        {isServiceAdmin ? 'Manage users and service roles assigned to your service area.' : 'Manage system users, roles, and access levels.'}
        {!isServiceAdmin && <> Only <strong>Super Admins</strong> can create, edit, or remove users.</>}
      </div>

      <SummaryCards cards={roleCounts.map(role => {
        const palette = isServiceAdmin ? { bg: role.color + '14', color: role.color } : ROLE_COLORS[role.value];
        const icon = ['super_admin', 'admin'].includes(role.value) ? ShieldCheck : role.value === 'supervisor' ? UserCheck : ['ictms_staff', 'technical_staff'].includes(role.value) ? Wrench : Users;
        return {
          label: role.label, value: role.count, color: palette.color, background: palette.bg, icon,
          active: roleFilter === role.value,
          onClick: () => setRoleFilter(roleFilter === role.value ? '' : role.value),
        };
      })} />

      {/* FILTER + ADD */}
      <div className="user-management-toolbar" style={{
        background: '#fff',
        border: '0.5px solid #D0D9E4',
        borderRadius: 8,
        padding: 'clamp(8px, 2vw, 12px)',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(6px, 1.5vw, 10px)',
        flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="Search name, email, division..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 auto',
            minWidth: 'clamp(150px, 50vw, 300px)',
            padding: 'clamp(5px, 1.5vw, 8px) clamp(6px, 1.5vw, 9px)',
            fontSize: 'clamp(10px, 1.8vw, 12px)',
            border: '1px solid #C8D0DC',
            borderRadius: 4,
          }}
        />
        <details ref={filtersRef} className="user-management-filters"><summary><SlidersHorizontal size={14} />User Filters<ChevronDown size={14} /></summary><div className="user-management-filter-menu">
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{
            padding: 'clamp(5px, 1.5vw, 8px) clamp(6px, 1.5vw, 9px)',
            fontSize: 'clamp(10px, 1.8vw, 12px)',
            border: '1px solid #C8D0DC',
            borderRadius: 4,
            flex: '0 1 auto',
            minWidth: '140px',
          }}
        >
          <option value="">{isServiceAdmin ? 'All Service Roles' : 'All Roles'}</option>
          {(isServiceAdmin ? SERVICE_ROLE_CARDS : ROLES).map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        {isFO3SuperAdmin && (
          <select
            value={serviceAreaFilter}
            onChange={e => setServiceAreaFilter(e.target.value)}
            style={{
              padding: 'clamp(5px, 1.5vw, 8px) clamp(6px, 1.5vw, 9px)',
              fontSize: 'clamp(10px, 1.8vw, 12px)', border: '1px solid #C8D0DC',
              borderRadius: 4, minWidth: '190px', background: '#fff',
            }}
          >
            <option value="">All Service Areas</option>
            {serviceAreas.map(area => <option key={area.id} value={area.code}>{area.code} — {area.name}</option>)}
          </select>
        )}
        </div></details>
        <span style={{
          fontSize: 'clamp(9px, 1.8vw, 11px)',
          color: '#888',
          whiteSpace: 'nowrap',
          flex: '0 1 auto',
        }}>
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: '#5A6475' }}>
          <input type="checkbox" checked={showDeactivated} onChange={e => setShowDeactivated(e.target.checked)} />
          Show deactivated
        </label>
        <button
          onClick={openCreate}
          style={{
            padding: 'clamp(5px, 1.5vw, 8px) clamp(10px, 2vw, 14px)',
            fontSize: 'clamp(10px, 1.8vw, 12px)',
            background: 'var(--gov-green)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            flex: '0 1 auto',
          }}
        >
          <Plus size={14} /> Add User
        </button>
      </div>

      {/* USER TABLE */}
      <div style={{
        background: '#fff',
        border: '0.5px solid #D0D9E4',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <div style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          <AppTable className="user-management-table" style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: '940px',
          }}>
            <thead>
              <tr>
                {['User', 'Empno', 'Email', 'Role', 'Service Area', 'Service Role', 'Division / Unit', 'Office Locations', 'Actions'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left',
                    padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px)',
                    fontSize: 'clamp(9px, 1.8vw, 11px)',
                    fontWeight: 500,
                    color: '#fff',
                    background: 'var(--gov-navy)',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{
                    textAlign: 'center', padding: 24, color: '#888',
                  }}>
                    No users found.
                  </td>
                </tr>
              ) : paginatedUsers.map(u => {
                const rc = ROLE_COLORS[u.role];
                const roleLabel = ROLES.find(r => r.value === u.role)?.label ?? u.role;
                const isSelf = u.empno === currentUser?.empno;
                const assignments = (u.service_assignments || '').split(';;').filter(Boolean).map(item => {
                  const [area, serviceRole] = item.split('|');
                  return { area, serviceRole };
                });

                return (
                  <tr key={u.id}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FC')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    {/* User avatar + name */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: rc.bg, color: rc.color,
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 'var(--text-xs)',
                          fontWeight: 600, flexShrink: 0,
                        }}>
                          {getInitials(u.full_name)}
                        </div>
                        <div>
                          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: '#1A2A3A' }}>
                            {u.full_name}
                            {u.deleted_at && <span style={{ marginLeft: 6, fontSize: 'var(--text-xs)', color: '#8B1A1A' }}>Deactivated</span>}
                            {isSelf && (
                              <span style={{
                                fontSize: 'var(--text-xs)', marginLeft: 6,
                                background: '#E8F1FA', color: '#0D3B6E',
                                padding: '1px 5px', borderRadius: 3,
                              }}>
                                YOU
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Empno */}
                    <td style={{ padding: '10px 12px', fontSize: 'var(--text-xs)', color: '#5A6475' }}>
                      {u.empno || '—'}
                    </td>

                    {/* Email */}
                    <td style={{ padding: '10px 12px', fontSize: 'var(--text-xs)', color: '#5A6475' }}>
                      {u.email}
                    </td>

                    {/* Role badge */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        background: rc.bg, color: rc.color,
                        fontSize: 'var(--text-xs)', padding: '2px 8px',
                        borderRadius: 3, fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}>
                        {roleLabel}
                      </span>
                    </td>

                    <td style={{ padding: '10px 12px', fontSize: 'var(--text-xs)' }}>
                      {u.role === 'super_admin' ? <span style={{ color: '#0D3B6E', fontWeight: 600 }}>All services</span> : assignments.length ? assignments.map(item => <div key={item.area} style={{ marginBottom: 3, fontWeight: 600, color: '#1A2A3A' }}>{item.area}</div>) : <span style={{ color: '#888' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 'var(--text-xs)' }}>
                      {u.role === 'super_admin' ? <span style={{ color: '#0D3B6E' }}>FO3 Super Admin</span> : assignments.length ? assignments.map(item => <div key={`${item.area}-${item.serviceRole}`} style={{ marginBottom: 3, color: '#1B6B3A', textTransform: 'capitalize' }}>{item.serviceRole.replace('_', ' ')}</div>) : <span style={{ color: '#888' }}>Not assigned</span>}
                    </td>

                    {/* Division / Unit — single cell */}
                    <td style={{ padding: '10px 12px', fontSize: 'var(--text-xs)', color: '#5A6475' }}>
                      <div>{u.division || '—'}</div>
                      {u.unit && (
                        <div style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 2 }}>{u.unit}</div>
                      )}
                    </td>

                    {/* Office Locations */}
                    <td style={{ padding: '10px 12px', width: 180, maxWidth: 180 }}>
                      {(userLocations[u.empno] ?? []).length === 0 ? (
                        <span style={{ fontSize: 'var(--text-xs)', color: '#bbb', fontStyle: 'italic' }}>None assigned</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {(userLocations[u.empno] ?? []).map(loc => (
                            <span
                              key={loc.code}
                              title={loc.name}
                              style={{
                                fontSize: 'var(--text-xs)', padding: '2px 7px',
                                background: '#E8F1FA', color: '#0D3B6E',
                                borderRadius: 3, display: 'block',
                                overflow: 'hidden', textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap', maxWidth: 160,
                              }}
                            >
                              {loc.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {u.deleted_at ? (
                          <button onClick={() => handleRestore(u)} style={{ padding: '4px 10px', fontSize: 'var(--text-xs)', background: '#E8F5EE', color: '#1B6B3A', border: '1px solid #9AC9AA', borderRadius: 4, cursor: 'pointer' }}><RotateCcw size={13} />Restore</button>
                        ) : (
                          <>
                            <button onClick={() => openEdit(u)} style={{ padding: '4px 10px', fontSize: 'var(--text-xs)', background: 'var(--gov-navy)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}><Pencil size={13} />Edit</button>
                            {!isSelf && <button onClick={() => setDeleteTarget(u)} style={{ padding: '4px 10px', fontSize: 'var(--text-xs)', background: '#FDE8E8', color: '#8B1A1A', border: '1px solid #F5C0C0', borderRadius: 4, cursor: 'pointer' }}><UserRoundX size={13} />Deactivate</button>}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AppTable>
        </div>
{filtered.length > 0 && (
        <Pagination attached page={currentPage} total={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}

      </div>



      {/* ===== ADD / EDIT USER MODAL ===== */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,20,0.55)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div className="user-management-dialog" role="dialog" aria-modal="true" aria-label={editUser ? "Edit user" : "Add user"}
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              width: 'min(760px, calc(100vw - 32px))',
              maxWidth: '96vw',
              borderRadius: 10,
              border: '0.5px solid #C0C8D4',
              overflow: 'hidden',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div className="user-management-dialog-header" style={{
              background: 'var(--gov-navy)',
              padding: 'clamp(10px, 2vw, 14px) clamp(14px, 3vw, 20px)',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
            }}>
              <p style={{
                color: '#fff',
                fontSize: 'clamp(12px, 2vw, 15px)',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {editUser ? `Edit User — ${editUser.full_name}` : 'Add New User'}
              </p>
              <button onClick={() => setShowModal(false)} style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: 4,
                width: 'clamp(24px, 6vw, 28px)',
                height: 'clamp(24px, 6vw, 28px)',
                color: '#fff',
                fontSize: 'clamp(16px, 3vw, 20px)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>×</button>
            </div>

            {/* Body */}
            <div style={{
              padding: 'clamp(12px, 3vw, 20px)',
              overflowY: 'auto',
              flex: 1,
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'clamp(10px, 2vw, 14px)',
              }}>

                {editUser ? (
                  /* ── EDIT MODE ── */
                  <>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Full Name</label>
                      <input
                        value={editUser.full_name}
                        readOnly
                        style={{ ...inputStyle, background: '#F5F8FC', color: '#6A7280' }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Email <span style={{ color: '#8B1A1A' }}>*</span></label>
                      <input name="email" value={form.email} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Role <span style={{ color: '#8B1A1A' }}>*</span></label>
                      <select name="role" value={form.role} onChange={handleChange} style={inputStyle}>
                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Division</label>
                      <input name="division" value={form.division} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Unit</label>
                      <input name="unit" value={form.unit} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1', border: '1px solid #D5DFEA', borderRadius: 6, padding: 12, background: '#F8FAFD' }}>
                      <label style={{ ...labelStyle, marginBottom: 8 }}>Service Area Assignment</label>
                      <div style={{ fontSize: 'var(--text-xs)', color: '#62748A', marginBottom: 8 }}>A staff account can be assigned to one service area only. Changes are saved immediately.</div>
                      {serviceAccessLoading ? <div style={{ fontSize: 'var(--text-xs)', color: '#62748A' }}>Loading service areas...</div> : serviceAreas.length === 0 ? <div style={{ fontSize: 'var(--text-xs)', color: '#62748A' }}>No active service areas are configured.</div> : <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 180px', gap: 10 }}>
                        <select value={selectedServiceAreaId} onChange={e => void updateServiceAccess(Number(e.target.value || selectedServiceAreaId), e.target.value ? (selectedServiceRole || 'technical_staff') : '')} style={inputStyle}>
                          <option value="">Not assigned</option>
                          {serviceAreas.map(area => <option key={area.id} value={area.id}>{area.code} — {area.name}</option>)}
                        </select>
                        <select value={selectedServiceRole} disabled={!selectedServiceAreaId} onChange={e => void updateServiceAccess(Number(selectedServiceAreaId), e.target.value as ServiceAreaRole | '')} style={{ ...inputStyle, opacity: selectedServiceAreaId ? 1 : .6 }}>
                          <option value="">Select role</option>
                          {currentUser?.role === 'super_admin' && <option value="admin">Area Admin</option>}
                          <option value="supervisor">Supervisor</option>
                          <option value="technical_staff">Technical Staff</option>
                        </select>
                      </div>}
                    </div>
                     <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{
                        ...labelStyle,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        Office Location Assignment
                        <span style={{
                          fontSize: 'var(--text-xs)', background: '#E8F1FA',
                          color: '#0D3B6E', padding: '1px 6px',
                          borderRadius: 3, fontWeight: 400,
                        }}>
                          {selectedLocations.length} selected
                        </span>
                      </label>
                      <OfficeLocationPicker
                        all={allOfficeLocations}
                        selected={selectedLocations}
                        loading={loadingLocs}
                        search={locSearch}
                        onSearchChange={setLocSearch}
                        onToggle={loc => setSelectedLocations(prev =>
                          prev.some(s => s.code === loc.code)
                            ? prev.filter(s => s.code !== loc.code)
                            : [...prev, loc]
                        )}
                      />
                    </div>

                  </>
                ) : (
                  /* ── ADD MODE — 2-column side-by-side, no scroll on small screens ── */
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 14, minHeight: 0 }}>

                    {/* LEFT COLUMN: Employee wizard */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>

                      {/* Section label */}
                      <div style={{
                        fontSize: 'var(--text-xs)', fontWeight: 600, color: '#0D3B6E',
                        textTransform: 'uppercase', letterSpacing: 0.6,
                        borderBottom: '1px solid #E5EAF0', paddingBottom: 4,
                      }}>
                        Employee Selection
                      </div>

                      {/* Division */}
                      <div>
                        <label style={labelStyle}>Division <span style={{ color: '#8B1A1A' }}>*</span></label>
                        {loadingDivs ? (
                          <div style={{ fontSize: 'var(--text-xs)', color: '#888', padding: '6px 0' }}>Loading divisions...</div>
                        ) : (
                          <select
                            value={selDivision?.division_code ?? ''}
                            onChange={e => {
                              const val = e.target.value;
                              console.log('[DIV] selected val:', val, 'divisions:', divisions);
                              if (!val) {
                                setSelDivision(null); setSelUnit(null); setSelEmployee(null);
                                setUnits([]); setEmployees([]); setEmpSearch('');
                                return;
                              }
                              const found = divisions.find(d => String(d.division_code) === String(val)) ?? null;
                              console.log('[DIV] found:', found);
                              if (!found) return;
                              setSelDivision(found); setSelUnit(null); setSelEmployee(null);
                              setUnits([]); setEmployees([]); setEmpSearch('');
                              setLoadingUnits(true);
                              api.get(`/users/erm/units/${found.division_code}`)
                                .then(r => setUnits(r.data))
                                .catch(() => setUnits([]))
                                .finally(() => setLoadingUnits(false));
                            }}
                            style={inputStyle}
                          >
                            <option value="">— Select Division —</option>
                            {divisions.map(d => (
                              <option key={d.division_code} value={d.division_code}>{d.division_name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Unit */}
                      <div>
                        <label style={labelStyle}>Unit <span style={{ color: '#8B1A1A' }}>*</span></label>
                        {loadingUnits ? (
                          <div style={{ fontSize: 'var(--text-xs)', color: '#888', padding: '6px 0' }}>Loading units...</div>
                        ) : (
                          <select
                            value={selUnit?.unit_code ?? ''}
                            disabled={!selDivision}
                            onChange={e => {
                              const val = e.target.value;
                              if (!val) {
                                setSelUnit(null); setSelEmployee(null);
                                setEmployees([]); setEmpSearch('');
                                return;
                              }
                              const found = units.find(u => String(u.unit_code) === String(val)) ?? null;
                              if (!found || !selDivision) return;
                              setSelUnit(found); setSelEmployee(null);
                              setEmployees([]); setEmpSearch('');
                              setLoadingEmps(true);
                              api.get('/users/erm/employees', {
                                params: {
                                  division_code: selDivision.division_code,
                                  unit_code: found.unit_code,
                                  unit_name: found.unit_name,
                                },
                              })
                                .then(r => setEmployees(r.data))
                                .catch(() => setEmployees([]))
                                .finally(() => setLoadingEmps(false));
                            }}
                            style={{
                              ...inputStyle,
                              background: !selDivision ? '#F5F8FC' : '#fff',
                              color: !selDivision ? '#aaa' : '#2A2A2A',
                            }}
                          >
                            <option value="">— Select Unit —</option>
                            {units.map(u => (
                              <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Employee list */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <label style={labelStyle}>Employee <span style={{ color: '#8B1A1A' }}>*</span></label>
                        {loadingEmps ? (
                          <div style={{ fontSize: 'var(--text-xs)', color: '#888', padding: '6px 0' }}>Loading employees...</div>
                        ) : (
                          <>
                            <input
                              type="text"
                              placeholder={selUnit ? 'Search name or emp no...' : 'Select a unit first'}
                              value={empSearch}
                              disabled={!selUnit}
                              onChange={e => setEmpSearch(e.target.value)}
                              style={{
                                ...inputStyle,
                                marginBottom: 5,
                                background: !selUnit ? '#F5F8FC' : '#fff',
                                color: !selUnit ? '#aaa' : '#2A2A2A',
                              }}
                            />
                            {selUnit && (
                              <div style={{
                                border: '1px solid #C8D0DC', borderRadius: 4,
                                flex: 1, overflowY: 'auto', minHeight: 80, maxHeight: 180,
                                background: '#fff',
                              }}>
                                {employees.length === 0 ? (
                                  <div style={{ padding: 12, fontSize: 'var(--text-xs)', color: '#888', textAlign: 'center' }}>
                                    No employees found in this unit.
                                  </div>
                                ) : employees
                                  .filter(emp =>
                                    !empSearch ||
                                    emp.full_name.toLowerCase().includes(empSearch.toLowerCase()) ||
                                    emp.empno.includes(empSearch)
                                  )
                                  .map(emp => {
                                    const isSelected = selEmployee?.empno === emp.empno;
                                    return (
                                      <div
                                        key={emp.empno}
                                        onClick={() => {
                                          setSelEmployee(emp);
                                          setForm(f => ({
                                            ...f,
                                            empno: emp.empno,
                                            full_name: emp.full_name,
                                            email: emp.email,
                                          }));
                                        }}
                                        style={{
                                          padding: '7px 10px', cursor: 'pointer',
                                          borderBottom: '0.5px solid #EEF0F4',
                                          background: isSelected ? '#E8F1FA' : '#fff',
                                          display: 'flex', alignItems: 'center',
                                          justifyContent: 'space-between',
                                          transition: 'background 0.1s',
                                        }}
                                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#F5F8FC'; }}
                                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
                                      >
                                        <div>
                                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: '#1A2A3A' }}>
                                            {emp.full_name}
                                          </div>
                                          <div style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 1 }}>
                                            #{emp.empno}
                                            {emp.position_classification_id && (
                                              <span style={{ marginLeft: 6, color: '#aaa' }}>
                                                · {emp.position_classification_id}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gov-green)', fontWeight: 600, flexShrink: 0 }}>
                                            ✓
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })
                                }
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {/* Selected employee summary */}
                      {selEmployee && (
                        <div style={{
                          background: '#E8F5EE', border: '1px solid #B5DDC8',
                          borderRadius: 4, padding: '7px 10px',
                          fontSize: 'var(--text-xs)', color: '#1B6B3A',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>✓ {selEmployee.full_name}</div>
                              <div style={{ fontSize: 'var(--text-xs)', color: '#4A7A5A', marginTop: 2 }}>
                                #{selEmployee.empno} · {selDivision?.division_name} · {selUnit?.unit_name}
                              </div>
                            </div>
                            <button
                              onClick={() => { setSelEmployee(null); setForm(f => ({ ...f, empno: '', full_name: '', email: '' })); }}
                              style={{ fontSize: 'var(--text-xs)', color: '#8B1A1A', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* DIVIDER */}
                    <div style={{ width: 1, background: '#E5EAF0', flexShrink: 0 }} />

                    {/* RIGHT COLUMN: Role, Email, Office Locations */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>

                      {/* Section label */}
                      <div style={{
                        fontSize: 'var(--text-xs)', fontWeight: 600, color: '#0D3B6E',
                        textTransform: 'uppercase', letterSpacing: 0.6,
                        borderBottom: '1px solid #E5EAF0', paddingBottom: 4,
                      }}>
                        Role & Access
                      </div>

                      {/* Role */}
                      <div>
                        <label style={labelStyle}>Role <span style={{ color: '#8B1A1A' }}>*</span></label>
                        <select
                          value={wizardRole}
                          onChange={e => setWizardRole(e.target.value as UserRole)}
                          style={inputStyle}
                        >
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </div>

                      {/* Email */}
                      <div>
                        <label style={labelStyle}>Email <span style={{ color: '#8B1A1A' }}>*</span></label>
                        <input
                          name="email"
                          value={form.email}
                          onChange={handleChange}
                          placeholder="name@dswd.gov.ph"
                          style={inputStyle}
                        />
                        <p style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 3 }}>
                          Auto-filled on employee selection.
                        </p>
                      </div>

                      {wizardRole === 'super_admin' ? <div style={{ padding: 10, borderRadius: 6, background: '#EEF6FF', color: '#0D3B6E', fontSize: 'var(--text-xs)' }}><strong>FO3 Super Admin:</strong> this account has authority over every service area and does not need an individual service assignment.</div> : <div style={{ border: '1px solid #D5DFEA', borderRadius: 6, padding: 10, background: '#F8FAFD' }}>
                        <label style={labelStyle}>Service Area Assignment</label>
                        <div style={{ fontSize: 'var(--text-xs)', color: '#62748A', marginBottom: 6 }}>Select one service area and its role when the user is created.</div>
                        {serviceAccessLoading ? <div style={{ fontSize: 'var(--text-xs)', color: '#62748A' }}>Loading service areas...</div> : <><div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 8 }}>
                          <select value={selectedServiceAreaId} onChange={e => setNewUserServiceArea(e.target.value)} style={inputStyle}>
                            <option value="">Select a service area</option>
                            {serviceAreas.map(area => <option key={area.id} value={area.id}>{area.code + ' - ' + area.name}</option>)}
                          </select>
                          <select value={selectedServiceRole} disabled={!selectedServiceAreaId} onChange={e => setNewUserServiceRole(e.target.value as ServiceAreaRole | '')} style={{ ...inputStyle, opacity: selectedServiceAreaId ? 1 : .6 }}>
                            <option value="">Select role</option>{currentUser?.role === 'super_admin' && <option value="admin">Area Admin</option>}<option value="supervisor">Supervisor</option><option value="technical_staff">Technical Staff</option>
                          </select>
                        </div>{false && serviceAreas.map(area => (
                          <div key={area.id} style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 8, alignItems: 'center', padding: '5px 0', borderTop: '1px solid #E7EDF4' }}>
                            <span style={{ fontSize: 'var(--text-xs)' }}><strong>{area.code}</strong> — {area.name}</span>
                            <select value={serviceAccess[area.id] || ''} onChange={e => setServiceAccess(current => ({ ...current, [area.id]: e.target.value as ServiceAreaRole | '' }))} style={inputStyle}>
                              <option value="">Not assigned</option>{currentUser?.role === 'super_admin' && <option value="admin">Area Admin</option>}<option value="supervisor">Supervisor</option><option value="technical_staff">Technical Staff</option>
                            </select>
                          </div>
                        ))}</>}
                      </div>}

                      {/* Office Location */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <label style={{
                          ...labelStyle,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          Office Locations
                          <span style={{
                            fontSize: 'var(--text-xs)', background: '#E8F1FA',
                            color: '#0D3B6E', padding: '1px 6px',
                            borderRadius: 3, fontWeight: 400,
                          }}>
                            {selectedLocations.length} selected
                          </span>
                        </label>
                        <OfficeLocationPicker
                          all={allOfficeLocations}
                          selected={selectedLocations}
                          loading={loadingLocs}
                          search={locSearch}
                          onSearchChange={setLocSearch}
                          onToggle={loc => setSelectedLocations(prev =>
                            prev.some(s => s.code === loc.code)
                              ? prev.filter(s => s.code !== loc.code)
                              : [...prev, loc]
                          )}
                        />
                      </div>

                      {/* Note */}
                      <div style={{
                        background: '#F5F8FC', borderRadius: 4,
                        padding: '6px 10px', fontSize: 'var(--text-xs)', color: '#5A6475', lineHeight: 1.6,
                      }}>
                        <strong style={{ color: '#1A2A3A' }}>Note:</strong> Employee logs in using existing ERM credentials. No password setup needed.
                      </div>
                    </div>

                  </div>
                )}

              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: 'clamp(10px, 2vw, 12px) clamp(14px, 3vw, 20px)',
              borderTop: '0.5px solid #E5EAF0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'clamp(6px, 1.5vw, 8px)',
              background: '#F8FAFC',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: 'clamp(5px, 1.5vw, 6px) clamp(10px, 2vw, 14px)',
                  fontSize: 'clamp(10px, 1.8vw, 12px)',
                  border: '1px solid #C8D0DC',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (!editUser && !selEmployee)}
                style={{
                  padding: 'clamp(5px, 1.5vw, 6px) clamp(12px, 2.5vw, 16px)',
                  fontSize: 'clamp(10px, 1.8vw, 12px)',
                  background: saving ? '#888' : (!editUser && !selEmployee) ? '#ccc' : 'var(--gov-green)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: saving || (!editUser && !selEmployee) ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {saving ? 'Saving...' : editUser ? '✓ Save Changes' : '✓ Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DEACTIVATE CONFIRM MODAL ===== */}
      {deleteTarget && (
        <div
          onClick={() => setDeleteTarget(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,20,0.55)',
            zIndex: 200, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', width: 380,
              borderRadius: 10, overflow: 'hidden',
              border: '0.5px solid #C0C8D4',
            }}
          >
            <div style={{
              background: '#8B1A1A', padding: '14px 20px',
            }}>
              <p style={{ color: '#fff', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                Confirm Deactivate User
              </p>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 'var(--text-sm)', color: '#2A2A2A', marginBottom: 14, lineHeight: 1.6 }}>
                Deactivate <strong>{deleteTarget.full_name}</strong>? They will be signed out and cannot sign in or receive new assignments until restored.
              </p>
              <div style={{
                background: '#FDE8E8', borderRadius: 4,
                padding: '8px 12px', fontSize: 'var(--text-xs)', color: '#8B1A1A',
              }}>
                Ticket history and current assignments will be preserved. Reassign any active tickets afterward.
              </div>
            </div>
            <div style={{
              padding: '12px 20px', borderTop: '0.5px solid #E5EAF0',
              display: 'flex', justifyContent: 'flex-end',
              gap: 8, background: '#F8FAFC',
            }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  padding: '6px 14px', fontSize: 'var(--text-sm)',
                  border: '1px solid #C8D0DC', borderRadius: 4,
                  background: '#fff', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '6px 16px', fontSize: 'var(--text-sm)',
                  background: deleting ? '#888' : '#8B1A1A',
                  color: '#fff', border: 'none',
                  borderRadius: 4, cursor: deleting ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {deleting ? 'Deactivating...' : 'Yes, Deactivate User'}
              </button>
            </div>
          </div>
        </div>
      )}

      </>}

      {/* ===== ACCOUNT RECOVERY CONFIRM MODAL ===== */}
      {recoveryTarget && (
        <div onClick={() => setRecoveryTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,20,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: 380, borderRadius: 10, overflow: 'hidden', border: '0.5px solid #C0C8D4' }}>
            <div style={{ background: recoveryTarget.action === 'unlock' ? '#1B6B3A' : recoveryTarget.action === 'lock' ? '#CC7700' : '#8B1A1A', padding: '14px 20px' }}>
              <p style={{ color: '#fff', fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>
                {recoveryTarget.action === 'lock' ? 'Confirm Account Lock' : recoveryTarget.action === 'unlock' ? 'Confirm Account Unlock' : 'Confirm MFA Reset'}
              </p>
            </div>
            <div style={{ padding: 20 }}>
              {recoveryTarget.action === 'lock' ? <>
                <p style={{ fontSize: 'var(--text-sm)', color: '#2A2A2A', margin: '0 0 14px', lineHeight: 1.6 }}>Lock ICTMS access for <strong>{recoveryTarget.user.full_name}</strong>?</p>
                <div style={{ background: '#FEF3DC', borderRadius: 4, padding: '8px 12px', fontSize: 'var(--text-xs)', color: '#8A5200' }}>The user cannot sign in to ICTMS until a Super Admin unlocks the account. Their HR/Harmony password is unchanged.</div>
              </> : recoveryTarget.action === 'unlock' ? <>
                <p style={{ fontSize: 'var(--text-sm)', color: '#2A2A2A', margin: '0 0 14px', lineHeight: 1.6 }}>Clear the ICTMS login lockout for <strong>{recoveryTarget.user.full_name}</strong>?</p>
                <div style={{ background: '#FEF3DC', borderRadius: 4, padding: '8px 12px', fontSize: 'var(--text-xs)', color: '#8A5200' }}>This resets failed ICTMS login attempts. It does not change the user’s HR/Harmony password.</div>
              </> : <>
                <p style={{ fontSize: 'var(--text-sm)', color: '#2A2A2A', margin: '0 0 14px', lineHeight: 1.6 }}>Reset MFA for <strong>{recoveryTarget.user.full_name}</strong>?</p>
                <div style={{ background: '#FDE8E8', borderRadius: 4, padding: '8px 12px', fontSize: 'var(--text-xs)', color: '#8B1A1A' }}>This signs the user out, removes Authenticator and email-OTP setup, and requires MFA enrollment at their next login.</div>
              </>}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '0.5px solid #E5EAF0', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#F8FAFC' }}>
              <button onClick={() => setRecoveryTarget(null)} style={{ padding: '6px 14px', fontSize: 'var(--text-sm)', border: '1px solid #C8D0DC', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmRecoveryAction} style={{ padding: '6px 16px', fontSize: 'var(--text-sm)', background: recoveryTarget.action === 'unlock' ? '#1B6B3A' : recoveryTarget.action === 'lock' ? '#CC7700' : '#8B1A1A', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}>{recoveryTarget.action === 'lock' ? 'Lock Account' : recoveryTarget.action === 'unlock' ? 'Unlock Account' : <><ShieldOff size={13} />Reset MFA</>}</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast.msg && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20,
          background: toast.type === 'error' ? '#8B1A1A' : 'var(--gov-green)',
          color: '#fff', padding: '10px 16px',
          borderRadius: 4, fontSize: 'var(--text-sm)', fontWeight: 500, zIndex: 300,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
