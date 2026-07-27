import { memo } from 'react';

function TabsFiltro({ filter, onFilterChange, ideas }) {
  const counts = {
    all: ideas.length,
    draft: ideas.filter((i) => i.estado === 'draft').length,
    refined: ideas.filter((i) => i.estado === 'refined').length,
  };

  const tabConfig = [
    { key: 'all', label: 'Todas' },
    { key: 'draft', label: 'Borradores' },
    { key: 'refined', label: 'Completadas' },
  ];

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-dust">
      {tabConfig.map(({ key, label }) => {
        const active = filter === key;
        return (
          <button
            key={key}
            onClick={() => onFilterChange(key)}
            className={`-mb-px flex-shrink-0 whitespace-nowrap rounded-t-lg border px-3 py-2.5 font-body text-sm transition-colors sm:px-4 ${
              active
                ? 'border-dust border-b-white bg-white font-semibold text-ink shadow-[0_-1px_4px_rgba(17,16,16,0.04)]'
                : 'border-transparent text-stone hover:bg-paper-warm hover:text-ink'
            }`}
          >
            {label} <span className="text-xs text-stone">({counts[key]})</span>
          </button>
        );
      })}
    </div>
  );
}

export default memo(TabsFiltro);
