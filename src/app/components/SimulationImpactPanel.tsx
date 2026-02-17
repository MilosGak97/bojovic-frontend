import { AlertTriangle, TrendingUp, Clock } from 'lucide-react';

export interface SimulationImpact {
  kmDelta: number;
  timeDelta: string;
  warnings: string[];
}

interface SimulationImpactPanelProps {
  impact: SimulationImpact;
}

export function SimulationImpactPanel({ impact }: SimulationImpactPanelProps) {
  const isImprovement = impact.kmDelta < 0;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 border-t border-r border-b border-amber-200 p-3 mb-3">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-xs font-semibold text-amber-900">Simulation Impact</h4>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-4 h-4 ${isImprovement ? 'text-green-600' : 'text-red-600'}`} />
          <div>
            <div className="text-xs text-gray-600">Distance</div>
            <div className={`text-sm font-semibold ${isImprovement ? 'text-green-600' : 'text-red-600'}`}>
              {impact.kmDelta > 0 ? '+' : ''}{impact.kmDelta} km
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-600" />
          <div>
            <div className="text-xs text-gray-600">Time</div>
            <div className="text-sm font-semibold text-gray-900">{impact.timeDelta}</div>
          </div>
        </div>
      </div>

      {impact.warnings.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-amber-200">
          {impact.warnings.map((warning, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-xs text-amber-900">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
