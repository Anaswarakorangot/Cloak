import React from 'react';

export function ExposureMeter({ score }: { score: number }) {
  const level = score > 0.5 ? 'HIGH' : score > 0.2 ? 'MEDIUM' : 'LOW';
  const color = level === 'HIGH' ? 'text-red-400' : level === 'MEDIUM' ? 'text-amber-400' : 'text-green-400';
  const barColor = level === 'HIGH' ? 'bg-red-500' : level === 'MEDIUM' ? 'bg-amber-400' : 'bg-green-500';

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-700/60 shadow-inner">
      <div>
        <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-0.5">Exposure Risk</p>
        <p className={`text-lg leading-none font-bold font-mono ${color} transition-all duration-700`}>
          {score.toFixed(3)}
        </p>
      </div>
      <div className="flex flex-col justify-end pb-0.5 gap-1.5">
        <span className={`text-[10px] leading-none font-bold tracking-widest ${color}`}>{level}</span>
        <div className="w-16 h-1 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(currentColor,0.5)] ${barColor}`}
            style={{ width: `${Math.min(score * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
