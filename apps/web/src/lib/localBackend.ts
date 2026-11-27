import { ORDER_STATUSES, type OrderStatus, type ProductView } from '@cvetotishina/shared';
import type {
  AdminAuthResponse,
  AdminCategory,
  AdminOrderListResponse,
  AdminProduct,
  CartQuote,
  Category,
  CreateOrderResponse,
  DeliveryType,
  OrderView,
  ProductListResponse,
  StoreConfig,
} from '../types';
import {
  createInitialState,
  normalizeSearchText,
  type LocalAuditEntry,
  type LocalCategory,
  type LocalIdempotencyRecord,
  type LocalOrder,
  type LocalProduct,
  type LocalState,
} from './localSeed';

const STATE_KEY = 'cvetotishina.pages.v1.state';
const SESSION_KEY = 'cvetotishina.pages.v1.admin-session';
const ORDER_TOKEN_PREFIX = 'cvetotishina.pages.v1.order-token.';
const DELIVERY_FEE = 290_000;
const FREE_DELIVERY_FROM = 500_000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const IDEMPOTENCY_KEY_PATTERN = /^[a-zA-Z0-9-]{8,100}$/;
const ORDER_STATUS_SET = new Set<string>(ORDER_STATUSES);
const memoryOrderTokens = new Map<string, string>();

interface LocalSession {
  token: string;
  csrfToken: string;
  userId: string;
  sessionEpoch: number;
  expiresAt: number;
}

interface ProductFields {
  name: string;
  categoryId: string;
  description: string;
  composition: string;
  size: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  badge: string | null;
  imageUrl: string;
}

class LocalProblem extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly problemKind?: string,
  ) {
    super(message);
    this.name = 'LocalProblem';
  }
}

function fail(status: number, message: string, problemKind?: string): never {
  throw new LocalProblem(status, message, problemKind);
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

function randomId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return Array.from(randomBytes(16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
  const bytes = randomBytes(32);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomHex(length: number): string {
  return Array.from(randomBytes(length), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: string; code?: number; message?: string };
  return value.name === 'QuotaExceededError'
    || value.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || value.code === 22
    || value.code === 1014
    || Boolean(value.message?.toLowerCase().includes('quota'));
}

let fallbackState: LocalState | null = null;

function isLocalState(value: unknown): value is LocalState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<LocalState>;
  return state.schemaVersion === 1
    && Array.isArray(state.categories)
    && Array.isArray(state.products)
    && Array.isArray(state.orders)
    && Array.isArray(state.audit)
    && Boolean(state.idempotency && typeof state.idempotency === 'object')
    && Boolean(state.admin && typeof state.admin.email === 'string' && typeof state.admin.password === 'string')
    && typeof state.sessionEpoch === 'number';
}

function loadState(): LocalState {
  try {
    const stored = localStorage.getItem(STATE_KEY);
    if (stored === null) {
      const initial = createInitialState();
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify(initial));
      } catch (error) {
        if (isQuotaError(error)) {
          fail(507, 'Недостаточно места в браузере для локального каталога.', 'storage-full');
        }
      }
      fallbackState = initial;
      return snapshot(initial);
    }
    const parsed: unknown = JSON.parse(stored);
    if (!isLocalState(parsed)) {
      fail(500, 'Локальные данные повреждены. Очистите данные сайта и повторите.', 'invalid-state');
    }
    const powder = parsed.products.find((item) => item.slug === 'pudrovyy-briz');
    if (powder && powder.imageUrl === '/images/peonies.jpg') {
      powder.imageUrl = '/images/powder.jpg';
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify(parsed));
      } catch {
        // Ignore storage quota issues during non-essential image migration.
      }
    }
    fallbackState = parsed;
    return snapshot(parsed);
  } catch (error) {
    if (error instanceof LocalProblem) throw error;
    if (fallbackState) return snapshot(fallbackState);
    fallbackState = createInitialState();
    return snapshot(fallbackState);
  }
}

function commitState(state: LocalState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    fallbackState = snapshot(state);
  } catch (error) {
    if (isQuotaError(error)) {
      fail(507, 'Недостаточно места в браузере. Удалите крупные изображения или освободите хранилище.', 'storage-full');
    }
    // The current page remains usable when browser storage is blocked entirely.
    fallbackState = snapshot(state);
  }
}

let fallbackSession: LocalSession | null = null;

function loadSession(): LocalSession | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return fallbackSession ? { ...fallbackSession } : null;
    const parsed = JSON.parse(stored) as Partial<LocalSession>;
    if (
      typeof parsed.token !== 'string'
      || typeof parsed.csrfToken !== 'string'
      || typeof parsed.userId !== 'string'
      || typeof parsed.sessionEpoch !== 'number'
      || typeof parsed.expiresAt !== 'number'
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    fallbackSession = parsed as LocalSession;
    return { ...fallbackSession };
  } catch {
    return fallbackSession ? { ...fallbackSession } : null;
  }
}

function saveSession(session: LocalSession): void {
  fallbackSession = session;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Session access still works for this page when storage is blocked.
  }
}

function clearSession(): void {
  fallbackSession = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing else is required when storage is blocked.
  }
}

function header(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name);
}

