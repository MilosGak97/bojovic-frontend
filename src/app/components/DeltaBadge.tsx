import { TrendingUp, TrendingDown } from 'lucide-react';

interface DeltaBadgeProps {
  value: number;
  unit: string;
  type?: 'km' | 'time' | 'generic';
}

export function DeltaBadge({ value, unit, type = 'generic' }: DeltaBadgeProps) {
  if (value === 0) return null;

  const isPositive = value > 0;
  const isImprovement = type === 'km' ? value < 0 : false;

  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium ${
        isImprovement
          ? 'bg-green-50 text-green-700 border border-green-200'
          : isPositive
          ? 'bg-red-50 text-red-700 border border-red-200'
          : 'bg-green-50 text-green-700 border border-green-200'
      }`}
    >
      {isImprovement || (!isPositive && type !== 'time') ? (
        <TrendingDown className="w-3 h-3" />
      ) : (
        <TrendingUp className="w-3 h-3" />
      )}
      <span>
        {isPositive ? '+' : ''}
        {value} {unit}
      </span>
    </div>
  );
}
