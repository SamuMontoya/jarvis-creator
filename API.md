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

### POST /api/ideas/:id/generate-final-html

Generar HTML final.

**Response (200):**
```json
{
  "status": "ok",
  "html": "<html>...</html>"
}
```

---

### POST /api/ideas/:id/generate-final-markdown

Generar Markdown final.

**Response (200):**
```json
{
  "status": "ok",
  "markdown": "# Idea\n\n..."
}
```

---

### POST /api/ideas/:id/generate-final-pdf

Generar PDF final.

**Response (200):**
```json
{
  "status": "ok",
  "pdf_url": "data:application/pdf;base64,..."
}
```

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