function requireAdmin(init: RequestInit, checkCsrf: boolean): { state: LocalState; session: LocalSession } {
  const session = loadSession();
  if (!session || session.expiresAt <= Date.now()) {
    clearSession();
    fail(401, 'Сессия истекла. Войдите снова.', 'session-expired');
  }
  const state = loadState();
  if (session.userId !== state.admin.id || session.sessionEpoch !== state.sessionEpoch) {
    clearSession();
    fail(401, 'Сессия истекла. Войдите снова.', 'session-expired');
  }
  if (checkCsrf && header(init, 'X-CSRF-Token') !== session.csrfToken) {
    fail(403, 'Неверный CSRF-токен. Обновите страницу и повторите.', 'invalid-csrf');
  }
  return { state, session };
}

function authResponse(state: LocalState, session: LocalSession): AdminAuthResponse {
  return {
    user: { id: state.admin.id, email: state.admin.email, name: state.admin.name },
    csrfToken: session.csrfToken,
  };
}

function startSession(state: LocalState): LocalSession {
  const session: LocalSession = {
    token: randomToken(),
    csrfToken: randomToken(),
    userId: state.admin.id,
    sessionEpoch: state.sessionEpoch,
    expiresAt: Date.now() + 7 * 86_400_000,
  };
  saveSession(session);
  return session;
}

function addAudit(
  state: LocalState,
  adminId: string,
  action: string,
  entity: string,
  entityId: string,
  details: Record<string, unknown> = {},
  createdAt = new Date().toISOString(),
): void {
  const entry: LocalAuditEntry = {
    id: randomId(),
    adminId,
    action,
    entity,
    entityId,
    details,
    createdAt,
  };
  state.audit.push(entry);
}

function waitForLatency(signal?: AbortSignal): Promise<void> {
  const milliseconds = 120 + Math.floor(Math.random() * 131);
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Запрос отменён', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Запрос отменён', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function noContent(): Response {
  return new Response(null, { status: 204 });
}

function problemResponse(problem: LocalProblem): Response {
  const titles: Record<number, string> = {
    400: 'Некорректный запрос',
    401: 'Требуется авторизация',
    403: 'Доступ запрещён',
    404: 'Данные не найдены',
    405: 'Метод не поддерживается',
    409: 'Конфликт данных',
    500: 'Ошибка локальных данных',
    507: 'Хранилище переполнено',
  };
  const kind = problem.problemKind ?? `error-${problem.status}`;
  return new Response(JSON.stringify({
    type: `https://cvetotishina.local/problems/${kind}`,
    title: titles[problem.status] ?? 'Ошибка запроса',
    status: problem.status,
    detail: problem.message,
    requestId: randomId(),
  }), {
    status: problem.status,
    headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
  });
}

function requireMethod(method: string, allowed: string[]): void {
  if (!allowed.includes(method)) {
    fail(405, 'Этот метод не поддерживается.', 'method-not-allowed');
  }
}

function readBody(init: RequestInit): Record<string, unknown> {
  if (typeof init.body !== 'string') fail(400, 'Ожидается JSON-тело запроса.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(init.body);
  } catch {
    fail(400, 'Некорректный JSON в запросе.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(400, 'Ожидается JSON-объект.');
  }
  return parsed as Record<string, unknown>;
}

function requiredText(value: unknown, max: number, label: string, min = 1): string {
  if (typeof value !== 'string') fail(400, `${label}: обязательно текстовое значение.`);
  const text = value.trim();
  if (text.length < min || text.length > max) {
    fail(400, min === 1 ? `${label}: обязательно непустое значение, не более ${max} символов.` : `${label}: укажите от ${min} до ${max} символов.`);
  }
  return text;
}

function optionalText(value: unknown, max: number, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') fail(400, `${label}: ожидается строка.`);
  const text = value.trim();
  if (text.length > max) fail(400, `${label}: не более ${max} символов.`);
  return text || null;
}

function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    fail(400, `${label}: укажите целое число от ${min} до ${max}.`);
  }
  return value;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(400, `${label}: ожидается логическое значение.`);
  return value;
}

function deliveryType(value: unknown): DeliveryType {
  if (value !== 'PICKUP' && value !== 'DELIVERY') {
    fail(400, 'Выберите доставку или самовывоз.');
  }
  return value;
}

function orderStatus(value: unknown): OrderStatus {
  if (typeof value !== 'string' || !ORDER_STATUS_SET.has(value)) {
    fail(400, 'Указан неизвестный статус заказа.');
  }
  return value as OrderStatus;
}

function normalizeCart(value: unknown): Array<{ productId: string; quantity: number }> {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) {
    fail(400, 'Корзина должна содержать от 1 до 50 позиций.');
  }
  const quantities = new Map<string, number>();
  value.forEach((line) => {
    if (!line || typeof line !== 'object') fail(400, 'Некорректная позиция корзины.');
    const item = line as { productId?: unknown; quantity?: unknown };
    if (typeof item.productId !== 'string' || !item.productId) {
      fail(400, 'В корзине указан товар без идентификатора.');
    }
    const quantity = integer(item.quantity, 1, 20, 'Количество товара');
    const total = (quantities.get(item.productId) ?? 0) + quantity;
    if (total > 20) fail(400, 'Не более 20 единиц одного товара.');
    quantities.set(item.productId, total);
  });
  return Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }));
}

