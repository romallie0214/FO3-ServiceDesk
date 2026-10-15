import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ictms_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});


api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && localStorage.getItem('ictms_token')) {
      localStorage.removeItem('ictms_token');
      localStorage.removeItem('ictms_user');
      localStorage.removeItem('ictms_session_token');
      localStorage.removeItem('ictms_last_activity');
      sessionStorage.setItem(
        'ictms_auth_message',
        error.response?.data?.error || 'Your session is no longer active. Please sign in again.'
      );

      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);

export interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  category: string;
  requestor: string;
  division: string;
  assigned_to: string | null;
  created_at: string;
}

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: 'staff' | 'admin';
  division: string;
}

export interface Comment {
  id: number;
  ticket_id: number;
  user_id: number;
  content: string;
  full_name: string;
  role: string;
  created_at: string;
}

export const ticketService = {
  getAll: () => api.get<Ticket[]>('/tickets'),
  getById: (id: number) => api.get<Ticket>(`/tickets/${id}`),
  create: (data: Partial<Ticket> & { category_id: number; requestor_id: number }) =>
    api.post('/tickets', data),
  update: (id: number, data: { status?: string; assigned_to?: number }) =>
    api.patch(`/tickets/${id}`, data),
};

export const userService = {
  getAll: () => api.get<User[]>('/users'),
  login: (email: string, password: string) =>
    api.post('/users/login', { email, password }),
};

export const commentService = {
  getByTicket: (ticketId: number) => api.get<Comment[]>(`/comments/${ticketId}`),
  create: (data: { ticket_id: number; user_id: number; content: string }) =>
    api.post('/comments', data),
};