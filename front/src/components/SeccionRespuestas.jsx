import { memo } from 'react';
import ResumenItem from './ResumenItem';

function SeccionRespuestas({ title, respuestas = [], emptyLabel, resolveQuestion, onEdit }) {
  return (
    <section className="mb-8">
      <h2 className="mb-5 border-b border-dust pb-2 font-display text-xl font-bold text-ink">
        {title}
      </h2>

      {respuestas.length === 0 ? (
        <p className="font-body text-stone">{emptyLabel}</p>
      ) : (
        respuestas.map((resp, idx) => (
          <ResumenItem
            key={resp.id ?? idx}
            index={idx}
            pregunta={resolveQuestion(resp, idx)}
            respuesta={resp.respuesta}
            onClick={() => onEdit(idx)}
          />
        ))
      )}
    </section>
  );
}

export default memo(SeccionRespuestas);
