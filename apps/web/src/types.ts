import type { CartLine, OrderStatus, OrderView as SharedOrderView, ProductView } from '@cvetotishina/shared';

export type { CartLine, OrderStatus, ProductView } from '@cvetotishina/shared';

export interface StoreConfig {
  demoMode: boolean;
  storeName: string;
  phone: string | null;
  address: string | null;
  deliveryFee: number;
  freeDeliveryFrom: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export type ProductSort = 'popular' | 'price-asc' | 'price-desc' | 'newest';
export type DeliveryType = 'PICKUP' | 'DELIVERY';

export interface ProductListResponse {
  items: ProductView[];
  nextCursor: string | null;
}

export interface QuoteItem {
  productId: string;
  name: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
}

export interface CartQuote {
  items: QuoteItem[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
}

export interface CreateOrderInput {
  items: CartLine[];
  customerName: string;
  phone: string;
  email?: string;
  deliveryType: DeliveryType;
  address?: string;
  comment?: string;
  utensils: boolean;
}

export interface CreateOrderResponse {
  order: OrderView;
  accessToken: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

export interface AdminAuthResponse {
  user: AdminUser;
  csrfToken: string;
}

export interface AdminProductInput {
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

export interface AdminProduct extends ProductView, AdminProductInput {
  isActive: boolean;
  version: number;
  archivedAt?: string | null;
}

export interface AdminCategory extends Category {
  isActive: boolean;
  version?: number;
}

export interface OrderHistoryEntry {
  id?: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  comment: string | null;
  actorType: string;
  createdAt: string;
}

export interface OrderView extends SharedOrderView {
  version: number;
  history: OrderHistoryEntry[];
}

export type AdminOrder = OrderView;

export interface AdminOrderListResponse {
  items: AdminOrder[];
  nextCursor: string | null;
  total: number;
}

export interface CategoryInput {
  name: string;
  slug: string;
  sortOrder: number;
}
