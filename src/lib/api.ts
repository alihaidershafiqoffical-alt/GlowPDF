/**
 * Glow PDF — Resilient API Client & URL Configuration
 *
 * Architecture:
 * - Local Development: Vite proxy forwards /api/* -> http://127.0.0.1:8000
 * - Production (Vercel Serverless): /api/* is served directly by Vercel Python functions on the same origin.
 * - Production (External Container): If VITE_API_BASE_URL is specified (e.g. Blitz / Cloud container),
 *   apiFetch attempts the external backend first, and automatically falls back to same-origin /api/*
 *   if the external backend is offline, unreachable, blocked by CORS, or returning an HTML error page.
 */

const CONFIGURED_API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/**
 * Returns the full URL for a given API path with optional base override.
 * @param path - Must start with '/api/', e.g. '/api/health'
 */
export function apiUrl(path: string, base: string = CONFIGURED_API_BASE): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

/**
 * Resilient API fetch that tries the configured backend URL first (if specified),
 * and automatically falls back to same-origin /api/... if the external backend is unreachable,
 * blocked by CORS, or returning an HTML error page (e.g., Cloudflare/Blitz 404/526 pages).
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // 1. If no external base URL is configured, perform direct same-origin fetch
  if (!CONFIGURED_API_BASE) {
    return fetch(normalizedPath, init);
  }

  // 2. If an external base URL is configured, try it first
  try {
    const primaryUrl = `${CONFIGURED_API_BASE}${normalizedPath}`;
    const response = await fetch(primaryUrl, init);

    // If response is successful or a valid API binary/JSON response, return it directly
    const contentType = response.headers.get('content-type') || '';
    if (
      response.ok ||
      contentType.includes('application/json') ||
      contentType.includes('application/pdf') ||
      contentType.includes('application/octet-stream') ||
      contentType.includes('application/vnd.openxmlformats-officedocument')
    ) {
      return response;
    }

    // If the external host returned an HTML error page (e.g., Cloudflare/Blitz gateway 404/526), fall back to same-origin
    if (contentType.includes('text/html')) {
      console.warn(
        `[GlowPDF API] External backend (${CONFIGURED_API_BASE}) returned HTML (${response.status}). Falling back to same-origin ${normalizedPath}`
      );
      return fetch(normalizedPath, init);
    }

    return response;
  } catch (err) {
    // Network error, DNS resolution error, SSL error, or CORS block on external host -> seamlessly fallback to same-origin
    console.warn(
      `[GlowPDF API] External backend (${CONFIGURED_API_BASE}) failed (${err instanceof Error ? err.message : String(err)}). Falling back to same-origin ${normalizedPath}`
    );
    return fetch(normalizedPath, init);
  }
}