function categoryView(category: LocalCategory): Category {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
  };
}

function adminCategoryView(category: LocalCategory): AdminCategory {
  return { ...categoryView(category), isActive: category.isActive, version: category.version };
}

function productView(product: LocalProduct): ProductView {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    composition: product.composition,
    size: product.size,
    price: product.price,
    oldPrice: product.oldPrice,
    imageUrl: product.imageUrl,
    badge: product.badge,
    stock: product.stock,
    categoryId: product.categoryId,
    category: { ...product.category },
  };
}

function adminProductView(product: LocalProduct): AdminProduct & { createdAt: string; updatedAt: string } {
  return {
    ...productView(product),
    isActive: product.isActive,
    version: product.version,
    archivedAt: product.archivedAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function orderView(order: LocalOrder): OrderView {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    paymentStatus: order.paymentStatus,
    customerName: order.customerName,
    phone: order.phone,
    email: order.email,
    deliveryType: order.deliveryType,
    address: order.address,
    comment: order.comment,
    utensils: order.utensils,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    serviceFee: order.serviceFee,
    total: order.total,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    version: order.version,
    items: order.items.map((item) => ({ ...item })),
    history: order.history.map((entry) => ({ ...entry })),
  } as OrderView;
}

function calculateQuote(state: LocalState, items: unknown, selectedDelivery: unknown): CartQuote {
  const lines = normalizeCart(items);
  const type = deliveryType(selectedDelivery ?? 'PICKUP');
  const quoteItems = lines.map((line) => {
    const product = state.products.find((item) => item.id === line.productId);
    const category = product ? state.categories.find((item) => item.id === product.categoryId) : null;
    if (!product || !product.isActive || !category?.isActive) {
      fail(404, 'Один из товаров больше недоступен.', 'product-unavailable');
    }
    if (product.stock < line.quantity) {
      fail(409, `«${product.name}»: доступно ${product.stock} шт.`, 'insufficient-stock');
    }
    return {
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      unitPrice: product.price,
      quantity: line.quantity,
      lineTotal: product.price * line.quantity,
      stock: product.stock,
    };
  });
  const subtotal = quoteItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const fee = type === 'DELIVERY' && subtotal < FREE_DELIVERY_FROM ? DELIVERY_FEE : 0;
  return {
    items: quoteItems,
    subtotal,
    deliveryFee: fee,
    serviceFee: 0,
    total: subtotal + fee,
  };
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(object).sort().map((key) => [key, canonicalJson(object[key])]));
  }
  return value;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(canonicalJson(value));
}

function requireIdempotencyKey(init: RequestInit): string {
  const key = header(init, 'Idempotency-Key');
  if (!key || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    fail(400, 'Idempotency-Key обязателен (8–100 символов).', 'idempotency-key-required');
  }
  return key;
}

function replayKey(scope: string, key: string): string {
  return `${scope}:${key}`;
}

function findReplay<T>(state: LocalState, scope: string, key: string, requestFingerprint: string): T | null {
  const record = state.idempotency[replayKey(scope, key)];
  if (!record) return null;
  if (record.requestFingerprint !== requestFingerprint) {
    fail(409, 'Этот ключ уже использован для другого запроса.', 'idempotency-conflict');
  }
  return snapshot(record.response) as T;
}

function rememberReplay(
  state: LocalState,
  scope: string,
  key: string,
  requestFingerprint: string,
  response: unknown,
): void {
  const record: LocalIdempotencyRecord = {
    scope,
    key,
    requestFingerprint,
    response: snapshot(response),
  };
  state.idempotency[replayKey(scope, key)] = record;
}

function saveOrderToken(number: string, token: string): void {
  const key = `${ORDER_TOKEN_PREFIX}${encodeURIComponent(number)}`;
  memoryOrderTokens.set(key, token);
  try {
    localStorage.setItem(key, token);
  } catch {
    // The API response and the page-level token helper remain available.
  }
}

function createOrderNumber(state: LocalState): string {
  const date = new Date().toISOString().slice(2, 10).replaceAll('-', '');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const number = `CT-${date}-${randomHex(3)}`;
    if (!state.orders.some((order) => order.number === number)) return number;
  }
  fail(409, 'Не удалось выделить номер заказа. Повторите попытку.', 'order-number-conflict');
}

