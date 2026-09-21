// API Configuration & Safe Fetch for Web and Android APK

// Default Cloud Server URL on Render
export const DEFAULT_SERVER_URL = 'https://attendance-r69o.onrender.com';

export function getApiBaseUrl() {
  const saved = localStorage.getItem('edutrack_server_url');
  if (saved) return saved.trim().replace(/\/$/, '');

  // Detect if running in native mobile (Capacitor)
  const isCapacitor = window.Capacitor !== undefined || 
                      window.location.protocol === 'capacitor:' || 
                      (window.location.hostname === 'localhost' && window.location.port !== '5173');

  if (isCapacitor) {
    return DEFAULT_SERVER_URL;
  }

  // Web running with Vite proxy
  return '';
}

export function setApiBaseUrl(url) {
  if (!url) {
    localStorage.removeItem('edutrack_server_url');
  } else {
    localStorage.setItem('edutrack_server_url', url.trim().replace(/\/$/, ''));
  }
}

/**
 * Robust fetch wrapper that handles:
 * 1. Prepending the correct server IP/URL on mobile and web
 * 2. Catching non-JSON responses (like HTML 404/index.html) and providing a friendly error
 */
export async function apiFetch(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  try {
    const res = await fetch(url, options);

    // Check if the response is actually JSON
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // It's likely returning HTML (e.g. Capacitor fallback index.html or 404 page)
      const text = await res.text();
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error(
          `Cannot reach backend server at ${baseUrl || window.location.origin}. Please ensure the server is running and your device is on the same Wi-Fi network.`
        );
      }
      throw new Error(text || `Server returned non-JSON response (${res.status})`);
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (err) {
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error(
        `Connection failed to ${baseUrl || 'server'}. Ensure backend is running and phone is connected to Wi-Fi.`
      );
    }
    throw err;
  }
}
