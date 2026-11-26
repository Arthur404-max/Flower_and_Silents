import type {
  AdminAuthResponse,
  AdminCategory,
  AdminOrder,
  AdminOrderListResponse,
  AdminProduct,
  AdminProductInput,
  CartQuote,
  Category,
  CategoryInput,
  CreateOrderInput,
  CreateOrderResponse,
  DeliveryType,
  OrderView,
  ProductListResponse,
  ProductSort,
  ProductView,
  StoreConfig,
} from '../types';

const API_BASE = '/api/v1';
let csrfToken: string | null = null;
let refreshPromise: Promise<AdminAuthResponse> | null = null;

export class ApiError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly type?: string;

  constructor(message: string, status: number, requestId?: string, type?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
    this.type = type;
  }
}

interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  requestId?: string;
}

function searchParams(values: Record<string, string | number | null | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  return params;
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetails | null = null;
  try {
    problem = (await response.json()) as ProblemDetails;
  } catch {
    problem = null;
  }
  const fallback =
    response.status === 401
      ? 'Нужно войти в систему.'
      : response.status === 403
        ? 'Недостаточно прав для этого действия.'
        : response.status === 404
          ? 'Запрошенные данные не найдены.'
          : response.status >= 500
            ? 'Сервис временно недоступен. Попробуйте позже.'
            : 'Не удалось выполнить запрос.';
  return new ApiError(
    problem?.detail || problem?.title || fallback,
    problem?.status ?? response.status,
    problem?.requestId,
    problem?.type,
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function sendRequest<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    });
  } catch (error) {
    if (init.signal?.aborted) {
      throw error;
    }
    throw new ApiError('Не удалось связаться с сервером. Проверьте подключение и повторите попытку.', 0);
  }
  return parseResponse<T>(response);
}

function rememberSession(response: AdminAuthResponse): AdminAuthResponse {
  csrfToken = response.csrfToken;
  return response;
}

function refreshSession(): Promise<AdminAuthResponse> {
  refreshPromise ??= sendRequest<AdminAuthResponse>('/admin/auth/refresh', {
    method: 'POST',
  })
    .then(rememberSession)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function adminRequest<T>(
  path: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  try {
    return await sendRequest<T>(path, { ...init, headers });
  } catch (error) {
    const isAuthenticationPath = path === '/admin/auth/login' || path === '/admin/auth/refresh';
    if (
      !retryOnUnauthorized ||
      isAuthenticationPath ||
      !(error instanceof ApiError) ||
      error.status !== 401
    ) {
      throw error;
    }
    await refreshSession();
    return adminRequest<T>(path, init, false);
  }
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

export function getStoreConfig(signal?: AbortSignal): Promise<StoreConfig> {
  return sendRequest<StoreConfig>('/config', { signal });
}

export function getCategories(signal?: AbortSignal): Promise<Category[]> {
  return sendRequest<Category[]>('/categories', { signal });
}

export interface ProductQuery {
  q?: string;
  category?: string;
  sort?: ProductSort;
  cursor?: string | null;
  limit?: number;
}

export function getProducts(query: ProductQuery, signal?: AbortSignal): Promise<ProductListResponse> {
  const params = searchParams({ ...query });
  return sendRequest<ProductListResponse>(`/products?${params.toString()}`, { signal });
}

export function getProduct(slug: string, signal?: AbortSignal): Promise<ProductView> {
  return sendRequest<ProductView>(`/products/${encodeURIComponent(slug)}`, { signal });
}

export function quoteCart(
  items: Array<{ productId: string; quantity: number }>,
  deliveryType: DeliveryType,
  signal?: AbortSignal,
): Promise<CartQuote> {
  return sendRequest<CartQuote>('/cart/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, deliveryType }),
    signal,
  });
}

export function createOrder(input: CreateOrderInput, idempotencyKey: string): Promise<CreateOrderResponse> {
  return sendRequest<CreateOrderResponse>('/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(input),
  });
}

