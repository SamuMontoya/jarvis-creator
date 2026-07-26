# Setup Guide

## Prerequisites

- Node.js 18+
- npm 9+
- Git
- Cuenta Supabase
- Cuenta Groq

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/smontoyag/jarvis-creator.git
cd jarvis-creator
```

### 2. Install Dependencies

```bash
npm install
```

Esto instala dependencias en raíz (workspaces) y en front/ + back/ automáticamente.

### 3. Configure Environment

#### Back/.env

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
GROQ_API_KEY=<tu-groq-key>
```

**Obtener Supabase keys:**
1. Ve a https://app.supabase.com
2. Selecciona tu proyecto
3. Settings > API
4. Copia Project URL y anon key

**Obtener Groq key:**
1. Ve a https://console.groq.com/keys
2. Crea una API key
3. Copia el valor

#### Front/.env (opcional)

```env
VITE_API_URL=http://localhost:3001
```

Si se omite, el frontend usa `http://localhost:3001` por defecto.
Hay una plantilla en `front/.env.example`.

### 4. Setup Supabase

Todo el esquema vive en un único archivo idempotente: `back/migrations/001_init.sql`.

1. Abre tu proyecto en https://app.supabase.com
2. Ve a **SQL Editor > New query**
3. Pega el contenido completo de `back/migrations/001_init.sql` y ejecútalo

Crea las cinco tablas (`generic_questions`, `ideas`, `respuestas`,
`dynamic_questions`, `dynamic_respuestas`), sus índices, los triggers de
`updated_at`, las políticas RLS y siembra las 5 preguntas iniciales.

> No hay script de migración por CLI: Supabase no expone SQL arbitrario por su
> API REST, así que el SQL Editor es la vía soportada.

Verifica que quedó bien:

```bash
curl http://localhost:3001/api/questions
```

Debe devolver 5 preguntas.


### 5. Run Development

```bash
# Terminal 1: Backend
cd back && npm run dev

# Terminal 2: Frontend
cd front && npm run dev
```

Accede a: http://localhost:5173

## Tests

```bash
# Backend
cd back && npm run test:vitest

# Frontend
cd front && npm test
```

## Build Production

```bash
# Frontend
cd front && npm run build

# Output en front/dist/
```

## Deploy

### Frontend (Vercel/Netlify)

1. Conecta repositorio
2. Build command: `npm run build`
3. Output directory: `front/dist`
4. Configura variables de entorno si las usas

### Backend (Railway/Render)

1. Conecta repositorio
2. Root directory: `back`
3. Build command: `npm install`
4. Start command: `npm run dev` (o `node index.js`)
5. Configura variables de entorno (.env)

## Troubleshooting

### Error: "supabaseKey is required"
- Verifica que SUPABASE_SERVICE_ROLE_KEY esté en back/.env
- Reinicia el servidor backend

### Error: "fetch failed" en Groq
- Verifica GROQ_API_KEY válido
- Revisa rate limits de Groq

### Error: CORS
- Verifica FRONTEND_URL en back/.env coincide con puerto frontend

### Tablas no existen en Supabase
- Ejecuta el SQL del paso 4 en SQL Editor
- Verifica RLS policies