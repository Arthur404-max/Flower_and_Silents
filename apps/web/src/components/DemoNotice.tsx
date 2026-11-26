import { FlaskConical, Info } from 'lucide-react';
import { formatMoney } from '@cvetotishina/shared';
import type { StoreConfig } from '../types';

export function DemoNotice({ config, compact = false }: { config?: StoreConfig; compact?: boolean }) {
  return (
    <aside className={`demo-notice ${compact ? 'demo-notice-compact' : ''}`} aria-label="Демонстрационный режим">
      <span className="demo-notice-icon"><FlaskConical size={compact ? 18 : 22} aria-hidden="true" /></span>
      <div>
        <strong>Это демонстрационная витрина</strong>
        <p>Заказы и демо-оплата не создают реальных обязательств и не списывают деньги.</p>
        {config && !compact && (
          <span className="demo-delivery">
            Демо-доставка: {formatMoney(config.deliveryFee)} · бесплатно от {formatMoney(config.freeDeliveryFrom)}
          </span>
        )}
      </div>
      {!compact && <Info size={18} className="demo-notice-info" aria-hidden="true" />}
    </aside>
  );
}
