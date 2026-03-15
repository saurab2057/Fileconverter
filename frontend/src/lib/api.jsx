//lib/api.jsx
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true, // Crucial for sending the httpOnly cookie
});

export default apiClient;