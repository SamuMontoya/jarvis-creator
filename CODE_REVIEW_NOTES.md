# Code Review — decisiones de arquitectura

Notas del review exhaustivo de `back/` y `front/src/` (Pasos 77-79). Solo se
documentan decisiones con consecuencias; los renombres y limpiezas menores no
están aquí.

---

## Backend

### El error real de Supabase nunca llegaba a ningún log

**Problema.** Cada ruta hacía `if (error) return res.status(500).json({ message: DB_ERROR })`.
Como `supabase-js` devuelve los errores como valor y no como excepción, nunca
pasaban por `errorHandler`. Un `/api/ideas` devolviendo 500 no dejaba rastro de
si era una tabla inexistente, una política RLS o un fallo de red.

**Decisión.** Se añadió `sendDbError(res, error, context)` en `errorHandler.js`:
loguea la causa real con contexto y responde el mensaje genérico al cliente.
Todas las ramas `if (error)` la usan.

**Por qué importa.** Fue justamente lo que impidió diagnosticar rápido que el
proyecto de Supabase había desaparecido: el 500 era mudo.

### `errorHandler` filtraba mensajes internos

`err.message` se devolvía tal cual al cliente. Un error de driver podía exponer
la cadena de conexión. Ahora solo se propaga el mensaje de errores que llevan
`status` explícito (los que nosotros construimos); el resto responde genérico.

### `insert` → `upsert` en respuestas

`respuestas` y `dynamic_respuestas` tienen `UNIQUE (idea_id, question_id)`, pero
las rutas usaban `.insert()`. **Editar una respuesta devolvía 500** por violación
de constraint. Se cambió a `.upsert()` con el `onConflict` correspondiente.

Es la semántica correcta del dominio: una idea tiene *una* respuesta por
pregunta, y volver a responder la reemplaza.

### zod v4 usa `.issues`, no `.errors`

El proyecto tiene zod 4.4.3, donde `ZodError.errors` fue eliminado. Todas las
rutas leían `validation.error.errors[0].message`, que era `undefined`, así que
**todos los mensajes de validación caían al genérico "Invalid input"**. Se
centralizó en `firstValidationMessage()` (`validators.js`) para que exista un
único punto que conozca la forma del error de zod.

### `escapeHtml` no escapaba nada

En `documents.js` la función hacía `.replace(/&/g, '&').replace(/</g, '<')` —
sustituciones identidad. El texto del usuario entraba **sin escapar** al HTML
descargable: XSS almacenado que se ejecutaba al abrir el archivo. Reescrita con
un mapa de entidades y cubierta por test.

### `generate-final-markdown` y `generate-final-pdf` eran idénticos

~25 líneas duplicadas. Se extrajo `buildMarkdown()`. El endpoint de PDF **no
genera un PDF**: devuelve el markdown y el cliente lo renderiza con jsPDF. Se
mantuvo el nombre por compatibilidad con el frontend, pero está documentado con
un comentario en la ruta.

### Cascade delete delegado a la base

`DELETE /ideas/:id` borraba `respuestas` a mano y luego la idea, dejando
huérfanas `dynamic_questions` y `dynamic_respuestas`. El esquema ya declara
`ON DELETE CASCADE` en las cuatro tablas hijas, así que ahora se borra solo la
idea. Menos round-trips y sin riesgo de borrado parcial.

### `.single()` → `.maybeSingle()`

`.single()` devuelve error cuando no hay filas, lo que hacía indistinguible
"no existe" de "falló la consulta". Con `.maybeSingle()` un `data: null` es un
404 limpio y un `error` es un 500 real.

### Migración reescrita desde cero

`001_create_tables.sql` describía un esquema que la aplicación no usa
(`ideas.titulo` / `ideas.descripcion` en vez de `texto_idea` / `estado`),
sembraba 8 preguntas cuando el flujo asume 5, y no incluía `dynamic_questions`
ni `dynamic_respuestas`.

Se reemplazó por `001_init.sql`, idempotente, con las cinco tablas reales, los
triggers de `updated_at` (sin ellos `GET /ideas` ordenado por `updated_at DESC`
nunca reflejaba cambios), índices, RLS y la semilla de 5 preguntas.

### Código muerto eliminado

Se borraron 13 scripts sueltos en `back/` (`add-constraint.js`, `check-*.js`,
`fix-schema.js`, `run-sql*.js`, `test-*.js`) y los dos runners de migración.
Diez de ellos leían `SUPABASE_SECRET_KEY`, variable que no existe en `.env`, y
los runners dependían de RPCs `exec_sql` / `pg_exec` que no existen en un
proyecto Supabase estándar: **nunca pudieron funcionar**.

También se eliminó `jest.config.js` y el script `test: jest`, muertos desde la
migración a Vitest.

---

## Frontend

### `FinalResumen` no estaba conectado

`App.jsx` renderizaba `ResumenForm` tanto para la etapa `resumen` como para
`final-resume`. `FinalResumen.jsx` (310 líneas, con la sección de Análisis
Profundo y los tres botones de descarga) **no se importaba en ningún sitio**.
Además nada disparaba `handleStartDynamicQuestions`, así que las preguntas
dinámicas eran inalcanzables desde la UI.

La mitad del producto existía en el repositorio pero no en la aplicación.

### Props cruzadas entre `QuestionForm` y sus hijos

