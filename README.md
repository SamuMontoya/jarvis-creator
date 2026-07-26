# Jarvis Creator

Sistema de creación de productos impulsado por IA. Define tu idea, responde preguntas de descubrimiento, genera preguntas dinámicas con Groq, y descarga la documentación en Markdown o PDF.

## Quick Start

```bash
git clone https://github.com/smontoyag/jarvis-creator.git
cd jarvis-creator
npm install

# Terminal 1: Backend
cd back && npm run dev

# Terminal 2: Frontend
cd front && npm run dev

# Accede a http://localhost:5173
```

## Stack

- **Frontend:** React 19 + Vite (estilos inline, sin framework CSS)
- **Backend:** Express + Node.js
- **DB:** Supabase (PostgreSQL)
- **LLM:** Groq API (llama-3.3-70b-versatile)
- **Tests:** Vitest (backend), Vitest (frontend)

## Arquitectura

```
jarvis-creator/
├── front/                    # React PWA
│   ├── src/
│   │   ├── components/      # IdeaForm, QuestionForm, etc
│   │   ├── App.jsx          # State management
│   │   └── main.jsx
│   ├─ tests/               # Vitest tests
│   └── vite.config.js
├── back/                     # Express API
│   ├── index.js             # Main server
│   ├── tests/               # Vitest tests
│   ├── .env                 # Credentials
│   └── package.json
└── README.md
```

## Flujo de Usuario

1. **Crear idea** → Envía descripción de idea
2. **Preguntas genéricas** → 5 preguntas de descubrimiento
3. **Resumen 1** → Revisa y edita respuestas
4. **Análisis profundo** → Groq genera 10 preguntas adicionales
5. **Preguntas dinámicas** → Responde 10 preguntas profundas
6. **Resumen final** → Revisa todas las respuestas (5+10)
7. **Descargar** → HTML, Markdown o PDF

## Endpoints

### Ideas
- `POST /api/ideas` - Crear idea
- `GET /api/ideas` - Listar ideas
- `GET /api/ideas/:id` - Obtener idea con respuestas
- `PATCH /api/ideas/:id` - Actualizar idea
- `DELETE /api/ideas/:id` - Eliminar idea

### Preguntas Genéricas
- `GET /api/questions` - Obtener 5 preguntas

### Respuestas Genéricas
- `POST /api/respuestas` - Guardar respuesta
- `GET /api/respuestas/:ideaId` - Obtener respuestas

### Preguntas Dinámicas (Groq)
- `POST /api/ideas/:id/generate-dynamic-questions` - Generar 10 preguntas con Groq
- `GET /api/ideas/:id/dynamic-questions` - Obtener preguntas dinámicas

### Respuestas Dinámicas
- `POST /api/dynamic-respuestas` - Guardar respuesta
- `GET /api/ideas/:id/dynamic-respuestas` - Obtener respuestas

### Resúmenes y Generación
- `GET /api/ideas/:id/summary` - Resumen completo (idea + 5 + 10)
- `POST /api/ideas/:id/generate-final-html` - Generar HTML final
- `POST /api/ideas/:id/generate-final-markdown` - Generar Markdown
- `POST /api/ideas/:id/generate-final-pdf` - Generar PDF

## Tests

```bash
# Backend
cd back && npm run test:vitest

# Frontend
cd front && npm test
```

## Variables de Entorno (back/.env)

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GROQ_API_KEY=your_groq_api_key
PORT=3001
FRONTEND_URL=http://localhost:5173
```

## Deploy

Frontend PWA a Vercel/Netlify, backend a Railway/Render.

## Features

- ✅ Crear idea con descripción libre
- ✅ 5 preguntas descubrimiento
- ✅ Editar respuestas antes de confirmar
- ✅ Generar 10 preguntas dinámicas con Groq
- ✅ Resumen final interactivo (5+10)
- ✅ Descargar Markdown, PDF, HTML
- ✅ Listar ideas (ordenado por fecha)
- ✅ Filtrar (Todos/Borradores/Completadas)
- ✅ Eliminar idea con confirmación
- ✅ Recuperar progreso al recargar

## Next

- Refactor: separar rutas backend en archivos
- Logging estructurado
- Tests E2E completos
- Validaciones exhaustivas
- Análisis de código/best practices