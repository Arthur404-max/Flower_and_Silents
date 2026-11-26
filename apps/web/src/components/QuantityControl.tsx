import { Minus, Plus } from 'lucide-react';

interface QuantityControlProps {
  value: number;
  onChange: (quantity: number) => void;
  max?: number;
  min?: number;
  disabled?: boolean;
  label?: string;
  compact?: boolean;
}

export function QuantityControl({
  value,
  onChange,
  max,
  min = 1,
  disabled = false,
  label = 'Количество',
  compact = false,
}: QuantityControlProps) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && (max === undefined || value < max);

  return (
    <div className={`quantity-control ${compact ? 'quantity-control-compact' : ''}`} aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={!canDecrease} aria-label="Уменьшить количество">
        <Minus size={16} aria-hidden="true" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isInteger(next) && next >= min && (max === undefined || next <= max)) onChange(next);
        }}
      />
      <button type="button" onClick={() => onChange(value + 1)} disabled={!canIncrease} aria-label="Увеличить количество">
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
