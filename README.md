# Planificador Docente IA — MINERD/DETP

Sistema independiente (prototipo) que automatiza el llenado de la **Matriz de
Planificación Diaria o Por Actividad** del MINERD para la modalidad Técnico
Profesional. El docente solo indica lo esencial; el resto (estrategia,
intención educativa, momentos pedagógicos, recursos y distribución de
contenidos conceptuales/procedimentales/actitudinales) lo redacta la IA
(Google Gemini) usando el banco de contenidos real de la base de datos.

Diseñado para probarse por separado y luego integrarse al portal de gestión
docente existente.

## Arquitectura

```
frontend/   → HTML/CSS/JS estático → GitHub Pages
backend/    → API en PHP puro      → Hostinger (hosting compartido)
database/   → schema.sql           → MySQL en Hostinger
```

El frontend nunca ve la API key de Gemini: todas las llamadas de IA pasan
por `backend/api/generar_ia.php`, que guarda la clave como variable de
entorno / archivo de configuración en el servidor.

## Flujo del docente (5 pasos)

1. **Datos base** — elige su nombre; institución, bachillerato, módulos y
   RA se cargan solos desde la base de datos.
2. **La actividad** — Tipo (Individual/Por Equipo), tiempo estimado (50 min
   por defecto, editable), fecha, valor, y el **enunciado/título** de la
   actividad.
3. **Generar con IA** — con un clic, Gemini redacta estrategia, intención
   educativa, los 3 momentos pedagógicos, atención a la diversidad,
   recursos, y selecciona/redacta los contenidos conceptuales,
   procedimentales y actitudinales pertinentes desde el banco de contenidos
   del módulo.
4. **Revisar y ajustar** — el docente edita libremente lo generado y elige
   su instrumento de evaluación (de un catálogo, o uno propio).
5. **Guardar y exportar** — guarda en MySQL y descarga en **.docx**, **PDF**,
   o la ve directamente **en pantalla**.

---

## 1. Base de datos: se reutiliza la de tu sistema de Asistencia

Este módulo **no crea una base de datos nueva** — se conecta a la misma
base de datos MySQL de tu sistema de Asistencia (`u910167283_Asistencia`),
que ya tiene docentes (`usuarios`), módulos (`asignaturas`) y RA
(`asignatura_unidades`) reales. Así ambos sistemas comparten los mismos
datos desde ya, preparando el terreno para unificarlos más adelante.

**No se modifica ninguna tabla existente.** Solo se agregan 3 tablas
nuevas con prefijo `planif_` que se conectan a las tuyas por llave foránea:

| Tabla nueva | Para qué | Se conecta a |
|---|---|---|
| `planif_contenidos` | Banco de contenidos conceptual/procedimental/actitudinal | `asignaturas`, `asignatura_unidades` |
| `planif_instrumentos_evaluacion` | Catálogo de instrumentos que el docente elige | — |
| `planif_planificaciones` | Cada planificación generada | `usuarios`, `asignaturas`, `asignatura_unidades` |

**Mapeo de conceptos** (para que entiendas qué usa qué):

| Este módulo pedía | Se toma de tu sistema existente |
|---|---|
| Docente | `usuarios` (WHERE `rol = 'profesor'`) |
| Institución / Bachillerato Técnico | `configuracion_global` (`nombre_centro`) |
| Módulo Formativo | `asignaturas` (WHERE `tipo = 'tecnico'`) |
| RA | `asignatura_unidades` (`codigo`, `titulo`, `valor`) |
| Qué módulo imparte cada docente | `profesor_asignaciones` |

### Pasos para instalar

1. Entra a **phpMyAdmin** desde hPanel → selecciona tu base de datos
   `u910167283_Asistencia` (la misma del sistema de Asistencia) → pestaña
   **Importar** → sube `backend/database/schema_addon.sql`.
2. Esto crea las 3 tablas nuevas y agrega:
   - Una fila `bachillerato_tecnico` en `configuracion_global` (no pisa
     nada si ya existe una fila con esa clave).
   - Un catálogo inicial de instrumentos de evaluación.
   - Un ejemplo de contenidos para la asignatura `id=1` (DASI) — **ajústalo
     a tus asignaturas y RA reales** (ver sección siguiente).
3. Verifica en phpMyAdmin que aparecen las tablas `planif_contenidos`,
   `planif_instrumentos_evaluacion` y `planif_planificaciones`, y que tus
   tablas existentes (`usuarios`, `asignaturas`, etc.) siguen intactas.

## 2. Despliegue del backend (Hostinger → PHP)

1. Sube la carpeta `backend/` completa a tu hosting, por ejemplo a
   `public_html/api` o a un subdominio `api.tudominio.com` (recomendado,
   así el frontend en GitHub Pages llama a `https://api.tudominio.com/...`).
2. Instala las dependencias PHP (PhpWord y Dompdf) con Composer:
   - Si tu plan Hostinger da acceso SSH: conéctate y ejecuta
     `composer install` dentro de la carpeta `backend/`.
   - Si no tienes SSH: ejecuta `composer install` **en tu computadora**
     dentro de `backend/`, y luego sube la carpeta `vendor/` resultante por
     FTP/Administrador de archivos.
