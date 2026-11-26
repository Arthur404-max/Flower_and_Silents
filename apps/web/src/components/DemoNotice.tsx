import { ClipboardCheck, Info } from 'lucide-react';
import { formatMoney } from '@cvetotishina/shared';
import type { StoreConfig } from '../types';

export function DemoNotice({ config, compact = false }: { config?: StoreConfig; compact?: boolean }) {
  return (
    <aside className={`demo-notice ${compact ? 'demo-notice-compact' : ''}`} aria-label="Проверка заказа">
      <span className="demo-notice-icon"><ClipboardCheck size={compact ? 18 : 22} aria-hidden="true" /></span>
      <div>
        <strong>Проверьте заказ перед оформлением</strong>
        <p>Уточните состав, количество выбранных позиций и итоговую стоимость.</p>
        {config && !compact && (
          <span className="demo-delivery">
            Доставка: {formatMoney(config.deliveryFee)} · бесплатно от {formatMoney(config.freeDeliveryFrom)}
          </span>
        )}
      </div>
      {!compact && <Info size={18} className="demo-notice-info" aria-hidden="true" />}
    </aside>
  );
}
