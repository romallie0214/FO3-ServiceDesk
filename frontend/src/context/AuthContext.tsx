import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export type UserRole = 'super_admin' | 'supervisor' | 'ictms_staff' | 'dswd_staff';

export interface User {
  id: number;
  empno: string;
  full_name: string;
  email: string;
  role: UserRole;
  division: string;
  unit: string;
  position: string;
  office_location: string;
  area_admin_service_ids?: number[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User, sessionToken?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isSupervisor: boolean;
  isIctmsStaff: boolean;
  isDswdStaff: boolean;
  canAccess: (page: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const PAGE_ACCESS: Record<string, UserRole[]> = {
  dashboard:      ['super_admin', 'supervisor', 'ictms_staff'],
  submit:         ['super_admin', 'dswd_staff', 'ictms_staff'],
  tickets:        ['super_admin', 'ictms_staff', 'dswd_staff'],
  admin:          ['super_admin', 'ictms_staff'],
  kb:             ['super_admin', 'ictms_staff', 'dswd_staff'],
  csm:            ['super_admin', 'supervisor', 'ictms_staff'],
  monitoring:     ['super_admin', 'supervisor'],
  users:          ['super_admin'],
  statuses:       ['super_admin'],
  categories:     ['super_admin'],
  service_areas:  ['super_admin'],
  sla:            ['super_admin'],
  knowledge_base: ['super_admin'],
  my_tickets:     ['super_admin', 'ictms_staff'],
  my_requests:    ['super_admin', 'ictms_staff'],
};

const configuredIdleMinutes = Number(import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MINUTES ?? 15);
const IDLE_TIMEOUT_MINUTES = Number.isFinite(configuredIdleMinutes)
  ? Math.max(configuredIdleMinutes, 1)
  : 15;
const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;
const SESSION_ACTIVITY_SYNC_MS = 60 * 1000;
const ACTIVITY_STORAGE_SYNC_MS = 1000;
const LAST_ACTIVITY_KEY = 'ictms_last_activity';
const ACTIVITY_VALUE_PREFIX = 'v1:';

function encodeActivityTime(timestamp: number): string {
  return ACTIVITY_VALUE_PREFIX + timestamp.toString(36);
}

function decodeActivityTime(value: string | null): number {
  if (!value) return 0;

  const timestamp = value.startsWith(ACTIVITY_VALUE_PREFIX)
    ? Number.parseInt(value.slice(ACTIVITY_VALUE_PREFIX.length), 36)
    : Number(value); // Backward compatibility with existing numeric values.

  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

// ── Activity events that reset the idle timer ─────────────────────────────────
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click',
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ── Initialise directly from localStorage so refresh never flashes logout ──
  const [user, setUser]   = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('ictms_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('ictms_token')
  );

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivitySync = useRef(0);
  const lastStorageSync = useRef(0);

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem('ictms_token');
    localStorage.removeItem('ictms_user');
    localStorage.removeItem('ictms_session_token');
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    setToken(null);
    setUser(null);
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  // ── Logout helper ─────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    const sessionToken = localStorage.getItem('ictms_session_token');
    if (sessionToken) {
      fetch('/api/users/logout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken }), keepalive: true,
      }).catch(() => undefined);
    }
    clearLocalSession();
  }, [clearLocalSession]);

  const expireIdleSession = useCallback(() => {
    sessionStorage.setItem(
      'ictms_auth_message',
      'Your session ended after ' + IDLE_TIMEOUT_MINUTES + ' minutes of inactivity. Please sign in again.',
    );
    logout();
  }, [logout]);