`QuestionForm` pasaba `question` / `answer` / `currentIndex` / `title`;
`QuestionCard` esperaba `respuesta` y `QuestionHeader` esperaba
`currentQuestionIndex` / `currentQuestion`. Consecuencias visibles: el texto de
la pregunta nunca se mostraba y el contador decía "Pregunta NaN de 5".

Se unificaron los nombres y se añadieron tests que fijan el contrato.

### Borrado de ideas roto

`MyIdeas` definía un `handleDelete` completo (con `confirm` y llamada al API)
pero le pasaba a `IdeaCard` el prop `onDeleteIdea`, que `App` nunca enviaba:
`onDelete` era `undefined`. El botón Eliminar no hacía nada.

Se sustituyó `window.confirm` por un `ConfirmDialog` real, testeable y
consistente con el resto de la UI.

### Estado global: Context en vez de prop drilling

`App.jsx` mantenía 8 piezas de estado y las repartía por props a través de
cinco componentes. Se movió a `AppContext` exponiendo **transiciones con
nombre** (`startQuestions`, `goToResumen`, `editQuestion`, `finishEditing`) en
vez de setters crudos.

La razón: la lógica de "volver de una edición" estaba duplicada y divergía entre
`QuestionForm` y `DynamicQuestionForm`, cada uno interpretando a su manera el
argumento `action` de `onEditComplete`. Con transiciones nombradas la máquina de
estados vive en un solo sitio.

### Recuperación de progreso reconstruida

`App.jsx` leía claves `jarvis_respuestas_*` de `localStorage`, pero un refactor
anterior había movido el guardado a la base de datos y `ResumenForm` las
borraba activamente. **Nada las escribía**: la recuperación al recargar estaba
muerta, y el `fetch` sin `.catch()` de ese bloque provocaba una promesa
rechazada sin manejar.

Ahora se persiste solo la posición de navegación (`{ideaId, stage, índices}`)
bajo la clave `jarvis_session`; las respuestas siguen viniendo de la base. Las
etapas de edición se excluyen a propósito de la restauración: recargar dentro de
una edición dejaría al usuario en un formulario sin resumen al que volver.

### Capa de API centralizada

Había ~15 bloques `fetch` + `response.json()` + `if (!response.ok) throw` casi
idénticos, con URLs hardcodeadas y errores inconsistentes (`IdeaForm` leía
`data.error` cuando el backend manda `data.message`, así que sus errores salían
en blanco).

`src/api.js` concentra el transporte y traduce cada fallo a un mensaje en
español. Un `TypeError` de red se convierte en "No pudimos conectar con el
servidor" en vez de propagarse crudo a la pantalla.

### `SeccionDefinicion` + `SeccionAnalisisProfundo` → `SeccionRespuestas`

Eran el mismo componente con distinto título y distinta forma de resolver el
texto de la pregunta. Se unificaron con `resolveQuestion` como prop.

### Modo oscuro deshabilitado a propósito

`index.css` traía de la plantilla de Vite un bloque `prefers-color-scheme: dark`
que oscurecía el lienzo, pero **todos** los componentes usan colores claros
fijos (`#333`, `#444`, tarjetas blancas). En un navegador en modo oscuro los
títulos quedaban ilegibles.

Se fijó `color-scheme: light` y se eliminó el bloque oscuro. Un tema oscuro real
exige recolorear los diez componentes; hacerlo a medias es peor que no tenerlo.

### Código muerto eliminado

`hooks/useFetch.js` y `hooks/useForm.js` no se importaban desde ningún sitio.
También había tres configuraciones de setup de tests (`src/test/setup.js`,
`src/setupTests.js`, `tests/setup.js`) de las que Vitest solo usaba la última.

---

## Tests

### Backend: de integración a unitarios con Supabase mockeado

Los tests originales golpeaban Supabase real, tardaban 56 segundos y **no podían
pasar sin base de datos**. Peor: varios eran vacíos por construcción, como
`expect(response.status).toBe(200 || 500)` — que en JavaScript evalúa a
`toBe(200)` — o ramas `if (body.status === 'error') console.log(...)` que
convertían un fallo en un mensaje informativo.

Se sustituyeron por tests contra un mock encadenable de `supabase-js`
(`tests/supabaseMock.js`) que registra la consulta construida. Eso permite
afirmar sobre la *forma* de la query (que el upsert declara el `onConflict`
correcto, que se ordena por `updated_at DESC`) sin base de datos. 44 tests en
~700 ms.

**Contrapartida asumida.** Ya no se verifica que Supabase acepte esas consultas.
Esa garantía la da el esquema versionado en `001_init.sql` más una pasada manual
del flujo. Cuando la base vuelva a estar disponible conviene añadir una suite de
integración pequeña, marcada para saltarse si no hay conexión.

### Frontend: router de fetch en vez de mocks posicionales

Los mocks anteriores encadenaban `mockResolvedValueOnce` en el orden exacto en
que el componente hiciera los `fetch`. Cualquier cambio de orden —o un `fetch`
paralelo— desalineaba todo y devolvía `undefined`, que era el origen de los
`Cannot read properties of undefined` del suite roto.

`tests/helpers.jsx` expone `mockApi({ 'GET /ideas': ... })`, que resuelve por
método y ruta, y **lanza un error explícito ante una petición no mockeada** en
vez de devolver `undefined` en silencio.
