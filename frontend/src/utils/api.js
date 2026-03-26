import axios from 'axios';
import { API_BASE_URL } from './config';

const isProd = process.env.NODE_ENV === 'production';
const API = axios.create({ baseURL: isProd ? '/api' : API_BASE_URL });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('wm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('wm_token');
      localStorage.removeItem('wm_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default API;