function createOrder(state: LocalState, body: Record<string, unknown>, key: string): CreateOrderResponse {
  const requestFingerprint = fingerprint(body);
  const replay = findReplay<CreateOrderResponse>(state, 'order:create', key, requestFingerprint);
  if (replay) return replay;

  const type = deliveryType(body.deliveryType ?? 'PICKUP');
  const customerName = requiredText(body.customerName, 120, 'Имя получателя', 2);
  const phone = requiredText(body.phone, 20, 'Телефон');
  if (!/^\+?[0-9\s()-]{10,20}$/.test(phone)) {
    fail(400, 'Проверьте номер телефона: используйте от 10 до 20 символов, цифр, пробелов, скобок, плюса и дефиса.');
  }
  const email = optionalText(body.email, 200, 'Email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail(400, 'Укажите корректный email.');
  }
  const address = type === 'DELIVERY' ? requiredText(body.address, 300, 'Адрес доставки') : null;
  const comment = optionalText(body.comment, 1000, 'Комментарий');
  const utensils = body.utensils === undefined ? false : booleanValue(body.utensils, 'Приборы');
  const quote = calculateQuote(state, body.items, type);
  const now = new Date().toISOString();
  const order: LocalOrder = {
    id: randomId(),
    number: createOrderNumber(state),
    status: 'AWAITING_PAYMENT',
    paymentStatus: 'PENDING',
    customerName,
    phone,
    email: email?.toLowerCase() ?? null,
    deliveryType: type,
    address,
    comment,
    utensils,
    subtotal: quote.subtotal,
    deliveryFee: quote.deliveryFee,
    serviceFee: quote.serviceFee,
    total: quote.total,
    createdAt: now,
    paidAt: null,
    version: 1,
    items: quote.items.map((item) => ({
      id: randomId(),
      productId: item.productId,
      name: item.name,
      imageUrl: item.imageUrl,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    history: [{
      id: randomId(),
      fromStatus: null,
      toStatus: 'AWAITING_PAYMENT',
      comment: 'Заказ создан',
      actorType: 'CUSTOMER',
      createdAt: now,
    }],
    accessToken: randomToken(),
  };

  quote.items.forEach((item) => {
    const product = state.products.find((candidate) => candidate.id === item.productId)!;
    product.stock -= item.quantity;
    product.version += 1;
    product.updatedAt = now;
  });
  state.orders.unshift(order);
  const response: CreateOrderResponse = { order: orderView(order), accessToken: order.accessToken };
  rememberReplay(state, 'order:create', key, requestFingerprint, response);
  commitState(state);
  saveOrderToken(order.number, order.accessToken);
  return response;
}

function findPublicOrder(state: LocalState, number: string, token: unknown): LocalOrder {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) {
    fail(400, 'Токен доступа к заказу обязателен.', 'order-token-required');
  }
  const order = state.orders.find((item) => item.number === number && item.accessToken === token);
  if (!order) {
    fail(404, 'Заказ не найден или ссылка доступа недействительна.', 'order-not-found');
  }
  return order;
}

function payOrder(state: LocalState, number: string, body: Record<string, unknown>, key: string): { order: OrderView } {
  const requestFingerprint = fingerprint(body);
  const replay = findReplay<{ order: OrderView }>(state, `payment:${number}`, key, requestFingerprint);
  if (replay) return replay;

  const order = findPublicOrder(state, number, body.token);
  if (order.paymentStatus !== 'PAID') {
    if (
      (order.status !== 'AWAITING_PAYMENT' && order.status !== 'PAYMENT_FAILED')
      || (order.paymentStatus !== 'PENDING' && order.paymentStatus !== 'FAILED')
    ) {
      fail(409, 'Этот заказ нельзя оплатить.', 'payment-not-allowed');
    }
    const now = new Date().toISOString();
    const fromStatus = order.status;
    order.status = 'NEW';
    order.paymentStatus = 'PAID';
    order.paidAt = now;
    order.version += 1;
    order.history.push({
      id: randomId(),
      fromStatus,
      toStatus: 'NEW',
      comment: 'Оплата подтверждена',
      actorType: 'PAYMENT',
      createdAt: now,
    });
  }
  const response = { order: orderView(order) };
  rememberReplay(state, `payment:${number}`, key, requestFingerprint, response);
  commitState(state);
  return response;
}

function paginate<T extends { id: string }>(items: T[], cursor: string | null, limit: number): { items: T[]; nextCursor: string | null } {
  const start = cursor ? items.findIndex((item) => item.id === cursor) + 1 : 0;
  if (cursor && start === 0) fail(400, 'Параметр страницы устарел. Начните выбор заново.', 'invalid-cursor');
  const page = items.slice(start, start + limit);
  return {
    items: page,
    nextCursor: start + limit < items.length ? page.at(-1)?.id ?? null : null,
  };
}

function listProducts(state: LocalState, params: URLSearchParams): ProductListResponse {
  const sort = params.get('sort') ?? 'popular';
  if (!['popular', 'price-asc', 'price-desc', 'newest'].includes(sort)) {
    fail(400, 'Указан неизвестный способ сортировки.');
  }
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? 12 : integer(Number(rawLimit), 1, 24, 'Лимит товаров');
  const query = normalizeSearchText(params.get('q') ?? '');
  const category = params.get('category') ?? '';
  const products = state.products.filter((product) => {
    const productCategory = state.categories.find((item) => item.id === product.categoryId);
    return product.isActive
      && Boolean(productCategory?.isActive)
      && (!category || product.category.slug === category || product.categoryId === category)
      && (!query || product.searchText.includes(query));
  });
  products.sort((left, right) => {
    if (sort === 'price-asc') return left.price - right.price || left.id.localeCompare(right.id);
    if (sort === 'price-desc') return right.price - left.price || left.id.localeCompare(right.id);
    if (sort === 'newest') {
      return Date.parse(right.createdAt) - Date.parse(left.createdAt) || left.id.localeCompare(right.id);
    }
    return right.stock - left.stock
      || Date.parse(right.createdAt) - Date.parse(left.createdAt)
      || left.id.localeCompare(right.id);
  });
  const page = paginate(products, params.get('cursor'), limit);
  return { items: page.items.map(productView), nextCursor: page.nextCursor };
}

function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  const flow: OrderStatus[] = ['AWAITING_PAYMENT', 'NEW', 'ASSEMBLING', 'DELIVERING', 'DELIVERED'];
  const fromIndex = flow.indexOf(from);
  const toIndex = flow.indexOf(to);
  if (fromIndex >= 0 && toIndex === fromIndex + 1) return true;
  if (to === 'PAYMENT_FAILED' && from === 'AWAITING_PAYMENT') return true;
  return to === 'CANCELLED' && ['AWAITING_PAYMENT', 'NEW', 'ASSEMBLING', 'PAYMENT_FAILED'].includes(from);
}

function listAdminOrders(state: LocalState, params: URLSearchParams): AdminOrderListResponse {
  const rawStatus = params.get('status');
  const status = rawStatus ? orderStatus(rawStatus) : null;
  const query = normalizeSearchText(params.get('q') ?? '');
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? 20 : integer(Number(rawLimit), 1, 50, 'Лимит заказов');
  const orders = state.orders.filter((order) => {
    const matchesQuery = !query || normalizeSearchText(`${order.number} ${order.customerName} ${order.phone}`).includes(query);
    return (!status || order.status === status) && matchesQuery;
  });
  orders.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id.localeCompare(left.id));
  const page = paginate(orders, params.get('cursor'), limit);
  return {
    items: page.items.map(orderView),
    nextCursor: page.nextCursor,
    total: orders.length,
  };
}

