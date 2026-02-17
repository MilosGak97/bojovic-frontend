interface RouteModeToggleProps {
  mode: 'active' | 'simulation';
  onModeChange: (mode: 'active' | 'simulation') => void;
  onCreateSimulation: () => void;
  onApplyChanges: () => void;
  onDiscardSimulation: () => void;
  hasSimulation: boolean;
}

export function RouteModeToggle({
  mode,
  onModeChange,
  onCreateSimulation,
  onApplyChanges,
  onDiscardSimulation,
  hasSimulation,
}: RouteModeToggleProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Mode Toggle */}
      

      {/* Action Buttons */}
      {!hasSimulation ? (
        null
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={onApplyChanges}
            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium hover:bg-green-700 border border-green-700"
          >
            Apply Changes
          </button>
          <button
            onClick={onDiscardSimulation}
            className="px-3 py-1.5 bg-gray-600 text-white text-xs font-medium hover:bg-gray-700 border border-gray-700"
          >
            Discard Simulation
          </button>
        </div>
      )}
    </div>
  );
}
