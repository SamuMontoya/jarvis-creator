import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import QuestionCard from '../src/components/QuestionCard';
import QuestionHeader from '../src/components/QuestionHeader';
import ResumenItem from '../src/components/ResumenItem';
import IdeaCard from '../src/components/IdeaCard';
import TabsFiltro from '../src/components/TabsFiltro';
import ConfirmDialog from '../src/components/ConfirmDialog';
import ErrorMessage from '../src/components/ErrorMessage';
import Spinner from '../src/components/Spinner';
import SeccionRespuestas from '../src/components/SeccionRespuestas';
import BotonesDescarga from '../src/components/BotonesDescarga';
import { makeIdea } from './helpers';

describe('QuestionHeader', () => {
  it('muestra el progreso en base 1, no en base 0', () => {
    render(<QuestionHeader currentIndex={0} total={5} title="Descubrimiento Inicial" />);

    expect(screen.getByText(/Descubrimiento Inicial — Pregunta 1 de 5/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveValue(1);
  });
});

describe('QuestionCard', () => {
  it('renderiza el texto de la pregunta', () => {
    render(<QuestionCard question="¿Cuál es tu cliente ideal?" value="" onChange={() => {}} />);

    expect(screen.getByText('¿Cuál es tu cliente ideal?')).toBeInTheDocument();
  });

  it('es un input controlado y propaga los cambios', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<QuestionCard question="P" value="" onChange={onChange} />);
    await user.type(screen.getByRole('textbox'), 'a');

    expect(onChange).toHaveBeenCalled();
  });

  it('deshabilita el textarea mientras guarda', () => {
    render(<QuestionCard question="P" value="" onChange={() => {}} disabled />);

    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});

describe('ResumenItem', () => {
  it('numera desde 1 y dispara la edición al hacer click', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(<ResumenItem index={0} pregunta="¿Problema?" respuesta="Paseos" onClick={onClick} />);

    expect(screen.getByText('1. ¿Problema?')).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('IdeaCard', () => {
  const formatDate = () => '01/07/2026';

  it('etiqueta las ideas refinadas como completadas', () => {
    render(
      <IdeaCard
        idea={makeIdea({ estado: 'refined' })}
        onContinue={() => {}}
        onDelete={() => {}}
        deletingId={null}
        formatDate={formatDate}
      />
    );

    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument();
  });

  it('pasa el id de la idea al pedir borrado', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    const idea = makeIdea();

    render(
      <IdeaCard
        idea={idea}
        onContinue={() => {}}
        onDelete={onDelete}
        deletingId={null}
        formatDate={formatDate}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onDelete).toHaveBeenCalledWith(idea.id);
  });

  it('bloquea ambos botones mientras se elimina', () => {
    const idea = makeIdea();

    render(
      <IdeaCard
        idea={idea}
        onContinue={() => {}}
        onDelete={() => {}}
        deletingId={idea.id}
        formatDate={formatDate}
      />
    );

    expect(screen.getByRole('button', { name: 'Eliminando...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });
});

describe('TabsFiltro', () => {
  const ideas = [
    makeIdea({ id: '1', estado: 'draft' }),
    makeIdea({ id: '2', estado: 'refined' }),
    makeIdea({ id: '3', estado: 'refined' }),
  ];

  it('cuenta las ideas por estado', () => {
    render(<TabsFiltro filter="all" onFilterChange={() => {}} ideas={ideas} />);

    expect(screen.getByRole('button', { name: 'Todas (3)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borradores (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completadas (2)' })).toBeInTheDocument();
  });

  it('notifica el filtro elegido', async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();

    render(<TabsFiltro filter="all" onFilterChange={onFilterChange} ideas={ideas} />);
    await user.click(screen.getByRole('button', { name: /Borradores/ }));

    expect(onFilterChange).toHaveBeenCalledWith('draft');
  });
});

describe('ConfirmDialog', () => {
  it('no renderiza nada cuando está cerrado', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="T" message="M" onConfirm={() => {}} onCancel={() => {}} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('confirma y cancela por separado', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open
        title="Eliminar idea"
        message="No se puede deshacer"
        confirmLabel="Eliminar"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onConfirm).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('ErrorMessage', () => {
  it('no renderiza nada sin mensaje', () => {
    const { container } = render(<ErrorMessage message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ofrece reintentar cuando hay handler', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(<ErrorMessage message="Falló la carga" onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Falló la carga');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('Spinner', () => {
  it('anuncia su etiqueta de carga', () => {
    render(<Spinner label="Cargando tus ideas..." />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tus ideas...');
  });
});

describe('SeccionRespuestas', () => {
  it('muestra el mensaje vacío sin respuestas', () => {
    render(
      <SeccionRespuestas
        title="Análisis Profundo"
        respuestas={[]}
        emptyLabel="Nada aún"
        resolveQuestion={() => ''}
        onEdit={() => {}}
      />
    );

    expect(screen.getByText('Nada aún')).toBeInTheDocument();
  });

  it('pasa el índice correcto al editar', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();

    render(
      <SeccionRespuestas
        title="Definición"
        respuestas={[
          { id: 'a', respuesta: 'R1' },
          { id: 'b', respuesta: 'R2' },
        ]}
        emptyLabel="Nada"
        resolveQuestion={(_r, i) => `P${i + 1}`}
        onEdit={onEdit}
      />
    );

    await user.click(screen.getByText('2. P2'));
    expect(onEdit).toHaveBeenCalledWith(1);
  });
});

describe('BotonesDescarga', () => {
  it('deshabilita todas las descargas mientras genera', () => {
    render(
      <BotonesDescarga
        onBack={() => {}}
        onDownloadHTML={() => {}}
        onDownloadMarkdown={() => {}}
        onDownloadPDF={() => {}}
        loading
      />
    );

    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled());
  });

  it('expone las tres descargas', () => {
    render(
      <BotonesDescarga
        onBack={() => {}}
        onDownloadHTML={() => {}}
        onDownloadMarkdown={() => {}}
        onDownloadPDF={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: /Descargar HTML/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Descargar Markdown/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Descargar PDF/ })).toBeEnabled();
  });
});
