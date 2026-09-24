// API Configuration & Safe Fetch for Web and Android APK

// Default Cloud Server URL on Render
export const DEFAULT_SERVER_URL = 'https://attendance-r69o.onrender.com';

export function getApiBaseUrl() {
  const saved = localStorage.getItem('edutrack_server_url');
  if (saved && saved.trim()) {
    const trimmed = saved.trim().replace(/\/$/, '');
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
  }

  // Detect if running in native mobile (Capacitor)
  const isCapacitor = typeof window !== 'undefined' && (
    window.Capacitor !== undefined || 
    window.location.protocol === 'capacitor:' || 
    (window.location.hostname === 'localhost' && window.location.port !== '5173')
  );

  if (isCapacitor) {
    return DEFAULT_SERVER_URL;
  }

  // Web running with Vite proxy or same-origin
  return '';
}

export function setApiBaseUrl(url) {
  if (!url || url.trim() === '') {
    localStorage.removeItem('edutrack_server_url');
  } else {
    localStorage.setItem('edutrack_server_url', url.trim().replace(/\/$/, ''));
  }
}

/**
 * Robust fetch wrapper that handles:
 * 1. Prepending correct server URL on mobile and web
 * 2. 45-second timeout to allow Render free tier servers to wake from cold sleep
 * 3. Clear, actionable error messages
 */
export async function apiFetch(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s for Render wake up

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // Check if the response is actually JSON
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error(
          `Cannot reach backend API at ${baseUrl || window.location.origin}. If using Render free tier, wait 20s for the cloud instance to wake up.`
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
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(
        `Connection timed out to ${baseUrl || 'server'}. Render free tier cloud servers take ~30-50s to wake up on first access. Please retry now.`
      );
    }
    if (err.message && err.message.includes('Failed to fetch')) {
      throw new Error(
        `Connection failed to ${baseUrl || 'cloud server'}. Please check internet connection or tap the Server Config icon in the top right to verify server URL.`
      );
    }
    throw err;
  }
}