function updateOrderStatus(
  state: LocalState,
  adminId: string,
  id: string,
  init: RequestInit,
): OrderView {
  const rawVersion = header(init, 'If-Match');
  const version = rawVersion === null ? Number.NaN : Number(rawVersion);
  if (!Number.isInteger(version) || version < 1) {
    fail(409, 'Требуется заголовок If-Match с версией заказа.', 'version-required');
  }
  const order = state.orders.find((item) => item.id === id);
  if (!order) fail(404, 'Заказ не найден.', 'order-not-found');
  if (order.version !== version) fail(409, 'Заказ уже изменён. Обновите данные.', 'version-conflict');
  const body = readBody(init);
  const status = orderStatus(body.status);
  const comment = optionalText(body.comment, 500, 'Комментарий');
  if (!canTransition(order.status, status)) {
    fail(409, `Переход «${order.status}» → «${status}» недопустим.`, 'invalid-transition');
  }
  const fromStatus = order.status;
  const now = new Date().toISOString();
  if (status === 'CANCELLED') {
    order.items.forEach((item) => {
      const product = state.products.find((candidate) => candidate.id === item.productId);
      if (product) {
        product.stock += item.quantity;
        product.version += 1;
        product.updatedAt = now;
      }
    });
    if (order.paymentStatus === 'PAID') order.paymentStatus = 'REFUNDED';
  }
  order.status = status;
  order.version += 1;
  order.history.push({
    id: randomId(),
    fromStatus,
    toStatus: status,
    comment,
    actorType: 'ADMIN',
    createdAt: now,
  });
  addAudit(state, adminId, 'UPDATE_ORDER_STATUS', 'Order', order.id, { from: fromStatus, to: status, comment });
  commitState(state);
  return orderView(order);
}

const transliteration: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function slugify(value: string): string {
  const slug = value
    .toLocaleLowerCase('ru-RU')
    .split('')
    .map((character) => transliteration[character] ?? character)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return slug || 'item';
}

function uniqueProductSlug(state: LocalState, name: string): string {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;
  while (state.products.some((product) => product.slug === candidate)) {
    const addition = `-${suffix}`;
    candidate = `${base.slice(0, 90 - addition.length)}${addition}`;
    suffix += 1;
  }
  return candidate;
}

function validateImageUrl(value: unknown): string {
  const imageUrl = requiredText(value, Number.MAX_SAFE_INTEGER, 'Изображение');
  const isDataUrl = /^data:image\/(?:jpeg|png|webp);base64,/i.test(imageUrl);
  if (isDataUrl) return imageUrl;
  if (
    imageUrl.length > 500
    || !/^(\/images\/|\/uploads\/|https:\/\/)/.test(imageUrl)
  ) {
    fail(400, 'Изображение должно быть загружено или иметь допустимый URL.');
  }
  return imageUrl;
}

