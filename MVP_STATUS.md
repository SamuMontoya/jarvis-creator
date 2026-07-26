# Estado del MVP

Última actualización: 2026-07-25

---

## 🔴 Bloqueador activo: proyecto Supabase inexistente

El host `evajjhjzccbexwmcuppq.supabase.co` devuelve **NXDOMAIN desde los DNS
autoritativos** (verificado contra `8.8.8.8` y `1.1.1.1`, no solo el resolver
local). El dominio `supabase.co` sí resuelve, así que no es un problema de red
local: el proyecto está pausado o eliminado.

La `service_role` key no está vencida (expira 2035-07-23), de modo que tampoco
es un problema de credenciales.

**Qué hace falta:** entrar a [app.supabase.com](https://app.supabase.com) y o
bien restaurar el proyecto, o crear uno nuevo y actualizar `back/.env`. Después,
ejecutar `back/migrations/001_init.sql` en el SQL Editor (ver `SETUP.md`).

**Qué queda bloqueado por esto:**

- Flujo E2E contra la base real (Fase 1, pasos 4-6 del encargo)
- Tests de integración backend contra Supabase
- Verificación de que las políticas RLS del esquema nuevo se comportan como se espera

Groq **sí funciona**: API key válida y `llama-3.3-70b-versatile` disponible
(verificado contra `api.groq.com/openai/v1/models`).

---

## Estado de tests

| Suite | Antes | Ahora | Coverage |
|---|---|---|---|
| Backend | 9/12 (3 fallando, ~56 s) | **44/44** (~0,7 s) | 90,3 % stmts · 100 % funcs |
| Frontend | 9/26 (17 fallando) | **45/45** (~3 s) | 87,6 % stmts · 88,7 % funcs |

Umbrales configurados en CI: backend 80 %, frontend 70 %. Ambos se superan.

```bash
npm test           # las dos suites
npm run test:coverage
```

> Los "9 pasando" del backend anterior eran engañosos: varios tests afirmaban
> `expect(status).toBe(200 || 500)`, que en JavaScript es `toBe(200)`, o
> registraban el fallo con `console.log` en vez de fallar. Detalle en
> `CODE_REVIEW_NOTES.md`.

---

## Checklist de funcionalidad

Verificado en navegador (Chrome, 1280×720) recorriendo el flujo completo contra
un backend stub que implementa el contrato de `API.md`, porque Supabase no está
disponible. La lógica del backend está cubierta por sus 44 tests unitarios.

### Flujo principal

| Feature | Estado | Nota |
|---|---|---|
| Listar ideas ordenadas por `updated_at DESC` | ✅ | |
| Filtros Todas / Borradores / Completadas con contadores | ✅ | Filtra en cliente, sin refetch |
| Crear idea con validación de mínimo 10 caracteres | ✅ | Contador de caracteres en vivo |
| 5 preguntas genéricas con texto y progreso | ✅ | Antes mostraba "Pregunta NaN de 5" sin texto |
| Guardar respuesta y navegar adelante/atrás | ✅ | |
| Resumen intermedio con las 5 respuestas | ✅ | |
| Editar respuesta genérica desde el resumen | ✅ | Se prellena y vuelve al resumen al guardar |
| Botón de paso al análisis profundo | ✅ | No existía; la etapa era inalcanzable |
| Generación de 10 preguntas con Groq | ✅ | Reutiliza las existentes si ya se generaron |
| Responder las 10 preguntas dinámicas | ✅ | |
| Resumen final con ambas secciones | ✅ | La pantalla no estaba conectada a `App` |
| Editar respuesta dinámica | ✅ | |
| Descargar HTML | ✅ | Contenido del usuario escapado |
| Descargar Markdown | ✅ | |
| Descargar PDF | ✅ | jsPDF en cliente; validado: 4.363 B, `application/pdf` |
| Finalizar idea (`estado` → `refined`) | ✅ | |
| Eliminar idea con modal de confirmación | ✅ | El botón no hacía nada antes |
| Cascade delete de respuestas | ✅ | Delegado a `ON DELETE CASCADE` — no verificable sin la base real |
| Recuperar progreso al recargar | ✅ | Persiste `{ideaId, stage, índices}`; antes estaba muerto |

### Transversales

| Feature | Estado | Nota |
|---|---|---|
| Mensajes de error amigables en toda la app | ✅ | Nunca se muestra stack trace ni error de driver |
| Botones deshabilitados en loading / input inválido | ✅ | |
| Loading states uniformes (`Spinner`) | ✅ | |
| Toasts de éxito | ✅ | Crear, guardar, eliminar, finalizar, descargar |
| Reintentar tras fallo de carga | ✅ | |
| Lazy load de `MyIdeas` y `FinalResumen` | ✅ | jsPDF (399 kB) fuera del bundle inicial |
| `React.memo` / `useCallback` | ✅ | |
| `VITE_API_URL` configurable | ✅ | Fallback a `localhost:3001` |

---

## Bugs corregidos en esta pasada

Ordenados por severidad.

1. **XSS en el HTML descargable.** `escapeHtml` en `documents.js` hacía
   sustituciones identidad (`&` → `&`). El texto del usuario entraba sin escapar.
2. **`FinalResumen` desconectado.** 310 líneas con las descargas y el análisis
   profundo que nunca se importaban. Medio producto inalcanzable.
3. **Editar una respuesta devolvía 500.** `insert()` contra una tabla con
   `UNIQUE(idea_id, question_id)`. Cambiado a `upsert()`.
4. **Sin ruta a las preguntas dinámicas.** Ningún control disparaba la etapa.
5. **El texto de las preguntas no se renderizaba.** Props cruzadas entre
   `QuestionForm` y sus hijos; el contador mostraba `NaN`.
6. **Eliminar idea no hacía nada.** `MyIdeas` pasaba un prop inexistente.
7. **Todos los mensajes de validación se perdían.** zod v4 usa `.issues`, el
   código leía `.errors`.
8. **Los errores de base nunca se logueaban.** Un 500 no dejaba rastro de su causa.
9. **`errorHandler` filtraba mensajes internos** al cliente.
10. **Migración desfasada.** Describía columnas que la app no usa y le faltaban
    dos tablas.
11. **Recuperación de progreso muerta** + promesa rechazada sin manejar.
12. **Modo oscuro ilegible.** Lienzo oscuro con componentes de colores claros fijos.
13. **`IdeaForm` mostraba errores en blanco** (`data.error` vs `data.message`).

---

## Known issues

Cosas reales que quedan pendientes. No están ocultas en ningún sitio.

### 1. El flujo E2E no se ha ejercitado contra Supabase

Es consecuencia directa del bloqueador. La validación en navegador se hizo
contra un stub del contrato de API. Lo que **no** está verificado empíricamente:

- Que las políticas RLS de `001_init.sql` permitan las operaciones con la `anon` key
- Que el `ON DELETE CASCADE` borre efectivamente respuestas y preguntas dinámicas
- Que el trigger de `updated_at` dispare y el orden del listado sea correcto en la práctica
- Que `upsert` con `onConflict` resuelva bien contra PostgREST

Todo eso es SQL estándar y correcto por construcción, pero *correcto por
construcción* no es lo mismo que *probado*.

### 2. No hay suite de integración ni E2E automatizada

Se pidió Playwright. No se instaló: un E2E real necesita backend y base
funcionando, y montarlo contra el stub habría dado una falsa sensación de
cobertura. Queda como siguiente paso una vez restaurada la base.

### 3. `generate-final-pdf` no genera un PDF

Devuelve markdown; el PDF lo arma el cliente con jsPDF. Funciona, pero el nombre
del endpoint miente. Renombrarlo es un cambio de contrato — ver decisiones abiertas.

### 4. El renderizador de markdown a PDF es básico

`markdownToPdf.js` interpreta encabezados, listas, cursivas y separadores.
No soporta tablas, enlaces, imágenes ni bloques de código. Suficiente para el
documento que genera el backend hoy.

### 5. Sin autenticación

Las políticas RLS son `USING (true)`: cualquiera con la URL ve y borra todas las
ideas. Aceptable para un MVP de un solo usuario, no para publicarlo.

### 6. `md_final` solo guarda el HTML

La columna se actualiza únicamente en `generate-final-html`; el markdown no se
persiste. No afecta a ninguna funcionalidad actual.

### 7. Warnings de HMR en desarrollo

`vite.config.js` fija `hmr.clientPort: 443` (necesario para ngrok), lo que hace
fallar el websocket en local. Solo ensucia la consola; el hot reload funciona vía
polling. Si dejas de usar ngrok, quita esa línea.

### 8. Dos warnings de lint

`oxlint` avisa que `AppContext.jsx` y `ToastContext.jsx` exportan un componente y
un hook desde el mismo archivo. Es el patrón estándar de Context en React y solo
afecta a la granularidad del fast refresh.

---

## Decisiones de producto pendientes

Ninguna bloquea el trabajo técnico, pero cambian el comportamiento visible.

1. **¿Renombrar `generate-final-pdf`?** Hoy devuelve markdown. O se renombra a
   algo honesto (`/document-source`), o se mueve la generación del PDF al
   servidor para que devuelva un binario de verdad. Lo dejé como está para no
   romper el contrato documentado en `API.md`.

2. **¿El flujo debe poder terminarse sin análisis profundo?** Hoy "Finalizar
   idea" solo existe en el resumen final, así que hay que pasar por las 10
   preguntas dinámicas para completar una idea. Si quieres permitir cerrar tras
   las 5 iniciales, hay que añadir el botón en el resumen intermedio.

3. **¿Tema oscuro?** Está deshabilitado a propósito. Habilitarlo bien implica
   recolorear los diez componentes.

4. **¿Las 5 preguntas genéricas son las definitivas?** La migración siembra
   exactamente esas cinco. La versión anterior tenía ocho, y el frontend asume
   cinco en varios sitios.
