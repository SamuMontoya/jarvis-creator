import { memo } from 'react';

function TabsFiltro({ filter, onFilterChange, ideas }) {
  const counts = {
    all: ideas.length,
    draft: ideas.filter(i => i.estado === 'draft').length,
    refined: ideas.filter(i => i.estado === 'refined').length,
  };

  const tabConfig = [
    { key: 'all', label: 'Todas', color: '#007bff' },
    { key: 'draft', label: 'Borradores', color: '#ffc107' },
    { key: 'refined', label: 'Completadas', color: '#28a745' },
  ];

  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
      {tabConfig.map(({ key, label, color }) => (
        <button
          key={key}
          onClick={() => onFilterChange(key)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: filter === key ? color : '#e9ecef',
            color: filter === key ? (key === 'draft' ? '#333' : 'white') : '#333',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'background-color 0.2s',
          }}
        >
          {label} ({counts[key]})
        </button>
      ))}
    </div>
  );
}

export default memo(TabsFiltro);