3. Crea el archivo de credenciales real (nunca lo subas a GitHub):
   - Copia `backend/config/.env.example.php` a `backend/config/.env.php`
   - Completa `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` con **las mismas
     credenciales que ya usa tu sistema de Asistencia** (es la misma BD).
   - Completa `GEMINI_API_KEY` con tu clave de Google AI Studio
     (https://aistudio.google.com/app/apikey).
4. Verifica que `backend/config/.htaccess` (que bloquea el acceso web
   directo a esa carpeta) se haya subido correctamente.
5. Edita `backend/config/config.php` → arreglo `ALLOWED_ORIGINS` → agrega
   la URL real de tu sitio en GitHub Pages, ej.
   `https://tu-usuario.github.io`.
6. Prueba abriendo en el navegador:
   `https://api.tudominio.com/api/docentes.php`
   Debe devolver un JSON como `{"ok":true,"data":[...]}`.

## 3. Despliegue del frontend (GitHub → GitHub Pages)

1. Crea un repositorio nuevo en GitHub (ej. `planificador-docente-ia`) y
   sube el contenido de la carpeta `frontend/` a la raíz del repo.
2. Edita `frontend/js/config.js` y coloca la URL real de tu API:
   ```js
   const API_BASE = 'https://api.tudominio.com';
   ```
3. En GitHub → **Settings → Pages** → Source: rama `main`, carpeta `/root`.
4. Espera 1-2 minutos; tu sitio quedará en
   `https://tu-usuario.github.io/planificador-docente-ia/`.

## 4. Obtener tu API key de Gemini

1. Entra a https://aistudio.google.com/app/apikey con tu cuenta de Google.
2. Crea una API key nueva (es gratuita hasta cierto límite de uso mensual).
3. Pégala en `backend/config/.env.php` como se indicó arriba.

## 5. Lo único que debes cargar tú: el banco de contenidos

Docentes, módulos y RA **ya existen** en tu base de datos (son
`usuarios`, `asignaturas` y `asignatura_unidades`), así que no hay que
volver a capturarlos. Lo único nuevo que debes llenar es:

- `planif_contenidos` — el banco de contenidos de cada asignatura,
  **ya clasificado** en `conceptual`, `procedimental` o `actitudinal`.
  Puedes vincular cada contenido a un RA específico (`unidad_id`) o
  dejarlo en `NULL` para que aplique a toda la asignatura. Mientras más
  completo esté este banco, mejor selecciona y redacta la IA.

  Ejemplo para agregar contenidos de otra asignatura (ej. IMASI, id=2):
  ```sql
  INSERT INTO planif_contenidos (asignatura_id, unidad_id, tipo, descripcion, orden) VALUES
  (2, NULL, 'conceptual', 'Fundamentos de pruebas de software', 1),
  (2, NULL, 'procedimental', 'Diseño de casos de prueba', 1),
  (2, NULL, 'actitudinal', 'Rigurosidad en la documentación de errores', 1);
  ```

- `planif_instrumentos_evaluacion` — ya viene con un catálogo inicial
  (lista de cotejo, rúbrica, etc.); agrega o edita según tu institución.

> **Importante:** si una asignatura/RA no tiene contenidos cargados en
> `planif_contenidos`, el sistema no podrá generar la planificación para
> esa combinación (se lo advertirá al docente con un mensaje claro).

> **Nota sobre `profesor_asignaciones`:** el selector de módulos del Paso 1
> solo muestra las asignaturas que cada profesor ya tiene asignadas en esa
> tabla (la misma que usa tu sistema de Asistencia/horarios). Si un docente
> no ve un módulo, revisa que tenga una fila en `profesor_asignaciones`
> para esa asignatura.

## 6. Próxima integración al portal docente

Este módulo ya comparte base de datos con tu portal existente (docentes,
asignaturas y RA son las mismas filas), así que la integración futura es
más simple de lo habitual. Lo que falta para unificarlos completamente:

- Mover los endpoints de `backend/api/` como un módulo dentro de la API del
  portal, o dejarlos como microservicio aparte y solo enlazar el frontend
  desde el menú del portal.
- Si el portal ya maneja autenticación (login con sesión/token), agregar
  esa misma verificación en `backend/config/bootstrap.php` antes de
  exponer los endpoints, para que un docente no pueda ver ni generar
  planificaciones de otro.
- Si más adelante quieres mostrar el historial de planificaciones dentro
  del perfil de cada docente en el portal, solo necesitas una consulta a
  `planif_planificaciones WHERE profesor_id = ?` — ya está lista para eso.

## Estructura de archivos

```
backend/
  api/
    docentes.php
    modulos.php
    resultados_aprendizaje.php
    instrumentos_evaluacion.php
    generar_ia.php          ← llama a Gemini
    guardar_planificacion.php
    listar_planificaciones.php
    obtener_planificacion.php
    exportar_docx.php       ← PhpWord
    exportar_pdf.php        ← Dompdf
    ver_planificacion.php   ← vista HTML en pantalla
    _shared_planificacion.php
    _render_html.php
  config/
    config.php
    .env.example.php        ← copiar a .env.php con tus credenciales reales
    db.php
    bootstrap.php
    .htaccess                ← bloquea acceso web a esta carpeta
  database/
    schema_addon.sql          ← aditivo: solo 3 tablas nuevas, no toca lo existente
  composer.json
  .htaccess
  .gitignore

frontend/
  index.html
  css/style.css
  js/config.js               ← URL de la API
  js/api.js
  js/app.js
```
