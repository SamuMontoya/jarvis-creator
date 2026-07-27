import { describe, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PlanView from '../src/components/PlanView';
import { ToastProvider } from '../src/context/ToastContext';
import { IDEA_ID, mockApi } from './helpers';

const PLAN_ID = 'plan-1';
const EPICA_ID = 'epica-1';
const STORY_ID = 'story-1';
const TASK_ID = 'task-1';
const SUBTASK_ID = 'subtask-1';

// Épica, story y task quedan siempre en 'completada': así "En progreso" solo
// puede venir de la subtask cuando el checkbox la hace avanzar, sin
// ambigüedad con el resto del árbol.
const epica = {
  id: EPICA_ID,
  titulo: 'Épica de prueba',
  descripcion: 'Descripción de la épica',
  orden: 1,
  estado: 'completada',
};

const story = {
  id: STORY_ID,
  epica_id: EPICA_ID,
  titulo: 'Story de prueba',
  criterios_aceptacion: 'Criterios de aceptación',
  orden: 1,
  estado: 'completada',
};

const task = {
  id: TASK_ID,
  user_story_id: STORY_ID,
  titulo: 'Task de prueba',
  descripcion: 'Descripción de la task',
  frente: 'definicion',
  orden: 1,
  estado: 'completada',
};

const subtask = {
  id: SUBTASK_ID,
  task_id: TASK_ID,
  titulo: 'Subtask de prueba',
  tiempo_estimado_min: 20,
  orden: 1,
  estado: 'pendiente',
};

const taskHeaderText = `Definición: ${task.titulo}`;

const patchSubtaskOk = {
  body: { status: 'ok', subtask: { ...subtask, estado: 'en_progreso' } },
};

const baseRoutes = {
  [`GET /plans/${PLAN_ID}/epicas`]: { epicas: [epica] },
  [`GET /epicas/${EPICA_ID}/stories`]: { stories: [story] },
  [`GET /stories/${STORY_ID}/tasks`]: { tasks: [task] },
  [`GET /tasks/${TASK_ID}/subtasks`]: { subtasks: [subtask] },
  [`PATCH /subtasks/${SUBTASK_ID}`]: patchSubtaskOk,
};

const renderPlanView = () =>
  render(
    <ToastProvider>
      <PlanView planId={PLAN_ID} ideaId={IDEA_ID} />
    </ToastProvider>
  );

// Expande los 3 niveles con caret (épica → story → task) y deja la subtask visible.
async function expandToSubtask(user) {
  await screen.findByText(epica.titulo);
  await user.click(screen.getByText(epica.titulo));

  await screen.findByText(story.titulo);
  await user.click(screen.getByText(story.titulo));

  await screen.findByText(taskHeaderText);
  await user.click(screen.getByText(taskHeaderText));

  await screen.findByText(subtask.titulo);
}

describe('PlanView Component', () => {
  test('Renderiza árbol jerárquico 4 niveles expandible', async () => {
    mockApi(baseRoutes);
    const user = userEvent.setup();

    renderPlanView();

    await screen.findByText(epica.titulo);
    expect(screen.queryByText(story.titulo)).not.toBeInTheDocument();

    await user.click(screen.getByText(epica.titulo));
    await screen.findByText(story.titulo);
    expect(screen.queryByText(taskHeaderText)).not.toBeInTheDocument();

    await user.click(screen.getByText(story.titulo));
    await screen.findByText(taskHeaderText);
    expect(screen.queryByText(subtask.titulo)).not.toBeInTheDocument();

    await user.click(screen.getByText(taskHeaderText));
    await screen.findByText(subtask.titulo);

    // Colores antes de tocar nada: épica/story/task = completada (verde),
    // subtask = pendiente (gris).
    expect(screen.getByTitle('Pendiente')).toHaveStyle({ backgroundColor: '#e9ecef' });
    screen
      .getAllByTitle('Completada')
      .forEach((btn) => expect(btn).toHaveStyle({ backgroundColor: '#28a745' }));

    // El click en el checkbox de la subtask trae el tercer color (amarillo).
    await user.click(screen.getByTitle('Pendiente'));
    await waitFor(() =>
      expect(screen.getByTitle('En progreso')).toHaveStyle({ backgroundColor: '#ffc107' })
    );

    // Colapsar de nuevo la épica oculta todo lo de abajo.
    await user.click(screen.getByText(epica.titulo));
    expect(screen.queryByText(story.titulo)).not.toBeInTheDocument();
    expect(screen.queryByText(subtask.titulo)).not.toBeInTheDocument();
  });

  test('Click checkbox ejecuta PATCH y actualiza UI', async () => {
    const calls = mockApi(baseRoutes);
    const user = userEvent.setup();

    renderPlanView();
    await expandToSubtask(user);

    expect(screen.getByTitle('Pendiente')).toBeInTheDocument();
    await user.click(screen.getByTitle('Pendiente'));

    await waitFor(() => expect(screen.getByTitle('En progreso')).toBeInTheDocument());

    const patchCall = calls.find(
      (c) => c.method === 'PATCH' && c.url.includes(`/subtasks/${SUBTASK_ID}`)
    );
    expect(patchCall).toBeTruthy();
    expect(patchCall.body).toEqual({ estado: 'en_progreso' });
  });

  test('Error en PATCH revierte estado y muestra toast', async () => {
    mockApi({
      ...baseRoutes,
      [`PATCH /subtasks/${SUBTASK_ID}`]: {
        status: 500,
        body: { status: 'error', message: 'No se pudo actualizar la subtask' },
      },
    });
    const user = userEvent.setup();

    renderPlanView();
    await expandToSubtask(user);

    await user.click(screen.getByTitle('Pendiente'));

    expect(await screen.findByText('No se pudo actualizar la subtask')).toBeInTheDocument();
    expect(screen.getByTitle('Pendiente')).toBeInTheDocument();
    expect(screen.queryByTitle('En progreso')).not.toBeInTheDocument();
  });
});
