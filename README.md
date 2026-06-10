# Catalogo Vedisa

Catalogo historico de remates de VEDISA, construido desde cero en Next.js para desplegar en Vercel y conectado de forma dinamica a la data de `TasacionesVedisa`.

## Objetivo de integracion

Este proyecto intenta reutilizar la misma fuente de datos para evitar re-implementar todas las APIs:

1. **Primera opcion (preferida):** consumir la API pública de Tasaciones (`/api/inventario-publico`) mediante `CATALOG_SOURCE_API_URL`.
2. **Fallback automatico:** si ese endpoint no existe o falla, consulta directamente Supabase con credenciales anonimas de solo lectura.

## Variables de entorno

Copia `.env.example` a `.env.local` y completa:

```bash
cp .env.example .env.local
```

Campos principales:

- `CATALOG_SOURCE_API_URL`: base URL remota de Tasaciones (ej: `https://vedisa.vercel.app`).
- `CATALOG_SOURCE_API_TOKEN`: token para header `x-api-key`.
- `CATALOG_SOURCE_API_LIMIT`: límite solicitado al endpoint público.
- `CATALOG_SOURCE_API_ESTADO`: estado de inventario solicitado (recomendado `en_bodega`).
- `CATALOG_SOURCE_API_INCLUIR_HISTORICOS`: envía `incluir_historicos=true|false` al endpoint.
- `CATALOG_SOURCE_AUTORED_API_URL`: endpoint legacy para enriquecer por patente (fallback técnico).
- `AUTORED_EMAIL` y `AUTORED_PASSWORD`: credenciales de [Autored API v2](https://app.autored.cl/api/v2/docs) (`POST /auth/login` + `GET /Vehicles/info?licensePlate=`). Autocompletan color, combustible, transmisión, tracción, cilindrada, etc.
- Alternativa: si ya tienes la Edge Function `autored-vehicle-info` en Supabase (como TasacionesVedisa), basta con `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` y las credenciales Autored en los secrets de Supabase.
- `CATALOG_AUTORED_MAX_LOOKUPS`: máximo de patentes a consultar por ciclo para fallback Autored.
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`: fallback a Supabase.
- `CATALOG_SUPABASE_TABLE`: tabla origen (por defecto `inventario`).
- `AWS_*`: inventario DynamoDB (misma lógica que Tasaciones).
- `GLO3D_API_USERNAME` / `GLO3D_API_PASSWORD`: visores 3D.
- `ADMIN_EDITOR_EMAIL` / `ADMIN_EDITOR_PASSWORD`: acceso al modo editor.
- `CATALOG_OFFERS_TABLE`: tabla para registrar ofertas de clientes (por defecto `catalogo_vehicle_offers`).
- `CATALOG_EDITOR_TABLE`: tabla de configuracion del editor (por defecto `catalogo_editor_config`).
- `CATALOG_EDITOR_ROW_ID`: fila aislada de este sitio (por defecto `vehiculos-de-ocasion`). El valor `global` se ignora en este proyecto para no mezclar cambios con Catalogo Vedisa.

## Modo editor administrador

Incluye login y edición de:

- selección de vehículos por sección (`proximos-remates`, `ventas-directas`, `novedades`, `catalogo`)
- ocultar/mostrar vehículos
- precio personalizado por vehículo

**Importante:** las ediciones del editor (ocultar, marcar vendido, precios, textos, secciones) **no modifican** el inventario maestro de TasacionesVedisa ni tablas como `inventario`. Solo guardan capa de presentacion propia de este sitio.

El modo editor guarda en Supabase en la tabla `catalogo_editor_config` (configurable con `CATALOG_EDITOR_TABLE`), en la fila `CATALOG_EDITOR_ROW_ID`. Catalogo Vedisa u otros sitios deben usar **otro id de fila** (por ejemplo `global` o `catalogo-vedisa`) para no mezclar ocultamientos ni precios entre paginas.

### Separacion en Supabase (recomendado)

En el SQL Editor de Supabase ejecuta:

`supabase/setup-editor-scopes.sql`

Eso crea (si falta) la fila `vehiculos-de-ocasion`. Catalogo Vedisa sigue usando la fila `global` en su propio proyecto.

Resumen:

| Sitio | Fila Supabase (`id`) | Tabla inventario |
|---|---|---|
| vehiculosdeocasion.cl | `vehiculos-de-ocasion` | Solo lectura (sin cambios) |
| Catalogo Vedisa | `global` | Solo lectura (sin cambios) |

SQL sugerido:

```sql
create table if not exists public.catalogo_editor_config (
  id text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz default now()
);
```

## Ofertas de clientes

El botón **Enviar mi precio** registra ofertas en Supabase y luego las muestra en el panel admin, pestaña **5. Ofertas recibidas**.

SQL sugerido:

```sql
create table if not exists public.catalogo_vehicle_offers (
  id uuid primary key default gen_random_uuid(),
  item_key text not null,
  vehicle_title text not null,
  patent text not null,
  reference_price numeric not null,
  offer_amount numeric not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  created_at timestamptz not null default now()
);
```

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Endpoint interno del catalogo

Este repo expone su propio endpoint normalizado:

- `GET /api/catalogo`

Puedes usarlo para integraciones futuras sin acoplarte al formato crudo de la base.

## Despliegue en Vercel

1. Subir este repo a GitHub.
2. Importarlo en Vercel.
3. Configurar las variables de entorno de `.env.example`.
4. Deploy.

No requiere `vercel.json` adicional para este MVP.

## Nota de integracion actual

La integración con `TasacionesVedisa` ya puede hacerse directo por API pública en `/api/inventario-publico`.  
El catálogo mantiene fallback a Supabase solo como contingencia.
