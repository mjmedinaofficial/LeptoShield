import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

function friendlyMessage(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((item) => item?.msg?.replace(/^Value error,\s*/, '') || 'That value could not be accepted.')
      .join(' · ');
  }
  if (error?.code === 'ECONNABORTED') return 'The clinic server took too long to answer. Try again.';
  if (!error?.response) return 'Cannot reach the clinic server. Check that the backend is running.';
  return 'Something went wrong. Please try again.';
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    error.friendlyMessage = friendlyMessage(error);
    return Promise.reject(error);
  },
);

export async function getHealth() {
  const { data } = await api.get('/health');
  return data;
}

export async function getQueue() {
  const { data } = await api.get('/queue');
  return data;
}

export async function createTriage(payload) {
  const { data } = await api.post('/triage', payload);
  return data;
}

export async function getTicket(identifier) {
  const { data } = await api.get(`/triage/${encodeURIComponent(identifier)}`);
  return data;
}

export async function callNext(payload) {
  const { data } = await api.post('/queue/call', payload);
  return data;
}

export async function completeVisit(payload) {
  const { data } = await api.post('/queue/complete', payload);
  return data;
}

export async function overridePriority(payload) {
  const { data } = await api.post('/queue/override', payload);
  return data;
}

export async function getSurveillance() {
  const { data } = await api.get('/surveillance');
  return data;
}

export async function getInventory() {
  const { data } = await api.get('/inventory');
  return data;
}

export async function restock(payload) {
  const { data } = await api.post('/inventory/restock', payload);
  return data;
}

export async function dispense(payload) {
  const { data } = await api.post('/inventory/dispense', payload);
  return data;
}

export async function simulateSurge(count = 5) {
  const { data } = await api.post('/demo/surge', { count });
  return data;
}

export async function getEvents(limit = 20) {
  const { data } = await api.get('/events', { params: { limit } });
  return data;
}

export async function getMeta() {
  const { data } = await api.get('/meta');
  return data;
}
