# Architecture

## Overview

Jarvis Creator es una aplicación de dos capas:
- **Frontend:** React PWA con navegación entre componentes
- **Backend:** Express API con conexión a Supabase y Groq

## Frontend Architecture

### State Management (App.jsx)

Estado global en App.jsx:
- `currentStep`: Stage actual ('idea' | 'questions' | 'resume' | 'dynamic-questions' | 'final-resume' | 'edit-question' | 'dynamic-questions-edit')
- `ideaId`: UUID de idea actual
- `questionIndex`: Índice pregunta genérica actual (0-4)
- `dynamicQuestionIndex`: Índice pregunta dinámica actual (0-9)
- `editingQuestionType`: Tipo edición ('generic' | 'dynamic' | null)
- `editingQuestionIndex`: Índice pregunta siendo editada

### Component Hierarchy

```
App.jsx (orquestador)
├── MainNav (tabs 'Ideas' | 'Plan')
├── IdeaForm (crear idea)
├── QuestionForm (5 preguntas genéricas)
├── ResumenForm (resumen + editar genéricas)
├── DynamicQuestionForm (10 preguntas dinámicas)
├── FinalResumen (resumen final + descarga Markdown + generar plan)
├── MyIdeas (lista ideas + filtros)
└── PlanView (árbol épica → story → task → subtask, checkboxes de estado)
```

### Data Flow

1. **IdeaForm** → POST /api/ideas → setIdeaId → QuestionForm
2. **QuestionForm** → GET /api/questions → POST /api/respuestas → ResumenForm
3. **ResumenForm** → onEdit → QuestionForm (editMode=true)
4. **ResumenForm** → "Análisis profundo" → DynamicQuestionForm
5. **DynamicQuestionForm** → POST /api/ideas/:id/generate-dynamic-questions → mostrar 10
6. **DynamicQuestionForm** → POST /api/dynamic-respuestas → FinalResumen
7. **FinalResumen** → onEdit → QuestionForm/DynamicQuestionForm (editMode=true)
8. **FinalResumen** → Descargar → POST /api/ideas/:id/generate-final-markdown
9. **FinalResumen** → "Generar Plan de Trabajo" → POST /api/ideas/:id/generate-plan → habilita tab "Plan"
10. **PlanView** → GET épicas/stories/tasks/subtasks en cascada → árbol expandible con PATCH de estado optimista

## Backend Architecture

### Routing Structure

Actual (monolítico en index.js):

```
POST /api/ideas
GET /api/ideas
GET /api/ideas/:id
PATCH /api/ideas/:id
DELETE /api/ideas/:id
GET /api/questions
POST /api/respuestas
GET /api/ideas/:id/respuestas
POST /api/ideas/:id/generate-dynamic-questions
GET /api/ideas/:id/dynamic-questions
POST /api/dynamic-respuestas
GET /api/ideas/:id/dynamic-respuestas
GET /api/ideas/:id/summary
POST /api/ideas/:id/generate-final-markdown
POST /api/ideas/:id/generate-plan
GET /api/plans/:plan_id/epicas
GET /api/epicas/:epica_id
PATCH /api/epicas/:epica_id
GET /api/epicas/:epica_id/stories
GET /api/stories/:story_id
PATCH /api/stories/:story_id
GET /api/stories/:story_id/tasks
GET /api/tasks/:task_id
PATCH /api/tasks/:task_id
GET /api/tasks/:task_id/subtasks
GET /api/subtasks/:subtask_id
PATCH /api/subtasks/:subtask_id
```

### Target Structure (Refactor Plan)

```
back/
├── index.js                 # Entry point
├── routes/
│   ├── ideas.js             # CRUD ideas
│   ├── questions.js         # Preguntas genéricas
│   ├── respuestas.js        # Respuestas genéricas
│   ├── dynamic-questions.js # Preguntas dinámicas (Groq)
│   ├── dynamic-respuestas.js# Respuestas dinámicas
│   └── documents.js         # Generación docs
├── services/
│   ├── supabase.js          # Cliente Supabase
│   ├── groq.js              # Cliente Groq
│   ├── pdf-generator.js     # Generación PDF
│   └── html-generator.js    # Generación HTML
├── middleware/
│   ├── auth.js              # Auth middleware
│   └── validation.js        # Validaciones
└── utils/
    ├── errors.js            # Error handling
    └── helpers.js           # Helpers
```

### Database Schema (Supabase)

