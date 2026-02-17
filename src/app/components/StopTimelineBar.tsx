interface Stop {
  id: string;
  number: number;
  city: string;
  type: 'pickup' | 'delivery';
}

interface StopTimelineBarProps {
  stops: Stop[];
  currentStopId: string;
  onStopSelect: (stopId: string) => void;
  overflowStops?: string[]; // Stop IDs that have overflow warnings
}

export function StopTimelineBar({ stops, currentStopId, onStopSelect, overflowStops = [] }: StopTimelineBarProps) {
  return (
    <div className="bg-gray-50 border-b border-gray-300 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-gray-700">View Cargo State At:</label>
      </div>

      <div className="flex items-center gap-1">
        {stops.map((stop, index) => (
          <div key={stop.id} className="flex items-center flex-1">
            <button
              onClick={() => onStopSelect(stop.id)}
              className={`flex-1 px-2 py-2 text-left border transition-colors relative ${
                currentStopId === stop.id
                  ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold">Stop {index + 1}</div>
                  <div className={`text-xs ${currentStopId === stop.id ? 'text-blue-100' : 'text-gray-500'}`}>
                    {stop.type === 'pickup' ? '↑' : '↓'} {stop.city.substring(0, 3)}
                  </div>
                </div>
                {overflowStops.includes(stop.id) && (
                  <div className="w-2 h-2 bg-red-500 rounded-full absolute top-1 right-1" title="Overflow at this stop" />
                )}
              </div>
            </button>

            {index < stops.length - 1 && (
              <div className={`w-2 h-0.5 ${currentStopId === stop.id ? 'bg-blue-600' : 'bg-gray-300'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}