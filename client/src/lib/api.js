const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchAPI(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: getHeaders(),
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// User
export const getUserProfile = () => fetchAPI('/user/profile');
export const updateUserProfile = (body) => fetchAPI('/user/profile', { method: 'PUT', body: JSON.stringify(body) });
export const getUserStats = (userId) => fetchAPI(`/user/stats/${userId}`);
export const getUserMatchHistory = (userId, page = 1) => fetchAPI(`/user/match-history/${userId}?page=${page}&limit=10`);

// Leaderboard
export const getLeaderboard = (sort = 'streak', page = 1) => fetchAPI(`/leaderboard?sort=${sort}&page=${page}&limit=10`);
export const getUserRank = (userId) => fetchAPI(`/leaderboard/user-rank/${userId}`);
export const getGlobalStats = () => fetchAPI('/leaderboard/global-stats');

// Anti-cheat
export const reportTabSwitch = (matchId) => fetchAPI('/cheat/report-tab-switch', { method: 'POST', body: JSON.stringify({ matchId, timestamp: Date.now() }) });
export const reportCopyAttempt = (matchId) => fetchAPI('/cheat/report-copy-attempt', { method: 'POST', body: JSON.stringify({ matchId, timestamp: Date.now() }) });
