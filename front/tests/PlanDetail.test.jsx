import { describe, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

import PlanDetail from '../src/components/PlanDetail';
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
const fullPlanTree = {
  epicas: [
    {
      id: EPICA_ID,
      titulo: 'Épica de prueba',
      descripcion: 'Descripción de la épica',
      orden: 1,
      estado: 'completada',
      stories: [
        {
          id: STORY_ID,
          epica_id: EPICA_ID,
          titulo: 'Story de prueba',
          criterios_aceptacion: 'Criterios de aceptación',
          orden: 1,
          estado: 'completada',
          tasks: [
            {
              id: TASK_ID,
              user_story_id: STORY_ID,
              titulo: 'Task de prueba',
              descripcion: 'Descripción de la task',
              frente: 'definicion',
              orden: 1,
              estado: 'completada',
              subtasks: [
                {
                  id: SUBTASK_ID,
                  task_id: TASK_ID,
                  titulo: 'Subtask de prueba',
                  tiempo_estimado_min: 20,
                  orden: 1,
                  estado: 'pendiente',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const taskHeaderText = `Definición: ${fullPlanTree.epicas[0].stories[0].tasks[0].titulo}`;

const patchSubtaskOk = {
  body: { status: 'ok', subtask: { ...fullPlanTree.epicas[0].stories[0].tasks[0].subtasks[0], estado: 'en_progreso' } },
};

const baseRoutes = {
  [`GET /plans/${PLAN_ID}/full`]: fullPlanTree,
  [`PATCH /subtasks/${SUBTASK_ID}`]: patchSubtaskOk,
};

const renderPlanDetail = () =>
  render(
    <MemoryRouter initialEntries={[`/ideas/${IDEA_ID}/planes/${PLAN_ID}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/ideas/:ideaId/planes/:planId" element={<PlanDetail />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );

// Expande los 3 niveles con caret (épica → story → task) y deja la subtask visible.
async function expandToSubtask(user) {
  const epica = fullPlanTree.epicas[0];
  const story = epica.stories[0];

  await screen.findByText(epica.titulo);
  await user.click(screen.getByText(epica.titulo));

  await screen.findByText(story.titulo);
  await user.click(screen.getByText(story.titulo));

  await screen.findByText(taskHeaderText);
  await user.click(screen.getByText(taskHeaderText));

  await screen.findByText(story.tasks?.[0]?.subtasks?.[0]?.titulo ?? 'Subtask de prueba');
}

describe('PlanDetail Component', () => {
  test('Renderiza árbol jerárquico 4 niveles expandible desde un solo request', async () => {
    const calls = mockApi(baseRoutes);
    const user = userEvent.setup();
    const epica = fullPlanTree.epicas[0];
    const story = epica.stories[0];
    const subtask = story.tasks[0].subtasks[0];

    renderPlanDetail();

    await screen.findByText(epica.titulo);
    expect(screen.queryByText(story.titulo)).not.toBeInTheDocument();
    // A single batched request for the whole tree — no per-node waterfall.
    expect(calls.filter((c) => c.url.includes('/full')).length).toBe(1);

    await user.click(screen.getByText(epica.titulo));
    await screen.findByText(story.titulo);
    expect(screen.queryByText(taskHeaderText)).not.toBeInTheDocument();

    await user.click(screen.getByText(story.titulo));
    await screen.findByText(taskHeaderText);
    expect(screen.queryByText(subtask.titulo)).not.toBeInTheDocument();

    await user.click(screen.getByText(taskHeaderText));
    await screen.findByText(subtask.titulo);

    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getAllByText('Completada').length).toBeGreaterThanOrEqual(3);

    // El click en el pill de la subtask trae el tercer estado.
    await user.click(screen.getByText('Pendiente'));
    await waitFor(() => expect(screen.getByText('En progreso')).toBeInTheDocument());

    // Colapsar de nuevo la épica oculta todo lo de abajo.
    await user.click(screen.getByText(epica.titulo));
    expect(screen.queryByText(story.titulo)).not.toBeInTheDocument();
    expect(screen.queryByText(subtask.titulo)).not.toBeInTheDocument();
  });

  test('Click en el pill de estado ejecuta PATCH y actualiza UI', async () => {
    const calls = mockApi(baseRoutes);
    const user = userEvent.setup();

    renderPlanDetail();
    await expandToSubtask(user);

    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    await user.click(screen.getByText('Pendiente'));

    await waitFor(() => expect(screen.getByText('En progreso')).toBeInTheDocument());

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

    renderPlanDetail();
    await expandToSubtask(user);

    await user.click(screen.getByText('Pendiente'));

    expect(await screen.findByText('No se pudo actualizar la subtask')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.queryByText('En progreso')).not.toBeInTheDocument();
  });
});
