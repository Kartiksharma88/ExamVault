const BASE_URL = '/api';

let csrfToken: string | null =
  (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('examvault_csrf') : null) ||
  (typeof localStorage !== 'undefined' ? localStorage.getItem('examvault_csrf') : null);

export function setCsrfToken(token: string | null) {
  csrfToken = token;
  if (token) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('examvault_csrf', token);
    if (typeof localStorage !== 'undefined') localStorage.setItem('examvault_csrf', token);
  } else {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('examvault_csrf');
    if (typeof localStorage !== 'undefined') localStorage.removeItem('examvault_csrf');
  }
}

export function getCsrfToken(): string | null {
  if (!csrfToken) {
    csrfToken =
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('examvault_csrf') : null) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('examvault_csrf') : null);
  }
  return csrfToken;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  let url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const activeCsrfToken = getCsrfToken();
  // Include CSRF token for non-GET/HEAD/OPTIONS methods
  if (activeCsrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(options.method?.toUpperCase() || 'GET')) {
    headers.set('X-CSRF-Token', activeCsrfToken);
  }

  const bearerToken = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (bearerToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${bearerToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // sends and receives httpOnly session cookie
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorData = null;
    try {
      errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
      if (Array.isArray(errorMessage)) {
        errorMessage = errorMessage.join(', ');
      }
    } catch {
      // not JSON
    }
    throw new ApiError(errorMessage, response.status, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return response.text() as unknown as T;
}
