import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App.jsx';

// Axios response interceptor to seamlessly unwrap ApiResponse while preserving metadata
axios.interceptors.response.use(
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
