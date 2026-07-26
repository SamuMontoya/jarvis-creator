import { memo } from 'react';

function BotonesDescarga({ 
  onBack, 
  onDownloadHTML, 
  onDownloadMarkdown, 
  onDownloadPDF, 
  loading = false 
}) {
  return (
    <div style={{ 
      display: 'flex', 
      flexWrap: 'wrap',
      gap: '1rem', 
      justifyContent: 'center', 
      marginTop: '2rem',
      paddingTop: '1rem',
      borderTop: '1px solid #dee2e6'
    }}>
      <button
        onClick={onBack}
        disabled={loading}
        style={{
          flex: 1,
          minWidth: '160px',
          maxWidth: '200px',
          padding: '1rem 2rem',
          fontSize: '1.1rem',
          backgroundColor: loading ? '#ccc' : '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        Volver
      </button>
      <button
        onClick={onDownloadHTML}
        disabled={loading}
        style={{
          flex: 1,
          minWidth: '180px',
          maxWidth: '200px',
          padding: '1rem 2rem',
          fontSize: '1.1rem',
          backgroundColor: loading ? '#ccc' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        {loading ? 'Generando...' : '⬇️ Descargar HTML'}
      </button>
      <button
        onClick={onDownloadMarkdown}
        disabled={loading}
        style={{
          flex: 1,
          minWidth: '200px',
          maxWidth: '220px',
          padding: '1rem 2rem',
          fontSize: '1.1rem',
          backgroundColor: loading ? '#ccc' : '#17a2b8',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        {loading ? 'Generando...' : '⬇️ Descargar Markdown'}
      </button>
      <button
        onClick={onDownloadPDF}
        disabled={loading}
        style={{
          flex: 1,
          minWidth: '180px',
          maxWidth: '200px',
          padding: '1rem 2rem',
          fontSize: '1.1rem',
          backgroundColor: loading ? '#ccc' : '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        {loading ? 'Generando...' : '⬇️ Descargar PDF'}
      </button>
    </div>
  );
}

export default memo(BotonesDescarga);