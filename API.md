# API Documentation

## Base URL

Development: `http://localhost:3001`
Production: `https://jarvis-creator-api.example.com`

## Authentication

No hay autenticación actualmente. Supabase usa clave pública (SUPABASE_ANON_KEY).

## Response Format

Todos los endpoints retornan:

```json
{
  "status": "ok" | "error",
  "message": "string opcional",
  "[data_key]": {...}
}
```

---

## Ideas

### POST /api/ideas

Crear nueva idea.

**Request:**
```json
{
  "texto_idea": "Crear una app de productividad"
}
```

**Response (200):**
```json
{
  "status": "ok",
  "idea": {
    "id": "uuid",
    "texto_idea": "...",
    "estado": "draft",
    "created_at": "2026-07-25T...",
    "updated_at": "2026-07-25T..."
  }
}
```

---

### GET /api/ideas

Listar todas las ideas (ordenadas por updated_at DESC).

**Response (200):**
```json
{
  "status": "ok",
  "ideas": [
    {
      "id": "uuid",
      "texto_idea": "...",
      "estado": "draft",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

---

### GET /api/ideas/:id

Obtener idea con respuestas genéricas y dinámicas.

**Response (200):**
```json
{
  "status": "ok",
  "idea": {
    "id": "uuid",
    "texto_idea": "...",
    "estado": "refined",
    "created_at": "...",
    "updated_at": "..."
  },
  "respuestas": [...],
  "dynamic_respuestas": [...]
}
```

---

### PATCH /api/ideas/:id

Actualizar idea (estado, md_final, etc).

**Request:**
```json
{
  "estado": "refined",
  "md_final": "# Idea..."
}
```

**Response (200):**
```json
{
  "status": "ok",
  "idea": {...}
}
```

---

### DELETE /api/ideas/:id

Eliminar idea (cascada: elimina respuestas relacionadas).

**Response (200):**
```json
{
  "status": "ok",
  "deleted": true
}
```

---

## Generic Questions

### GET /api/questions

Obtener 5 preguntas de descubrimiento.

**Response (200):**
```json
{
  "status": "ok",
  "questions": [
    {
      "id": "uuid",
      "pregunta": "¿Quién usará esto...",
      "orden": 1
    }
  ]
}
```

---

### POST /api/respuestas

Guardar respuesta a pregunta genérica.

**Request:**
```json
{
  "idea_id": "uuid",
  "generic_question_id": "uuid",
  "respuesta": "Mi respuesta"
}
```

**Response (200):**
```json
{
  "status": "ok",
  "respuesta": {
    "id": "uuid",
    "idea_id": "uuid",
    "generic_question_id": "uuid",
    "respuesta": "Mi respuesta",
    "created_at": "..."
  }
}
```

---

### GET /api/ideas/:id/respuestas

Obtener respuestas genéricas de una idea.

**Response (200):**
```json
{
  "status": "ok",
  "respuestas": [
    {
      "id": "uuid",
      "generic_question_id": "uuid",
      "respuesta": "...",
      "generic_questions": {
        "pregunta": "...",
        "orden": 1
      }
    }
  ]
}
```

---

## Dynamic Questions (Groq)

### POST /api/ideas/:id/generate-dynamic-questions

Generar 10 preguntas dinámicas via Groq LLM.

**Response (200):**
```json
{
  "status": "ok",
  "dynamic_questions": [
    {
      "id": "uuid",
      "pregunta": "¿Cómo monetizar...",
      "orden": 1
    }
  ]
}
```

---

### GET /api/ideas/:id/dynamic-questions

Obtener preguntas dinámicas de una idea.

**Response (200):**
```json
{
  "status": "ok",
  "dynamic_questions": [
    {
      "id": "uuid",
      "pregunta": "...",
      "orden": 1
    }
  ]
}
```

---

### POST /api/dynamic-respuestas

Guardar respuesta a pregunta dinámica.

**Request:**
```json
{
  "idea_id": "uuid",
  "dynamic_question_id": "uuid",
  "respuesta": "Mi respuesta"
}
```

**Response (200):**
```json
{
  "status": "ok",
  "respuesta": {
    "id": "uuid",
    "idea_id": "uuid",
    "dynamic_question_id": "uuid",
    "respuesta": "Mi respuesta",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

---

### GET /api/ideas/:id/dynamic-respuestas

Obtener respuestas dinámicas de una idea.

**Response (200):**
```json
{
  "status": "ok",
  "dynamic_respuestas": [
    {
      "id": "uuid",
      "dynamic_question_id": "uuid",
      "respuesta": "...",
      "dynamic_questions": {
        "pregunta": "...",
        "orden": 1
      }
    }
  ]
}
```

---

## Summary & Documents

### GET /api/ideas/:id/summary

Obtener resumen completo (idea + 5 genéricas + 10 dinámicas + respuestas).

**Response (200):**
```json
{
  "status": "ok",
  "idea": {...},
  "questions": [...],
  "respuestas": [...],
  "dynamic_questions": [...],
  "dynamic_respuestas": [...]
}
```

---

### POST /api/ideas/:id/generate-final-markdown

Generar Markdown final. Es la única descarga que expone el frontend (HTML y
PDF fueron retirados de la UI).

**Response (200):**
```json
{
  "status": "ok",
  "markdown": "# Idea\n\n..."
}
```

---

## Plan de Trabajo (Groq)

Jerarquía lineal generada a partir de una idea: `work_plan → epicas → user_stories → tasks → subtasks`.
Cada `user_story` trae exactamente 6 `tasks`, una por cada frente de `PLAN_FRENTES` (`definicion`,
`ux_ui`, `frontend`, `backend`, `testing`, `devops`), y cada `task` trae de 2 a 3 `subtasks`
(`tiempo_estimado_min` ≤ 30).

### POST /api/ideas/:id/generate-plan

Generar el plan de trabajo completo vía Groq. Idempotente: si la idea ya tiene un plan, devuelve el
existente (`already_exists: true`) en vez de regenerar.

**Response (201, primera vez):**
```json
{
  "status": "ok",
  "plan_id": "uuid",
  "epicas_count": 3,
  "stories_count": 12,
  "tasks_count": 72,
  "subtasks_count": 144
}
```

**Response (200, ya existía):**
```json
{
  "status": "ok",
  "plan_id": "uuid",
  "already_exists": true
}
```

---

### GET /api/plans/:plan_id/epicas

Listar épicas de un plan, ordenadas por `orden`.

**Response (200):**
```json
{
  "status": "ok",
  "epicas": [
    { "id": "uuid", "plan_id": "uuid", "titulo": "...", "descripcion": "...", "orden": 1, "estado": "pendiente" }
  ]
}
```

---

### GET /api/epicas/:epica_id

Obtener una épica.

**Response (200):** `{ "status": "ok", "epica": {...} }`

---

### PATCH /api/epicas/:epica_id

Actualizar título, descripción o estado de una épica.

**Request:** `{ "estado": "en_progreso" }` (también acepta `titulo`, `descripcion`)

**Response (200):** `{ "status": "ok", "epica": {...} }`

---

### GET /api/epicas/:epica_id/stories

Listar user stories de una épica, ordenadas por `orden`.

**Response (200):**
```json
{
  "status": "ok",
  "stories": [
    { "id": "uuid", "epica_id": "uuid", "titulo": "...", "criterios_aceptacion": "...", "orden": 1, "estado": "pendiente" }
  ]
}
```

---

### GET /api/stories/:story_id

Obtener una user story. **Response (200):** `{ "status": "ok", "story": {...} }`

---

### PATCH /api/stories/:story_id

Actualizar título, descripción, criterios de aceptación o estado.

**Request:** `{ "estado": "completada" }`

**Response (200):** `{ "status": "ok", "story": {...} }`

---

### GET /api/stories/:story_id/tasks

Listar las 6 tasks de una story (una por frente), ordenadas por `orden`.

**Response (200):**
```json
{
  "status": "ok",
  "tasks": [
    { "id": "uuid", "user_story_id": "uuid", "titulo": "...", "frente": "definicion", "orden": 1, "estado": "pendiente" }
  ]
}
```

---

### GET /api/tasks/:task_id

Obtener una task. **Response (200):** `{ "status": "ok", "task": {...} }`

---

### PATCH /api/tasks/:task_id

Actualizar título, descripción o estado.

**Request:** `{ "estado": "en_progreso" }`

**Response (200):** `{ "status": "ok", "task": {...} }`

---

### GET /api/tasks/:task_id/subtasks

Listar subtasks de una task, ordenadas por `orden`.

**Response (200):**
```json
{
  "status": "ok",
  "subtasks": [
    { "id": "uuid", "task_id": "uuid", "titulo": "...", "tiempo_estimado_min": 20, "orden": 1, "estado": "pendiente" }
  ]
}
```

---

### GET /api/subtasks/:subtask_id

Obtener una subtask. **Response (200):** `{ "status": "ok", "subtask": {...} }`

---

### PATCH /api/subtasks/:subtask_id

Actualizar título, descripción, estado o `tiempo_estimado_min` (debe ser ≤ 30).

**Request:** `{ "estado": "completada" }`

**Response (200):** `{ "status": "ok", "subtask": {...} }`

**Response (400):** `tiempo_estimado_min` > 30 → `{ "status": "error", "message": "tiempo_estimado_min no puede ser mayor a 30" }`

---

## Error Responses

Todos los errores siguen este formato:

```json
{
  "status": "error",
  "message": "Descripción del error",
  "data": null
}
```

**Códigos comunes:**
- 400: Bad Request (validación fallida)
- 404: Recurso no encontrado
- 500: Error interno del servidor
- 503: Servicio Groq no disponible