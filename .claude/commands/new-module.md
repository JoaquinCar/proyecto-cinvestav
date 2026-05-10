# Comando: new-module
## Propósito
Protocolo para agregar un nuevo módulo al sistema de forma ordenada.

## Pasos

1. **Crear rama desde develop**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/modulo-[N]-[nombre]
   ```

2. **Leer el contexto** — Abrir `context/modules.md` y leer la especificación del módulo a implementar.

3. **Verificar schema** — Consultar `agents/architect.md`. Si el módulo requiere cambios al schema, crear la migración primero:
   ```bash
   npx prisma migrate dev --name agregar-[entidad]
   ```

4. **Orden de implementación dentro del módulo:**
   a. Schema Zod en `src/lib/schemas/`
   b. Queries en `src/server/queries/`
   c. API Routes en `src/app/api/`
   d. Server Actions si aplica en `src/server/actions/`
   e. Componentes UI en `src/components/`
   f. Página en `src/app/(dashboard)/`
   g. Tests en `tests/integration/api/`

5. **Verificar antes del PR:**
   ```bash
   npm run type-check
   npm run lint
   npm test
   npm run build
   ```

6. **Abrir PR hacia develop** con descripción del módulo implementado.

7. El agente `qa` revisa el PR antes de mergear.

---

# Comando: review-pr
## Propósito
Protocolo que sigue el agente QA para revisar un PR antes de aprobarlo.

## Pasos de Revisión

### Automático (lee el diff del PR)
1. Verificar que no hay secrets en el diff
2. Verificar que todos los endpoints nuevos tienen auth check
3. Verificar que hay schemas Zod en todos los endpoints nuevos
4. Verificar que hay al menos un test nuevo por endpoint nuevo
5. Verificar que hay migración de Prisma si el schema cambió

### Manual (revisar funcionalmente)
1. Hacer checkout de la rama del PR localmente
2. Correr `npm run type-check` — debe pasar sin errores
3. Correr `npm test` — todos deben pasar
4. Correr `npm run build` — debe compilar
5. Probar el flujo en desarrollo local

### Resultado
- ✅ **Aprobar** si todo pasa
- 🔄 **Solicitar cambios** indicando exactamente qué falta
- ❌ **Bloquear** si hay problema de seguridad crítico

---

# Comando: deploy
## Propósito
Desplegar a producción de forma segura.

## Pasos

### Deploy automático (recomendado)
Simplemente mergear `develop` → `main`. El workflow de GitHub Actions:
1. Corre type-check, lint y tests
2. Ejecuta migraciones de Prisma
3. Despliega a Vercel en producción

### Deploy manual (emergencias)
```bash
# Solo si el CI falla por razones de infraestructura
vercel --prod
```

### Post-deploy checklist
- [ ] Verificar que https://pasaporte-cientifico.vercel.app carga
- [ ] Verificar que el login funciona
- [ ] Verificar que las migraciones se aplicaron: `npx prisma migrate status`
- [ ] Probar el flujo crítico: registrar participante → marcar asistencia → generar constancia