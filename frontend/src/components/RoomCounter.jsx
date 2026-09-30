// components/RoomCounter.jsx - Displays active room quota (e.g. 5/10 rooms used)
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';

export function RoomCounter({ count = 0, limit = 10, remaining = 10 }) {
  const percentage = Math.min(100, Math.round((count / limit) * 100));
  const isFull = count >= limit;
  const isNearLimit = count >= limit - 2 && !isFull;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 select-none">
      <div className="flex items-center gap-2 text-xs font-sans text-neutral-300">
        <FontAwesomeIcon
          icon={isFull ? faTriangleExclamation : faCube}
          className={`text-sm ${isFull ? 'text-amber-400 animate-pulse' : 'text-neutral-400'}`}
        />
        <span className="font-semibold text-white">
          {count}/{limit} rooms used
        </span>
        <span className="text-neutral-500">
          ({remaining} {remaining === 1 ? 'slot' : 'slots'} available)
        </span>
      </div>

      {/* Mini Progress Bar */}
      <div className="w-full sm:w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isFull
              ? 'bg-amber-400'
              : isNearLimit
              ? 'bg-amber-500/80'
              : 'bg-[#fbff47]'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default RoomCounter;
