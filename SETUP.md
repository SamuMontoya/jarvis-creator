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
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_<...>
SUPABASE_SECRET_KEY=sb_secret_<...>
GROQ_API_KEY=<tu-groq-key>
```

**Obtener Supabase keys:**
1. Ve a https://app.supabase.com
2. Selecciona tu proyecto
3. **Project Settings > API Keys**
4. Copia la Project URL, la publishable key y una secret key

> **Sobre el formato de las keys.** Supabase reemplazó las keys JWT
> (`anon` / `service_role`) por `sb_publishable_…` y `sb_secret_…`. Las
> legacy siguen funcionando hasta finales de 2026, pero los proyectos nuevos
> usan el formato nuevo.
>
> El backend lee `SUPABASE_SECRET_KEY` y cae a `SUPABASE_SERVICE_ROLE_KEY` si
> no existe, así que ambos esquemas funcionan sin tocar código.
>
> El `apikey` de una publishable key **no** es intercambiable entre proyectos:
> si cambias de proyecto, tienes que cambiar también las keys.

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

Hay dos migraciones. **Elige una según el estado de tu base:**

| Situación | Archivo |
|---|---|
| Proyecto nuevo / base vacía | `back/migrations/001_init.sql` |
| Base que ya tiene tablas y datos | `back/migrations/002_align_existing_schema.sql` |

1. Abre tu proyecto en https://app.supabase.com
2. Ve a **SQL Editor > New query**
3. Pega el contenido completo del archivo que te corresponda y ejecútalo

`001_init.sql` crea las cinco tablas (`generic_questions`, `ideas`,
`respuestas`, `dynamic_questions`, `dynamic_respuestas`), índices, triggers de
`updated_at`, políticas RLS y siembra 5 preguntas de ejemplo.

`002_align_existing_schema.sql` es no destructivo: conserva tus ideas,
respuestas y el texto de tus preguntas, y solo añade lo que falte (la columna
`activa`, los `UNIQUE` que necesita el guardado de respuestas, los triggers de
`updated_at` y el `ON DELETE CASCADE`). Termina con una consulta de
verificación que debe devolver cinco filas en `true`.

> No hay script de migración por CLI: Supabase no expone SQL arbitrario por su
> API REST, así que el SQL Editor es la vía soportada.

Verifica que quedó bien de punta a punta:

```bash
npm run verify:e2e --workspace=back
```

Recorre el flujo completo contra la base real (incluida una llamada real a
Groq) y limpia lo que crea. Los 17 pasos deben salir en verde.


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