```sql
ideas
- id (uuid, pk)
- texto_idea (text)
- estado (enum: 'draft' | 'refined')
- created_at (timestamptz)
- updated_at (timestamptz)

generic_questions
- id (uuid, pk)
- pregunta (text)
- orden (int)

respuestas
- id (uuid, pk)
- idea_id (uuid, fk -> ideas)
- generic_question_id (uuid, fk -> generic_questions)
- respuesta (text)

dynamic_questions
- id (uuid, pk)
- idea_id (uuid, fk -> ideas)
- pregunta (text)
- orden (int)

dynamic_respuestas
- id (uuid, pk)
- idea_id (uuid, fk -> ideas)
- dynamic_question_id (uuid, fk -> dynamic_questions)
- respuesta (text)

documents
- id (uuid, pk)
- idea_id (uuid, fk -> ideas)
- tipo (enum: 'html' | 'markdown' | 'pdf')
- contenido (text)
- created_at (timestamptz)

work_plans
- id (uuid, pk)
- idea_id (uuid, fk -> ideas, unique)
- created_at (timestamptz)

epicas
- id (uuid, pk)
- plan_id (uuid, fk -> work_plans)
- titulo (text), descripcion (text), orden (int)
- estado (enum: 'pendiente' | 'en_progreso' | 'completada')

user_stories
- id (uuid, pk)
- epica_id (uuid, fk -> epicas)
- titulo (text), descripcion (text), criterios_aceptacion (text), orden (int)
- estado (enum: 'pendiente' | 'en_progreso' | 'completada')

tasks
- id (uuid, pk)
- user_story_id (uuid, fk -> user_stories)
- titulo (text), descripcion (text), orden (int)
- frente (enum: 'definicion' | 'ux_ui' | 'frontend' | 'backend' | 'testing' | 'devops')
- estado (enum: 'pendiente' | 'en_progreso' | 'completada')

subtasks
- id (uuid, pk)
- task_id (uuid, fk -> tasks)
- titulo (text), descripcion (text), orden (int)
- tiempo_estimado_min (int, ≤ 30)
- estado (enum: 'pendiente' | 'en_progreso' | 'completada')
```

### External Services

- **Supabase:** PostgreSQL + Auth + Realtime
- **Groq API:** LLM (llama-3.3-70b-versatile) para generación de preguntas dinámicas

## Testing Architecture

### Backend (Vitest)
- `tests/api.test.js` - Endpoints REST
- `tests/jarvis.test.js` - Flujo E2E
- `tests/setup.js` - Mock Supabase/Groq

### Frontend (Vitest + Testing Library)
- `tests/App.test.jsx` - Componentes unitarios
- `tests/e2e.test.jsx` - Flujo completo usuario

## Security Considerations

- Service role key solo en backend
- CORS configurado para FRONTEND_URL
- Validación de UUID en params
- Rate limiting en endpoints Groq

## Performance

- Fetch único en ResumenForm para resumen final
- Lazy loading de componentes pesados
- Caché de preguntas genéricas en frontend

## API Response Pattern

Todos los endpoints retornan:

```json
{
  "status": "ok" | "error",
  "data": {...} | null,
  "message": "error message" | null
}
```

## Error Handling

Actual: try/catch básico
Necesario: middleware centralizado de errores

## Groq Integration

En `generateDynamicQuestions()`:
1. Obtén idea + respuestas genéricas de Supabase
2. Construye prompt con contexto
3. Llama Groq API con "llama-3.3-70b-versatile" (configurable via GROQ_MODEL)
4. Parse JSON de respuesta
5. Inserta 10 preguntas en dynamic_questions
6. Retorna preguntas

## Data Flow End-to-End

```
Usuario crea idea
    ↓
POST /api/ideas → Supabase
    ↓
Frontend: ideaId guardado
    ↓
GET /api/questions → 5 preguntas estáticas
    ↓
Usuario responde 5 preguntas
    ↓
POST /api/respuestas × 5 → Supabase
    ↓
GET /api/ideas/:id/respuestas → ResumenForm
    ↓
Usuario clickea "Análisis profundo"
    ↓
POST /api/ideas/:id/generate-dynamic-questions
    ├─ GET idea + respuestas de Supabase
    ├─ Llama Groq API
    ├─ INSERT 10 preguntas en dynamic_questions
    └─ Retorna preguntas
    ↓
Usuario responde 10 preguntas dinámicas
    ↓
POST /api/dynamic-respuestas × 10 → Supabase
    ↓
GET /api/ideas/:id/summary → FinalResumen
    ↓
Descarga: POST /api/ideas/:id/generate-final-*
```