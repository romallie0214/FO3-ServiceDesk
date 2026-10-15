import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  page: string;
  children: React.ReactNode;
}

export default function RoleRoute({ page, children }: Props) {
  const { isAuthenticated, canAccess } = useAuth();

  // Not logged in at all → go to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but no access → go to unauthorized page
  if (!canAccess(page)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}