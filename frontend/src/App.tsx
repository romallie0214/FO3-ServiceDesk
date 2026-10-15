import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import RoleRoute from './components/RoleRoute';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import Dashboard from './pages/Dashboard';
import TicketList from './pages/TicketList';
import SubmitTicket from './pages/SubmitTicket';
import AdminManagement from './pages/AdminManagement';
import KnowledgeBase from './pages/KnowledgeBase';
import CSMReports from './pages/CSMReports';
import UserManagement from './pages/UserManagement';
import StatusManagement from './pages/StatusManagement';
import CategoryManagement from './pages/CategoryManagement';
import SLA from './pages/SLAManagement';
import KnowledgeBaseManagement from './pages/KnowledgeBaseManagement';
import TicketMonitoring from './pages/TicketMonitoring';
import MyTickets from './pages/MyTickets';
import MyRequests from './pages/MyRequests';
import ServiceAreaManagement from './pages/ServiceAreaManagement';

function RolePage({ page, children }: { page: string; children: React.ReactNode }) {
  return (
    <RoleRoute page={page}>
      <Layout>{children}</Layout>
    </RoleRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/live-monitoring" element={<TicketMonitoring publicMode />} />

          {/* Dashboard — super_admin, supervisor, ictms_staff */}
          <Route path="/" element={
            <RolePage page="dashboard"><Dashboard /></RolePage>
          }/>

          {/* Submit Ticket — super_admin, dswd_staff */}
          <Route path="/submit" element={
            <RolePage page="submit"><SubmitTicket /></RolePage>
          }/>

          {/* Ticket List — super_admin, ictms_staff, dswd_staff */}
          <Route path="/tickets" element={
            <RolePage page="tickets"><TicketList /></RolePage>
          }/>

          {/* Admin Management — super_admin, ictms_staff */}
          <Route path="/admin" element={
            <RolePage page="admin"><AdminManagement /></RolePage>
          }/>

          {/* Knowledge Base — super_admin, ictms_staff, dswd_staff */}
          <Route path="/kb" element={
            <RolePage page="kb"><KnowledgeBase /></RolePage>
          }/>

          {/* CSM Reports — super_admin, supervisor */}
          <Route path="/csm-reports" element={
            <RolePage page="csm"><CSMReports /></RolePage>
          }/>

          {/* User Management — super_admin only */}
          <Route path="/users" element={
            <RolePage page="users"><UserManagement /></RolePage>
          }/>

          {/* Status Management — super_admin only */}
          <Route path="/statuses" element={
            <RolePage page="statuses"><StatusManagement /></RolePage>
          }/>
          {/* Category Management — super_admin only */}
          <Route path="/categories" element={
            <RolePage page="categories"><CategoryManagement /></RolePage>
          }/>
          <Route path="/service-areas" element={
            <RolePage page="service_areas"><ServiceAreaManagement /></RolePage>
          }/>

          {/* SLA Management — super_admin only */}
          <Route path="/sla" element={
            <RolePage page="sla"><SLA /></RolePage>
          }/>

          {/* Knowledge Base Management — super_admin only */}
          <Route path="/admin/knowledge_base" element={
            <RolePage page="knowledge_base"><KnowledgeBaseManagement /></RolePage>
          } />
          {/* Ticket Monitoring — super_admin, supervisor */}
          <Route path="/monitoring" element={
            <RolePage page="monitoring"><TicketMonitoring /></RolePage>
          }/>

          {/* Assigned queue — super_admin and ictms_staff */}
          <Route path="/my-tickets" element={
            <RolePage page="my_tickets"><MyTickets /></RolePage>
          }/>

          {/* My Requests — super_admin and ictms_staff */}
          <Route path="/my-requests" element={
            <RolePage page="my_requests"><MyRequests /></RolePage>
          }/>


        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
