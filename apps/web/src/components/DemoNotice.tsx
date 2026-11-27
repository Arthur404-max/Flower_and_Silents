import { Truck } from 'lucide-react';
import { formatMoney } from '@cvetotishina/shared';
import type { StoreConfig } from '../types';

export function DemoNotice({ config, compact = false }: { config?: StoreConfig; compact?: boolean }) {
  return (
    <aside className={`info-banner ${compact ? 'info-banner-compact' : ''}`} aria-label="Условия доставки">
      <span className="info-banner-icon"><Truck size={compact ? 17 : 20} strokeWidth={1.6} aria-hidden="true" /></span>
      <div>
        <strong>Бережная доставка и самовывоз</strong>
        <p>
          {config
            ? `Доставка — ${formatMoney(config.deliveryFee)}, бесплатно при заказе от ${formatMoney(config.freeDeliveryFrom)}. Самовывоз бесплатный.`
            : 'Стоимость букетов и доставки рассчитывается автоматически перед подтверждением заказа.'}
        </p>
      </div>
    </aside>
  );
}