function productFields(state: LocalState, body: Record<string, unknown>, current?: LocalProduct): ProductFields {
  const name = body.name === undefined && current ? current.name : requiredText(body.name, 120, 'Название товара');
  const categoryId = body.categoryId === undefined && current ? current.categoryId : requiredText(body.categoryId, 100, 'Категория');
  if (!state.categories.some((category) => category.id === categoryId)) {
    fail(404, 'Категория не найдена.', 'category-not-found');
  }
  const description = body.description === undefined && current
    ? current.description
    : optionalText(body.description, 2000, 'Описание') ?? '';
  const composition = body.composition === undefined && current
    ? current.composition
    : requiredText(body.composition, 1000, 'Состав');
  const size = body.size === undefined && current ? current.size : requiredText(body.size, 100, 'Размер');
  const priceValue = body.price === undefined && current ? current.price / 100 : body.price;
  const oldPriceValue = body.oldPrice === undefined && current ? current.oldPrice : body.oldPrice;
  const price = integer(priceValue, 0, 10_000_000, 'Цена') * 100;
  const oldPrice = oldPriceValue === undefined || oldPriceValue === null
    ? null
    : integer(oldPriceValue, 0, 10_000_000, 'Старая цена') * 100;
  const stock = body.stock === undefined && current
    ? current.stock
    : integer(body.stock, 0, 100_000, 'Остаток');
  const badge = body.badge === undefined && current ? current.badge : optionalText(body.badge, 30, 'Badge');
  const imageUrl = body.imageUrl === undefined && current ? current.imageUrl : validateImageUrl(body.imageUrl);
  return { name, categoryId, description, composition, size, price, oldPrice, stock, badge, imageUrl };
}

function createAdminProduct(state: LocalState, adminId: string, body: Record<string, unknown>): LocalProduct {
  const fields = productFields(state, body);
  const category = state.categories.find((item) => item.id === fields.categoryId)!;
  const now = new Date().toISOString();
  const product: LocalProduct = {
    ...fields,
    id: randomId(),
    slug: uniqueProductSlug(state, fields.name),
    category: { id: category.id, name: category.name, slug: category.slug },
    searchText: normalizeSearchText(`${fields.name} ${fields.description} ${fields.composition}`),
    isActive: true,
    version: 1,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  state.products.push(product);
  addAudit(state, adminId, 'CREATE_PRODUCT', 'Product', product.id);
  return product;
}

function updateAdminProduct(state: LocalState, adminId: string, id: string, body: Record<string, unknown>): LocalProduct {
  const current = state.products.find((product) => product.id === id);
  if (!current) fail(404, 'Товар не найден.', 'product-not-found');
  const expectedVersion = integer(body.expectedVersion, 1, Number.MAX_SAFE_INTEGER, 'Версия товара');
  if (current.version !== expectedVersion) {
    fail(409, 'Товар уже изменён. Обновите данные перед сохранением.', 'version-conflict');
  }
  const fields = productFields(state, body, current);
  const isActive = body.isActive === undefined ? current.isActive : booleanValue(body.isActive, 'Активность товара');
  const category = state.categories.find((item) => item.id === fields.categoryId)!;
  const now = new Date().toISOString();
  Object.assign(current, fields, {
    category: { id: category.id, name: category.name, slug: category.slug },
    searchText: normalizeSearchText(`${fields.name} ${fields.description} ${fields.composition}`),
    isActive,
    archivedAt: isActive ? null : current.archivedAt ?? now,
    version: current.version + 1,
    updatedAt: now,
  });
  addAudit(state, adminId, 'UPDATE_PRODUCT', 'Product', current.id);
  return current;
}

function toggleProduct(state: LocalState, adminId: string, id: string): { id: string; isActive: boolean } {
  const product = state.products.find((item) => item.id === id);
  if (!product) fail(404, 'Товар не найден.', 'product-not-found');
  product.isActive = !product.isActive;
  product.archivedAt = product.isActive ? null : new Date().toISOString();
  product.version += 1;
  product.updatedAt = new Date().toISOString();
  addAudit(state, adminId, product.isActive ? 'RESTORE_PRODUCT' : 'ARCHIVE_PRODUCT', 'Product', product.id);
  return { id: product.id, isActive: product.isActive };
}

function validateCategory(
  state: LocalState,
  body: Record<string, unknown>,
  current?: LocalCategory,
  excludeId?: string,
): LocalCategory {
  const name = body.name === undefined && current ? current.name : requiredText(body.name, 80, 'Название категории');
  const slug = body.slug === undefined && current ? current.slug : slugify(requiredText(body.slug, 80, 'Slug'));
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) fail(400, 'Slug: используйте латинские буквы, цифры и дефис.');
  if (state.categories.some((category) => category.slug === slug && category.id !== excludeId)) {
    fail(409, 'Категория с таким slug уже существует.', 'slug-conflict');
  }
  const sortOrder = body.sortOrder === undefined && current
    ? current.sortOrder
    : integer(body.sortOrder, 0, 1000, 'Порядок категории');
  const isActive = body.isActive === undefined
    ? current?.isActive ?? true
    : booleanValue(body.isActive, 'Активность категории');
  return { id: current?.id ?? randomId(), name, slug, sortOrder, isActive, version: current?.version ?? 0 };
}

function createAdminCategory(state: LocalState, adminId: string, body: Record<string, unknown>): LocalCategory {
  const category = { ...validateCategory(state, body), version: 1 };
  state.categories.push(category);
  addAudit(state, adminId, 'CREATE_CATEGORY', 'Category', category.id);
  return category;
}