export function getOrder(number: string, token: string, signal?: AbortSignal): Promise<{ order: OrderView }> {
  const params = searchParams({ token });
  return sendRequest<{ order: OrderView }>(`/orders/${encodeURIComponent(number)}?${params.toString()}`, {
    signal,
  });
}

export function payDemoOrder(number: string, token: string, idempotencyKey: string): Promise<{ order: OrderView }> {
  return sendRequest<{ order: OrderView }>(`/orders/${encodeURIComponent(number)}/payments/demo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ token }),
  });
}

export async function adminLogin(email: string, password: string): Promise<AdminAuthResponse> {
  const response = await adminRequest<AdminAuthResponse>(
    '/admin/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    false,
  );
  return rememberSession(response);
}

export async function getAdminMe(signal?: AbortSignal): Promise<AdminAuthResponse> {
  const response = await adminRequest<AdminAuthResponse>('/admin/auth/me', { signal });
  return rememberSession(response);
}

export function refreshAdminSession(): Promise<AdminAuthResponse> {
  return refreshSession();
}

export async function adminLogout(): Promise<void> {
  await adminRequest<void>('/admin/auth/logout', { method: 'POST' });
  clearCsrfToken();
}

export function changeAdminPassword(currentPassword: string, newPassword: string): Promise<void> {
  return adminRequest<void>('/admin/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function getAdminProducts(q: string, signal?: AbortSignal): Promise<AdminProduct[]> {
  const params = searchParams({ q: q.trim() });
  return adminRequest<AdminProduct[]>(`/admin/products?${params.toString()}`, { signal });
}

export function createAdminProduct(input: AdminProductInput): Promise<AdminProduct> {
  return adminRequest<AdminProduct>('/admin/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateAdminProduct(id: string, input: AdminProductInput, expectedVersion: number): Promise<AdminProduct> {
  return adminRequest<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, expectedVersion }),
  });
}

export function archiveAdminProduct(id: string): Promise<{ id: string; isActive: boolean }> {
  return adminRequest<{ id: string; isActive: boolean }>(`/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function getAdminCategories(signal?: AbortSignal): Promise<AdminCategory[]> {
  return adminRequest<AdminCategory[]>('/admin/categories', { signal });
}

export function createAdminCategory(input: CategoryInput): Promise<AdminCategory> {
  return adminRequest<AdminCategory>('/admin/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateAdminCategory(id: string, input: CategoryInput): Promise<AdminCategory> {
  return adminRequest<AdminCategory>(`/admin/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deactivateAdminCategory(id: string): Promise<AdminCategory> {
  return adminRequest<AdminCategory>(`/admin/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: false }),
  });
}

export async function uploadAdminImage(file: File): Promise<{ imageUrl: string }> {
  const body = new FormData();
  body.append('image', file);
  return adminRequest<{ imageUrl: string }>('/admin/uploads', { method: 'POST', body });
}

export interface AdminOrderQuery {
  q?: string;
  status?: string;
  cursor?: string | null;
  limit?: number;
}

export function getAdminOrders(
  query: AdminOrderQuery,
  signal?: AbortSignal,
): Promise<AdminOrderListResponse> {
  const params = searchParams({ ...query });
  return adminRequest<AdminOrderListResponse>(`/admin/orders?${params.toString()}`, { signal });
}

export function getAdminOrder(id: string, signal?: AbortSignal): Promise<AdminOrder> {
  return adminRequest<AdminOrder>(`/admin/orders/${encodeURIComponent(id)}`, { signal });
}

export function updateAdminOrderStatus(
  id: string,
  version: number,
  status: string,
  comment?: string,
): Promise<AdminOrder> {
  return adminRequest<AdminOrder>(`/admin/orders/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'If-Match': String(version) },
    body: JSON.stringify({ status, comment: comment?.trim() || undefined }),
  });
}
