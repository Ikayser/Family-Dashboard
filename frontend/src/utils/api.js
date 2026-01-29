const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  // Dashboard
  getDashboardWeek: (weekOffset = 0) =>
    fetchAPI(`/dashboard/week?weekOffset=${weekOffset}`),
  getDashboardOverview: () =>
    fetchAPI('/dashboard/overview'),
  getPrintData: (weeks = 2) =>
    fetchAPI(`/dashboard/print?weeks=${weeks}`),

  // Members
  getMembers: () => fetchAPI('/members'),
  getMember: (id) => fetchAPI(`/members/${id}`),
  createMember: (data) => fetchAPI('/members', { method: 'POST', body: data }),
  updateMember: (id, data) => fetchAPI(`/members/${id}`, { method: 'PUT', body: data }),
  deleteMember: (id) => fetchAPI(`/members/${id}`, { method: 'DELETE' }),

  // Travel
  getTravel: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/travel${query ? `?${query}` : ''}`);
  },
  createTravel: (data) => fetchAPI('/travel', { method: 'POST', body: data }),
  updateTravel: (id, data) => fetchAPI(`/travel/${id}`, { method: 'PUT', body: data }),
  deleteTravel: (id) => fetchAPI(`/travel/${id}`, { method: 'DELETE' }),
  getChildcareConflicts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/travel/conflicts/childcare${query ? `?${query}` : ''}`);
  },

  // Schools
  getSchools: () => fetchAPI('/schools'),
  getSchool: (id) => fetchAPI(`/schools/${id}`),
  updateSchool: (id, data) => fetchAPI(`/schools/${id}`, { method: 'PUT', body: data }),
  addSchoolDayOff: (schoolId, data) =>
    fetchAPI(`/schools/${schoolId}/days-off`, { method: 'POST', body: data }),
  getSchoolSchedule: (schoolId, studentId) =>
    fetchAPI(`/schools/${schoolId}/schedule/${studentId}`),
  addScheduleItem: (schoolId, studentId, data) =>
    fetchAPI(`/schools/${schoolId}/schedule/${studentId}`, { method: 'POST', body: data }),
  getCurrentWeek: (schoolId, studentId) =>
    fetchAPI(`/schools/${schoolId}/current-week/${studentId}`),

  // Activities
  getActivities: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/activities${query ? `?${query}` : ''}`);
  },
  getActivity: (id) => fetchAPI(`/activities/${id}`),
  createActivity: (data) => fetchAPI('/activities', { method: 'POST', body: data }),
  updateActivity: (id, data) => fetchAPI(`/activities/${id}`, { method: 'PUT', body: data }),
  deleteActivity: (id) => fetchAPI(`/activities/${id}`, { method: 'DELETE' }),
  addActivitySchedule: (activityId, data) =>
    fetchAPI(`/activities/${activityId}/schedule`, { method: 'POST', body: data }),
  updateActivitySchedule: (activityId, scheduleId, data) =>
    fetchAPI(`/activities/${activityId}/schedule/${scheduleId}`, { method: 'PUT', body: data }),
  deleteActivitySchedule: (activityId, scheduleId) =>
    fetchAPI(`/activities/${activityId}/schedule/${scheduleId}`, { method: 'DELETE' }),
  addActivityInstance: (activityId, data) =>
    fetchAPI(`/activities/${activityId}/instances`, { method: 'POST', body: data }),
  getActivitiesForRange: (startDate, endDate) =>
    fetchAPI(`/activities/calendar/range?startDate=${startDate}&endDate=${endDate}`),

  // Childcare
  getChildcare: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/childcare${query ? `?${query}` : ''}`);
  },
  createChildcare: (data) => fetchAPI('/childcare', { method: 'POST', body: data }),
  updateChildcare: (id, data) => fetchAPI(`/childcare/${id}`, { method: 'PUT', body: data }),
  deleteChildcare: (id) => fetchAPI(`/childcare/${id}`, { method: 'DELETE' }),
  getChildcareNeeds: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/childcare/needs/coverage${query ? `?${query}` : ''}`);
  },

  // Holidays
  getHolidays: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/holidays${query ? `?${query}` : ''}`);
  },
  fetchHolidays: (year) =>
    fetchAPI('/holidays/fetch', { method: 'POST', body: { year } }),
  getAllDaysOff: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/holidays/all-days-off${query ? `?${query}` : ''}`);
  },

  // Survey
  getSurveyQuestions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/survey/questions${query ? `?${query}` : ''}`);
  },
  createQuestion: (data) =>
    fetchAPI('/survey/questions', { method: 'POST', body: data }),
  updateQuestion: (id, data) =>
    fetchAPI(`/survey/questions/${id}`, { method: 'PUT', body: data }),
  getPendingSurveys: (weekOffset = 0) =>
    fetchAPI(`/survey/pending?weekOffset=${weekOffset}`),
  submitResponse: (data) =>
    fetchAPI('/survey/responses', { method: 'POST', body: data }),
  submitBulkResponses: (data) =>
    fetchAPI('/survey/responses/bulk', { method: 'POST', body: data }),
  skipSurvey: (id) =>
    fetchAPI(`/survey/skip/${id}`, { method: 'POST' }),
  getSurveyStatus: () => fetchAPI('/survey/status'),

  // Calendar
  getCalendarSettings: () => fetchAPI('/calendar/settings'),
  saveCalendarSettings: (data) =>
    fetchAPI('/calendar/settings', { method: 'POST', body: data }),
  previewCalendarSync: (calendar_url) =>
    fetchAPI('/calendar/preview', { method: 'POST', body: { calendar_url } }),
  syncCalendar: (calendar_url) =>
    fetchAPI('/calendar/sync', { method: 'POST', body: { calendar_url } }),

  // Ingest
  parseFlightItinerary: (text, source = 'text') =>
    fetchAPI('/ingest/flight-itinerary', { method: 'POST', body: { text, source } }),
  confirmFlights: (flights) =>
    fetchAPI('/ingest/flight-itinerary/confirm', { method: 'POST', body: { flights } }),
  parseEmail: (data) =>
    fetchAPI('/ingest/email', { method: 'POST', body: data }),
  uploadPdf: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/ingest/pdf`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/ingest/image`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },
  getIngestHistory: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchAPI(`/ingest/history${query ? `?${query}` : ''}`);
  },
};

export default api;
