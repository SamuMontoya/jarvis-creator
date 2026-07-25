import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001/api';

function FinalResumen({ 
  idea_id, 
  onBack, 
  onGenerateDocument,
  onEdit 
}) {
  const [idea, setIdea] = useState(null);
  const [generic_questions, setGenericQuestions] = useState([]);
  const [generic_respuestas, setGenericRespuestas] = useState([]);
  const [dynamic_questions, setDynamicQuestions] = useState([]);
  const [dynamic_respuestas, setDynamicRespuestas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState(null);

  const handleGenerateDocument = async () => {
    setGenLoading(true);
    setGenError(null);

    try {
      const response = await fetch(`${API_BASE}/ideas/${idea_id}/generate-final-html`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Error al generar documento');
      }

      if (data.html) {
        // Descargar como archivo .html
        const blob = new Blob([data.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jarvis-idea-${idea_id.slice(0, 8)}-${Date.now()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenLoading(false);
    }
  };

  const handleDownloadMarkdown = async () => {
    setGenLoading(true);
    setGenError(null);

    try {
      const response = await fetch(`${API_BASE}/ideas/${idea_id}/generate-final-markdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Error al generar markdown');
      }

      if (data.markdown) {
        const blob = new Blob([data.markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jarvis-idea-${idea_id.slice(0, 8)}-${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setGenLoading(true);
    setGenError(null);

    try {
      const response = await fetch(`${API_BASE}/ideas/${idea_id}/generate-final-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Error al generar PDF');
      }

      if (data.markdown) {
        // Usar jsPDF en el frontend para generar PDF
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF();
        
        // Configurar fuente
        doc.setFont('helvetica');
        
        // Agregar contenido línea por línea
        const lines = data.markdown.split('\n');
        let y = 20;
        const lineHeight = 7;
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        const maxWidth = pageWidth - 2 * margin;

        for (const line of lines) {
          // Verificar si necesitamos nueva página
          if (y > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            y = 20;
          }

          // Detectar encabezados
          if (line.startsWith('# ')) {
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.text(line.replace('# ', ''), margin, y);
            y += lineHeight * 1.5;
          } else if (line.startsWith('## ')) {
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text(line.replace('## ', ''), margin, y);
            y += lineHeight * 1.2;
          } else if (line.startsWith('### ')) {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            const text = line.replace('### ', '');
            const splitText = doc.splitTextToSize(text, maxWidth);
            doc.text(splitText, margin, y);
            y += splitText.length * lineHeight;
          } else if (line.startsWith('- **')) {
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            const splitText = doc.splitTextToSize(line, maxWidth);
            doc.text(splitText, margin, y);
            y += splitText.length * lineHeight;
          } else if (line.startsWith('*') || line.startsWith('-')) {
            doc.setFontSize(10);
            doc.setFont(undefined, 'italic');
            const splitText = doc.splitTextToSize(line, maxWidth);
            doc.text(splitText, margin, y);
            y += splitText.length * lineHeight;
          } else if (line.trim() === '---') {
            y += 5;
            doc.setDrawColor(200);
            doc.line(margin, y, pageWidth - margin, y);
            y += 10;
          } else {
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            const splitText = doc.splitTextToSize(line, maxWidth);
            doc.text(splitText, margin, y);
            y += splitText.length * lineHeight * 0.6;
          }
        }

        doc.save(`jarvis-idea-${idea_id.slice(0, 8)}-${Date.now()}.pdf`);
      }
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenLoading(false);
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [
          ideaRes,
          genQuestionsRes,
          genRespuestasRes,
          dynQuestionsRes,
          dynRespuestasRes
        ] = await Promise.all([
          fetch(`${API_BASE}/ideas/${idea_id}`),
          fetch(`${API_BASE}/questions`),
          fetch(`${API_BASE}/ideas/${idea_id}/respuestas`),
          fetch(`${API_BASE}/ideas/${idea_id}/dynamic-questions`),
          fetch(`${API_BASE}/ideas/${idea_id}/dynamic-respuestas`),
        ]);

        const [
          ideaData,
          genQuestionsData,
          genRespuestasData,
          dynQuestionsData,
          dynRespuestasData
        ] = await Promise.all([
          ideaRes.json(),
          genQuestionsRes.json(),
          genRespuestasData.json(),
          dynQuestionsData.json(),
          dynRespuestasData.json(),
        ]);

        if (!ideaRes.ok) throw new Error(ideaData.message || 'Error al cargar idea');
        if (!genQuestionsRes.ok) throw new Error(genQuestionsData.message || 'Error al cargar preguntas genéricas');
        if (!genRespuestasRes.ok) throw new Error(genRespuestasData.message || 'Error al cargar respuestas genéricas');
        if (!dynQuestionsRes.ok) throw new Error(dynQuestionsData.message || 'Error al cargar preguntas dinámicas');
        if (!dynRespuestasRes.ok) throw new Error(dynRespuestasData.message || 'Error al cargar respuestas dinámicas');

        setIdea(ideaData.idea);
        setGenericQuestions(genQuestionsData.questions || []);
        setGenericRespuestas(genRespuestasData.respuestas || []);
        setDynamicQuestions(dynQuestionsData.dynamic_questions || []);
        setDynamicRespuestas(dynRespuestasData.dynamic_respuestas || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (idea_id) {
      fetchAllData();
    }
  }, [idea_id]);

  const renderRespuestaSection = (title, respuestas, type) => {
    if (!respuestas || respuestas.length === 0) return null;

    return (
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ 
          color: '#333', 
          borderBottom: '2px solid #28a745', 
          paddingBottom: '0.5rem',
          marginBottom: '1rem'
        }}>
          {title}
        </h2>
        {respuestas.map((resp, index) => (
          <div key={resp.id || index} style={{ 
            marginBottom: '1.5rem', 
            padding: '1rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <strong style={{ color: '#2c3e50', fontSize: '1rem' }}>
                Pregunta {index + 1}:
              </strong>
              <button
                onClick={() => onEdit?.(type, index)}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.85rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Editar
              </button>
            </div>
            <p style={{ margin: '0 0 0.75rem 0', color: '#495057', fontStyle: 'italic' }}>
              {type === 'generic' 
                ? (resp.generic_questions?.pregunta || resp.pregunta)
                : (resp.pregunta || resp.dynamic_questions?.pregunta)
              }
            </p>
            <div style={{ 
              backgroundColor: 'white', 
              padding: '1rem', 
              borderRadius: '4px',
              border: '1px solid #dee2e6',
              whiteSpace: 'pre-wrap',
              minHeight: '60px'
            }}>
              {resp.respuesta}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '1rem', textAlign: 'center' }}>
        <p>Cargando resumen final...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '1rem', textAlign: 'center', color: 'red' }}>
        <p>Error al cargar datos: {error}</p>
        <button onClick={onBack} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem' }}>
          Volver
        </button>
      </div>
    );
  }

  if (!idea) {
    return (
      <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '1rem', textAlign: 'center' }}>
        <p>Idea no encontrada</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '1rem' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ color: '#2c3e50', marginBottom: '0.5rem' }}>Resumen Final Completo</h1>
        <p style={{ color: '#666' }}>Idea ID: {idea_id}</p>
      </div>

      <div style={{ 
        marginBottom: '2rem', 
        padding: '1.5rem', 
        backgroundColor: '#e8f5e9', 
        borderRadius: '8px',
        border: '1px solid #c8e6c9'
      }}>
        <h2 style={{ color: '#2e7d32', marginTop: 0 }}>Idea Original</h2>
        <p style={{ whiteSpace: 'pre-wrap', fontSize: '1.1rem', color: '#1b5e20' }}>
          {idea.texto_idea}
        </p>
      </div>

      {renderRespuestaSection(
        `Descubrimiento (${generic_respuestas.length} preguntas genéricas)`,
        generic_respuestas,
        'generic'
      )}

      {renderRespuestaSection(
        `Análisis Profundo (${dynamic_respuestas.length} preguntas dinámicas)`,
        dynamic_respuestas,
        'dynamic'
      )}

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
          disabled={genLoading}
          style={{
            flex: 1,
            minWidth: '160px',
            maxWidth: '200px',
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            backgroundColor: genLoading ? '#ccc' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: genLoading ? 'not-allowed' : 'pointer',
          }}
        >
          Volver
        </button>
        <button
          onClick={handleGenerateDocument}
          disabled={genLoading}
          style={{
            flex: 1,
            minWidth: '180px',
            maxWidth: '200px',
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            backgroundColor: genLoading ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: genLoading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          {genLoading ? 'Generando...' : '⬇️ Descargar HTML'}
        </button>
        <button
          onClick={handleDownloadMarkdown}
          disabled={genLoading}
          style={{
            flex: 1,
            minWidth: '200px',
            maxWidth: '220px',
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            backgroundColor: genLoading ? '#ccc' : '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: genLoading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          {genLoading ? 'Generando...' : '⬇️ Descargar Markdown'}
        </button>
        <button
          onClick={handleDownloadPDF}
          disabled={genLoading}
          style={{
            flex: 1,
            minWidth: '180px',
            maxWidth: '200px',
            padding: '1rem 2rem',
            fontSize: '1.1rem',
            backgroundColor: genLoading ? '#ccc' : '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: genLoading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
          }}
        >
          {genLoading ? 'Generando...' : '⬇️ Descargar PDF'}
        </button>
      </div>

      {genError && (
        <div style={{ color: 'red', marginTop: '1rem', textAlign: 'center', width: '100%' }}>
          Error: {genError}
        </div>
      )}
    </div>
  );
}

export default FinalResumen;