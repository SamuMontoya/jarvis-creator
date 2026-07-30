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
    <div className="mb-6 flex flex-wrap gap-6 border-b border-dust">
      {tabConfig.map(({ key, label }) => {
        const active = filter === key;
        return (
          <button
            key={key}
            onClick={() => onFilterChange(key)}
            className="ds-label border-b-2 pb-2 transition-colors"
            style={{
              color: active ? 'var(--color-ink)' : 'var(--color-stone)',
              borderColor: active ? 'var(--color-amber)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            {label} ({counts[key]})
          </button>
        );
      })}
    </div>
  );
}

export default memo(TabsFiltro);