function mutateCategory(
  state: LocalState,
  adminId: string,
  id: string,
  body: Record<string, unknown>,
  init: RequestInit,
): LocalCategory {
  const current = state.categories.find((category) => category.id === id);
  if (!current) fail(404, 'Категория не найдена.', 'category-not-found');
  const expectedVersion = body.expectedVersion ?? header(init, 'If-Match');
  if (expectedVersion !== undefined && expectedVersion !== null) {
    const version = integer(Number(expectedVersion), 1, Number.MAX_SAFE_INTEGER, 'Версия категории');
    if (version !== current.version) fail(409, 'Категория уже изменена. Обновите данные.', 'version-conflict');
  }
  const next = { ...validateCategory(state, body, current, id), version: current.version + 1 };
  Object.assign(current, next);
  state.products.forEach((product) => {
    if (product.categoryId === current.id) {
      product.category = { id: current.id, name: current.name, slug: current.slug };
      product.updatedAt = new Date().toISOString();
    }
  });
  addAudit(state, adminId, 'UPDATE_CATEGORY', 'Category', current.id, { isActive: current.isActive });
  return current;
}

function signatures(): Record<string, number[]> {
  return {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    'image/webp': [0x52, 0x49, 0x46, 0x46],
  };
}

function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new LocalProblem(400, 'Не удалось прочитать изображение.', 'invalid-image'));
    };
    reader.onerror = () => reject(new LocalProblem(400, 'Не удалось прочитать изображение.', 'invalid-image'));
    reader.readAsDataURL(file);
  });
}

async function uploadAdminImage(init: RequestInit, signal?: AbortSignal): Promise<{ imageUrl: string }> {
  if (!(init.body instanceof FormData)) fail(400, 'Изображение обязательно.');
  const file = init.body.get('image');
  if (typeof File === 'undefined' || !(file instanceof File) || file.size === 0) {
    fail(400, 'Изображение обязательно.', 'image-required');
  }
  if (file.size > MAX_UPLOAD_BYTES) fail(400, 'Максимальный размер изображения — 5 МБ.');
  const allowed = signatures();
  const signature = allowed[file.type];
  if (!signature) fail(400, 'Разрешены только настоящие JPG, PNG и WebP.', 'invalid-image-type');
  const bytes = new Uint8Array(await file.slice(0, signature.length).arrayBuffer());
  if (!matchesSignature(bytes, signature)) fail(400, 'Разрешены только настоящие JPG, PNG и WebP.', 'invalid-image-type');
  if (file.type === 'image/webp') {
    const format = new TextDecoder().decode(await file.slice(8, 12).arrayBuffer());
    if (format !== 'WEBP') fail(400, 'Разрешены только настоящие JPG, PNG и WebP.', 'invalid-image-type');
  }
  const imageUrl = await readFileAsDataUrl(file);
  if (signal?.aborted) throw new DOMException('Запрос отменён', 'AbortError');
  return { imageUrl };
}

function decodeSegments(pathname: string): string[] {
  try {
    return pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
  } catch {
    fail(400, 'Некорректный адрес запроса.');
  }
}

