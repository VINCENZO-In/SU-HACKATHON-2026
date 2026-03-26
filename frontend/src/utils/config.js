/**
 * Global Configuration for the Frontend
 * 
 * IMPORTANT: When testing on mobile or other devices on your local network:
 * 1. Find your computer's local IP address (e.g., 192.168.1.15).
 * 2. Replace 'localhost' with that IP address below.
 */

const SERVER_IP = 'localhost'; // Change this to your local IP for mobile testing

export const API_BASE_URL = `http://${SERVER_IP}:5001/api`;
export const ML_SERVICE_URL = `http://${SERVER_IP}:8000`;
export const WS_ML_URL = `ws://${SERVER_IP}:8000/ws/camera`;

export default {
  API_BASE_URL,
  ML_SERVICE_URL,
  WS_ML_URL
};