  const scheduleIdleCheck = useCallback((lastActivity: number) => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity);
    if (remaining <= 0) {
      expireIdleSession();
      return;
    }
    idleTimer.current = setTimeout(() => {
      const storedActivity = decodeActivityTime(localStorage.getItem(LAST_ACTIVITY_KEY));
      if (!storedActivity || Date.now() - storedActivity >= IDLE_TIMEOUT_MS) {
        expireIdleSession();
      } else {
        idleTimer.current = setTimeout(
          expireIdleSession,
          IDLE_TIMEOUT_MS - (Date.now() - storedActivity),
        );
      }
    }, remaining);
  }, [expireIdleSession]);

  // Reset idle timer on user activity
  const resetIdleTimer = useCallback(() => {
    const now = Date.now();
    scheduleIdleCheck(now);
    if (now - lastStorageSync.current >= ACTIVITY_STORAGE_SYNC_MS) {
      lastStorageSync.current = now;
      localStorage.setItem(LAST_ACTIVITY_KEY, encodeActivityTime(now));
    }
    if (token && now - lastActivitySync.current >= SESSION_ACTIVITY_SYNC_MS) {
      lastActivitySync.current = now;
      fetch('/api/users/session/activity', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }, keepalive: true,
      }).then(response => {
        if (response.status === 401) expireIdleSession();
      }).catch(() => undefined);
    }
  }, [expireIdleSession, scheduleIdleCheck, token]);

  // Attach / detach activity listeners whenever user is logged in ─────────
  useEffect(() => {
    if (!token) return;

    const storedActivity = decodeActivityTime(localStorage.getItem(LAST_ACTIVITY_KEY));
    const initialActivity = storedActivity || Date.now();
    localStorage.setItem(LAST_ACTIVITY_KEY, encodeActivityTime(initialActivity));
    idleTimer.current = setTimeout(() => scheduleIdleCheck(initialActivity), 0);

    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, resetIdleTimer, { passive: true })
    );

    const checkElapsedTime = () => {
      if (document.visibilityState === 'visible') {
        scheduleIdleCheck(decodeActivityTime(localStorage.getItem(LAST_ACTIVITY_KEY)));
      }
    };
    const syncAcrossTabs = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY && event.newValue) scheduleIdleCheck(decodeActivityTime(event.newValue));
      if (event.key === 'ictms_token' && !event.newValue) clearLocalSession();
    };
    document.addEventListener('visibilitychange', checkElapsedTime);
    window.addEventListener('focus', checkElapsedTime);
    window.addEventListener('storage', syncAcrossTabs);

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
      document.removeEventListener('visibilitychange', checkElapsedTime);
      window.removeEventListener('focus', checkElapsedTime);
      window.removeEventListener('storage', syncAcrossTabs);
    };
  }, [clearLocalSession, resetIdleTimer, scheduleIdleCheck, token]);

  // ── Login ─────────────────────────────────────────────────────────────────
  function login(newToken: string, newUser: User, sessionToken?: string) {
    localStorage.setItem('ictms_token', newToken);
    localStorage.setItem('ictms_user', JSON.stringify(newUser));
    if (sessionToken) localStorage.setItem('ictms_session_token', sessionToken);
    localStorage.setItem(LAST_ACTIVITY_KEY, encodeActivityTime(Date.now()));
    setToken(newToken);
    setUser(newUser);
  }

  // ── canAccess ─────────────────────────────────────────────────────────────
  function canAccess(page: string): boolean {
    if (!user) return false;
    if (['dashboard', 'users', 'categories', 'sla', 'knowledge_base', 'csm', 'tickets', 'admin', 'monitoring', 'my_requests', 'my_tickets'].includes(page) && (user.area_admin_service_ids?.length ?? 0) > 0) return true;
    return PAGE_ACCESS[page]?.includes(user.role) ?? false;
  }

  return (
    <AuthContext.Provider value={{
      user, token, login, logout,
      isAuthenticated: !!token,
      isSuperAdmin: user?.role === 'super_admin',
      isSupervisor: user?.role === 'supervisor',
      isIctmsStaff: user?.role === 'ictms_staff',
      isDswdStaff:  user?.role === 'dswd_staff',
      canAccess,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
