function Spinner({ label = 'Cargando...' }) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        padding: '3rem 1rem',
        color: '#666',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          border: '3px solid #e0e0e0',
          borderTopColor: '#007bff',
          borderRadius: '50%',
          animation: 'jarvis-spin 0.8s linear infinite',
        }}
      />
      <p style={{ margin: 0 }}>{label}</p>
      <style>{'@keyframes jarvis-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

export default Spinner;
