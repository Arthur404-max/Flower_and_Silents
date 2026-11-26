import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartLine, ProductView } from '../types';
import { useToast } from './ToastContext';

const CART_KEY = 'cvetotishina.cart.v1';
export const MAX_CART_QUANTITY = 20;

interface CartContextValue {
  items: CartLine[];
  itemCount: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (product: ProductView, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== 'object') return false;
  const line = value as Partial<CartLine>;
  return (
    typeof line.productId === 'string' &&
    line.productId.length > 0 &&
    typeof line.quantity === 'number' &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0
  );
}

function normalizeLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const quantities = new Map<string, number>();
  value.filter(isCartLine).forEach((line) => {
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
  });
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity: Math.min(quantity, MAX_CART_QUANTITY) }));
}

function loadCart(): CartLine[] {
  try {
    return normalizeLines(JSON.parse(localStorage.getItem(CART_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(loadCart);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // Cart still works for the current session when storage is unavailable.
    }
  }, [items]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CART_KEY) return;
      try {
        setItems(normalizeLines(JSON.parse(event.newValue ?? '[]')));
      } catch {
        setItems([]);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const addItem = useCallback(
    (product: ProductView, quantity = 1) => {
      if (product.stock < 1) {
        showToast('Этот букет сейчас недоступен.', 'error');
        return;
      }
      const maxQuantity = Math.min(product.stock, MAX_CART_QUANTITY);
      const safeQuantity = Math.max(1, Math.min(Math.floor(quantity), maxQuantity));
      setItems((current) => {
        const existing = current.find((line) => line.productId === product.id);
        if (!existing) {
          return [...current, { productId: product.id, quantity: safeQuantity }];
        }
        return current.map((line) =>
          line.productId === product.id
            ? { ...line, quantity: Math.min(line.quantity + safeQuantity, maxQuantity) }
            : line,
        );
      });
      setDrawerOpen(true);
      showToast('Букет добавлен в корзину.', 'success');
    },
    [showToast],
  );

  const setQuantity = useCallback((productId: string, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1) return;
    setItems((current) =>
      current.map((line) => (line.productId === productId ? { ...line, quantity: Math.min(quantity, MAX_CART_QUANTITY) } : line)),
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((current) => current.filter((line) => line.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const itemCount = useMemo(() => items.reduce((sum, line) => sum + line.quantity, 0), [items]);
  const value = useMemo(
    () => ({
      items,
      itemCount,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
    }),
    [items, itemCount, isDrawerOpen, openDrawer, closeDrawer, addItem, setQuantity, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart должен использоваться внутри CartProvider');
  }
  return context;
}
