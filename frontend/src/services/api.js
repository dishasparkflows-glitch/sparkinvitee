import axios from 'axios';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
});

// Attach Authorization header if token exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to seamlessly unwrap ApiResponse while preserving metadata
api.interceptors.response.use(
  (response) => {
    if (
      response.data &&
      typeof response.data === 'object' &&
      response.data.success === true &&
      'data' in response.data
    ) {
      const envelope = response.data;
      const innerData = envelope.data;
      if (Array.isArray(innerData)) {
        innerData.data = innerData;
        innerData.message = envelope.message;
        if (envelope.pagination) innerData.pagination = envelope.pagination;
        response.data = innerData;
      } else if (innerData && typeof innerData === 'object') {
        innerData.data = innerData;
        innerData.message = envelope.message;
        response.data = innerData;
      } else {
        response.data = innerData;
      }
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export default api;
