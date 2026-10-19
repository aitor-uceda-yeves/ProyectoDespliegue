# ClubManager — Sistema de gestión de club de fútbol

Aplicación original para DAW. No es una tienda online: centraliza operaciones deportivas y económicas de un club.

## Módulos incluidos
- Dashboard con resumen de plantilla, próximos partidos, lesiones, finanzas y rendimiento.
- Plantilla: alta, edición y baja de futbolistas; posición, dorsal, edad, nacionalidad y estado.
- Contratos: fechas, salario anual, prima y estado contractual.
- Entrenamientos: calendario, tipo de sesión, carga y asistencia.
- Partidos: rival, competición, fecha, local/visitante, resultado y notas.
- Estadísticas: minutos, goles, asistencias, amarillas y rojas por jugador.
- Lesiones: tipo, fecha de inicio, fecha estimada de vuelta, estado y notas.
- Finanzas: ingresos/gastos, categoría, fecha e importe; balance calculado.
- API REST con validación básica.
- PostgreSQL con datos de demostración.
- Redis para caché de dashboard y disponibilidad de servicios.
- Nginx como servidor frontend y proxy inverso.
- Docker Compose para levantar el stack completo.

## Requisitos
Docker Desktop o Docker Engine + Compose plugin. Puerto 8080 libre.

## Ejecutar
1. Descomprime el ZIP.
2. Copia `.env.example` a `.env`.
3. Desde esta carpeta ejecuta:

```bash
docker compose up --build -d
```

4. Abre http://localhost:8080
5. Salud de la API: http://localhost:8080/api/health

Ver logs:
```bash
docker compose logs -f api
docker compose ps
```

Detener:
```bash
docker compose down
```

Eliminar también los datos persistidos:
```bash
docker compose down -v
```

## API REST
- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/players`
- `POST /api/players`
- `PUT /api/players/:id`
- `DELETE /api/players/:id`
- `GET /api/contracts`
- `POST /api/contracts`
- `GET /api/training`
- `POST /api/training`
- `GET /api/matches`
- `POST /api/matches`
- `GET /api/stats`
- `POST /api/stats`
- `GET /api/injuries`
- `POST /api/injuries`
- `PATCH /api/injuries/:id`
- `GET /api/finance`
- `POST /api/finance`

## Arquitectura
```text
Navegador -> Nginx :8080 -> API Express :3000 -> PostgreSQL :5432
                                     |
                                     +---------- Redis :6379
```

## Datos de ejemplo
El SQL de inicialización carga una plantilla de demostración ficticia, partidos y operaciones financieras. Puedes modificarla o añadir registros desde la aplicación.

## Alcance académico
Es una base de proyecto lista para ejecutar y ampliar. No incluye autenticación/autorización ni debe exponerse a Internet sin añadir controles de seguridad, TLS, copias de seguridad y validación más estricta. Los datos de ejemplo son ficticios.
