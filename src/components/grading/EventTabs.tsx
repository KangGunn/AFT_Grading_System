import React from 'react';
import type { EventConfig } from '../../types/aft/aft.types';
import { EVENT_CONFIGS } from '../../utils/aft/constants';

interface EventTabsProps {
  currentEventIndex: number;
  onSelectEvent: (index: number) => void;
}

export const EventTabs: React.FC<EventTabsProps> = ({
  currentEventIndex,
  onSelectEvent
}) => {
  return (
    <nav className="w-full bg-slate-800 border-b border-slate-700 shrink-0">
      <div className="flex w-full overflow-x-auto no-scrollbar">
        {EVENT_CONFIGS.map((ev: EventConfig, idx: number) => {
          const isActive = idx === currentEventIndex;
          return (
            <button
              key={ev.id}
              onClick={() => onSelectEvent(idx)}
              className={`flex-1 min-w-[64px] py-2.5 px-2 text-center transition-all relative font-black text-xs ${
                isActive
                  ? 'bg-blue-600/30 text-blue-400 font-extrabold border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-750'
              }`}
            >
              <span className="block text-sm tracking-wider">{ev.code}</span>
              <span className="block text-[9px] font-medium opacity-80 truncate">{ev.name.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
