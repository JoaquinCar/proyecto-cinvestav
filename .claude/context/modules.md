# context/modules.md — Especificación de los 8 Módulos

## Módulo 1: Registro de Participantes

### Funcionalidad
- Formulario de registro: nombre, apellidos, edad, escuela, grado
- Búsqueda en tiempo real (debounce 300ms) por nombre/apellidos
- Al buscar, detectar automáticamente participantes con nombre similar de ediciones anteriores y mostrar badge "Participó en [año anterior]"
- Si se detecta recurrente, ofrecer vincular al mismo participante en lugar de crear duplicado

### Endpoints
- `GET /api/participantes?q=texto&edicionId=X` — buscar participantes
- `POST /api/participantes` — crear participante nuevo
- `POST /api/inscripciones` — inscribir participante a edición activa
- `GET /api/participantes/[id]` — historial completo del participante

### UI
- `/ediciones/[id]/participantes` — lista de inscritos con búsqueda
- Botón flotante "Registrar participante" siempre visible en móvil
- Modal/drawer de registro con detección de recurrentes inline

---

## Módulo 2: Gestión de Ediciones

### Funcionalidad
- CRUD de ediciones (solo ADMIN)
- Solo puede haber una edición activa a la vez
- Históricamente consultables (todas las ediciones pasadas)
- Configurar mínimo de asistencias para constancia por edición

### Endpoints
- `GET /api/ediciones` — listar todas
- `POST /api/ediciones` — crear nueva (ADMIN)
- `PUT /api/ediciones/[id]` — editar (ADMIN)
- `PUT /api/ediciones/[id]/activar` — activar edición (desactiva la anterior)

### UI
- `/ediciones` — lista de ediciones con año, fechas, participantes inscritos
- `/ediciones/[id]` — vista general de la edición: métricas, clases, participantes

---

## Módulo 3: Clases y Temas

### Funcionalidad
- Catálogo de clases por edición con investigador asignado
- Cada clase tiene N sesiones (por fecha)
- Los becarios registran los temas vistos tras cada sesión (texto libre o lista)

### Endpoints
- `GET /api/ediciones/[id]/clases` — clases de una edición
- `POST /api/clases` — crear clase (ADMIN)
- `POST /api/sesiones` — crear sesión para una clase
- `PUT /api/sesiones/[id]` — actualizar temas de la sesión (BECARIO+)

### UI
- `/ediciones/[id]/clases` — catálogo de clases con investigador
- Al expandir una clase: lista de sesiones con temas y asistencia total

---

## Módulo 4: Control de Asistencia

### Funcionalidad
- Pasar lista por sesión desde cualquier dispositivo con internet
- Interfaz optimizada para móvil: checkboxes grandes, búsqueda rápida
- Actualización optimista (la UI responde inmediatamente, se sincroniza en fondo)
- Ver quién ya asistió vs quién falta en tiempo real

### Endpoints
- `GET /api/sesiones/[id]/asistencia` — lista de participantes con su estado
- `POST /api/asistencias` — marcar/desmarcar asistencia (batch permitido)
- `GET /api/asistencias?participanteId=X&edicionId=Y` — historial de asistencia

### UI
- `/asistencia/[sesionId]` — vista dedicada mobile-first para pasar lista
- Lista de participantes con checkbox grande, nombre y escuela
- Contador de presentes/total en tiempo real
- Búsqueda/filtro por nombre

---

## Módulo 5: Constancia Automática PDF

### Funcionalidad
- El sistema verifica automáticamente si un participante cumple el mínimo de asistencias
- Al cumplirlo, aparece botón "Generar Constancia" en su perfil
- La constancia se genera en PDF con: nombre completo, escuela, edición, asistencias, firma CINVESTAV
- Se guarda en Supabase Storage y se guarda la URL en la DB
- Descargable en cualquier momento desde el perfil del participante

### Endpoints
- `POST /api/pdf/constancia/[inscripcionId]` — generar y guardar constancia
- `GET /api/pdf/constancia/[inscripcionId]` — obtener URL o stream del PDF

### UI
- En el perfil de inscripción: badge de elegibilidad + botón "Generar Constancia"
- Una vez generada: botón "Descargar Constancia"

---

## Módulo 6: Dashboard y Reportes Generales

### Funcionalidad
- Métricas en tiempo real de la edición activa:
  - Total participantes inscritos
  - Asistencia promedio por clase
  - Participación por escuela (gráfica de barras)
  - Participación por grado (gráfica de pie)
  - Temas impartidos por clase
- Exportar datos a Excel (usando la librería `xlsx`)
- Exportar reporte general a PDF

### Endpoints
- `GET /api/estadisticas/edicion/[id]` — métricas de una edición
- `GET /api/exportar/excel/[edicionId]` — descarga Excel
- `GET /api/exportar/pdf/[edicionId]` — descarga PDF reporte general

### UI
- `/` (dashboard) — métricas de la edición activa
- `/ediciones/[id]/reportes` — reportes completos de una edición

---

## Módulo 7: Reporte PDF por Clase

### Funcionalidad
Un PDF descargable por clase que incluye:
- Encabezado con nombre de clase, investigador, edición
- Lista de participantes inscritos con sus asistencias por sesión (tabla)
- Temas vistos por sesión
- Gráfica de asistencia total por sesión
- Resumen: total participantes, promedio asistencia, sesiones impartidas

### Endpoints
- `POST /api/pdf/reporte-clase/[claseId]` — generar PDF de clase

### UI
- En la vista de clase: botón "Descargar Reporte PDF"

---

## Módulo 8: Historial y Estadísticas entre Ediciones

### Funcionalidad
- Vista comparativa año con año:
  - Crecimiento de participantes totales
  - Escuelas más constantes (participaron en más ediciones)
  - Participantes recurrentes (mismo niño, múltiples ediciones)
  - Clases con mayor demanda histórica
- Gráficas de línea para tendencias multi-año

### Endpoints
- `GET /api/estadisticas/historico` — métricas comparativas de todas las ediciones
- `GET /api/estadisticas/escuelas` — ranking de escuelas por ediciones participadas

### UI
- `/estadisticas` — dashboard histórico con gráficas comparativas
- Filtros por rango de años