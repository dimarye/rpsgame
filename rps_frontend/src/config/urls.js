// URL Configuration for Development
export const API_BASE_URL = "http://127.0.0.1:8000/api";
export const WS_BASE_URL = "ws://127.0.0.1:8000/ws";

// Test function to verify URLs
export const testUrls = () => {
  console.log('API Base URL:', API_BASE_URL);
  console.log('WebSocket Base URL:', WS_BASE_URL);
  
  // Test API URL construction
  const testApiUrl = `${API_BASE_URL}/auth/token/`;
  console.log('Test API URL:', testApiUrl);
  
  // Test WebSocket URL construction
  const testWsUrl = `${WS_BASE_URL}/match/123/?token=abc123`;
  console.log('Test WebSocket URL:', testWsUrl);
  
  return {
    apiUrl: testApiUrl,
    wsUrl: testWsUrl
  };
};
