export const ORDER_STATUSES = [
  'AWAITING_PAYMENT',
  'NEW',
  'ASSEMBLING',
  'DELIVERING',
  'DELIVERED',
  'PAYMENT_FAILED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type DeliveryType = 'PICKUP' | 'DELIVERY';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Ожидает оплаты',
  NEW: 'Принят в работу',
  ASSEMBLING: 'Собираем букет',
  DELIVERING: 'Передан курьеру',
  DELIVERED: 'Доставлен',
  PAYMENT_FAILED: 'Ошибка оплаты',
  CANCELLED: 'Отменён',
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'AWAITING_PAYMENT',
  'NEW',
  'ASSEMBLING',
  'DELIVERING',
  'DELIVERED',
];

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface ProductView {
  id: string;
  name: string;
  slug: string;
  description: string;
  composition: string;
  size: string;
  price: number;
  oldPrice: number | null;
  imageUrl: string;
  badge: string | null;
  stock: number;
  categoryId: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface OrderItemView {
  id: string;
  name: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderView {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  customerName: string;
  phone: string;
  email: string | null;
  deliveryType: 'PICKUP' | 'DELIVERY';
  address: string | null;
  comment: string | null;
  utensils: boolean;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  createdAt: string;
  paidAt: string | null;
  items: OrderItemView[];
}

export function formatMoney(amountInKopecks: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amountInKopecks / 100);
}