async function route(path: string, init: RequestInit): Promise<Response> {
  const url = new URL(path, 'https://cvetotishina.local');
  const segments = decodeSegments(url.pathname);
  const method = (init.method ?? 'GET').toUpperCase();

  if (url.pathname === '/config') {
    requireMethod(method, ['GET']);
    const config: StoreConfig = {
      demoMode: false,
      storeName: 'ЦветоТишина',
      phone: '+7 (495) 128-40-20',
      address: 'Москва, ул. Малая Бронная, 18 · 09:00–21:00',
      deliveryFee: DELIVERY_FEE,
      freeDeliveryFrom: FREE_DELIVERY_FROM,
    };
    return json(config);
  }

  if (url.pathname === '/categories') {
    requireMethod(method, ['GET']);
    const state = loadState();
    const categories = state.categories
      .filter((category) => category.isActive)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'ru'));
    return json(categories.map(categoryView));
  }

  if (url.pathname === '/products') {
    requireMethod(method, ['GET']);
    return json(listProducts(loadState(), url.searchParams));
  }

  if (segments[0] === 'products' && segments.length === 2) {
    requireMethod(method, ['GET']);
    const state = loadState();
    const product = state.products.find((item) => item.slug === segments[1]);
    const category = product ? state.categories.find((item) => item.id === product.categoryId) : null;
    if (!product || !product.isActive || !category?.isActive) {
      fail(404, 'Товар не найден.', 'product-not-found');
    }
    return json(productView(product));
  }

  if (url.pathname === '/cart/quote') {
    requireMethod(method, ['POST']);
    const body = readBody(init);
    return json(calculateQuote(loadState(), body.items, body.deliveryType));
  }

  if (url.pathname === '/orders') {
    requireMethod(method, ['POST']);
    const key = requireIdempotencyKey(init);
    return json(createOrder(loadState(), readBody(init), key), 201);
  }

  if (segments[0] === 'orders' && segments.length === 2) {
    requireMethod(method, ['GET']);
    const state = loadState();
    const order = findPublicOrder(state, segments[1], url.searchParams.get('token'));
    return json({ order: orderView(order) });
  }

  if (segments[0] === 'orders' && segments.length === 4 && segments[2] === 'payments' && segments[3] === 'demo') {
    requireMethod(method, ['POST']);
    const key = requireIdempotencyKey(init);
    return json(payOrder(loadState(), segments[1], readBody(init), key));
  }

  if (segments[0] === 'admin' && segments[1] === 'auth') {
    if (segments.length === 3 && segments[2] === 'login') {
      requireMethod(method, ['POST']);
      const body = readBody(init);
      const state = loadState();
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      if (email !== state.admin.email || password !== state.admin.password) {
        fail(401, 'Неверная почта или пароль.', 'invalid-credentials');
      }
      addAudit(state, state.admin.id, 'LOGIN', 'AdminUser', state.admin.id);
      commitState(state);
      const session = startSession(state);
      return json(authResponse(state, session));
    }
    if (segments.length === 3 && segments[2] === 'me') {
      requireMethod(method, ['GET']);
      const { state, session } = requireAdmin(init, false);
      return json(authResponse(state, session));
    }
    if (segments.length === 3 && segments[2] === 'refresh') {
      requireMethod(method, ['POST']);
      const { state } = requireAdmin(init, false);
      const session = startSession(state);
      return json(authResponse(state, session));
    }
    if (segments.length === 3 && segments[2] === 'logout') {
      requireMethod(method, ['POST']);
      requireAdmin(init, true);
      clearSession();
      return noContent();
    }
    if (segments.length === 3 && segments[2] === 'change-password') {
      requireMethod(method, ['POST']);
      const { state, session } = requireAdmin(init, true);
      const body = readBody(init);
      const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      const newPassword = requiredText(body.newPassword, 128, 'Новый пароль', 12);
      if (currentPassword !== state.admin.password) {
        fail(401, 'Текущий пароль неверен.', 'invalid-password');
      }
      if (currentPassword === newPassword) fail(409, 'Новый пароль должен отличаться.');
      state.admin.password = newPassword;
      state.sessionEpoch += 1;
      session.sessionEpoch = state.sessionEpoch;
      addAudit(state, state.admin.id, 'CHANGE_PASSWORD', 'AdminUser', state.admin.id);
      commitState(state);
      saveSession(session);
      return noContent();
    }
  }

  if (segments[0] === 'admin') {
    const mutation = method !== 'GET' && method !== 'HEAD';
    const { state } = requireAdmin(init, mutation);
    const adminId = state.admin.id;

    if (segments[1] === 'products' && segments.length === 2) {
      requireMethod(method, ['GET', 'POST']);
      if (method === 'GET') {
        const query = normalizeSearchText(url.searchParams.get('q') ?? '');
        const products = state.products
          .filter((product) => !query || normalizeSearchText(`${product.name} ${product.slug}`).includes(query))
          .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || right.id.localeCompare(left.id))
          .slice(0, 200);
        return json(products.map(adminProductView));
      }
      const product = createAdminProduct(state, adminId, readBody(init));
      commitState(state);
      return json(adminProductView(product), 201);
    }

    if (segments[1] === 'products' && segments.length === 3) {
      requireMethod(method, ['PATCH', 'DELETE']);
      if (method === 'PATCH') {
        const product = updateAdminProduct(state, adminId, segments[2], readBody(init));
        commitState(state);
        return json(adminProductView(product));
      }
      const result = toggleProduct(state, adminId, segments[2]);
      commitState(state);
      return json(result);
    }

    if (segments[1] === 'categories' && segments.length === 2) {
      requireMethod(method, ['GET', 'POST']);
      if (method === 'GET') {
        const categories = [...state.categories]
          .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'ru'));
        return json(categories.map(adminCategoryView));
      }
      const category = createAdminCategory(state, adminId, readBody(init));
      commitState(state);
      return json(adminCategoryView(category), 201);
    }

    if (segments[1] === 'categories' && segments.length === 3) {
      requireMethod(method, ['PATCH']);
      const category = mutateCategory(state, adminId, segments[2], readBody(init), init);
      commitState(state);
      return json(adminCategoryView(category));
    }

    if (segments[1] === 'uploads' && segments.length === 2) {
      requireMethod(method, ['POST']);
      return json(await uploadAdminImage(init, init.signal ?? undefined));
    }

    if (segments[1] === 'orders' && segments.length === 2) {
      requireMethod(method, ['GET']);
      return json(listAdminOrders(state, url.searchParams));
    }

    if (segments[1] === 'orders' && segments.length === 3) {
      requireMethod(method, ['GET']);
      const order = state.orders.find((item) => item.id === segments[2]);
      if (!order) fail(404, 'Заказ не найден.', 'order-not-found');
      return json(orderView(order));
    }

    if (segments[1] === 'orders' && segments.length === 4 && segments[3] === 'status') {
      requireMethod(method, ['PATCH']);
      return json(updateOrderStatus(state, adminId, segments[2], init));
    }
  }

  fail(404, 'Запрошенные данные не найдены.', 'not-found');
}

export async function localRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const signal = init.signal ?? undefined;
  try {
    await waitForLatency(signal);
    return await route(path, init);
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof LocalProblem) return problemResponse(error);
    return problemResponse(new LocalProblem(500, 'Не удалось выполнить действие с локальными данными.', 'local-storage-error'));
  }
}
