-- Separacion de configuracion del editor por sitio
-- Tabla compartida, una fila (id) por catalogo.
--
-- Vehiculos de Ocasion  -> id = 'vehiculos-de-ocasion'
-- Catalogo Vedisa       -> id = 'global' (u otro id propio en ese proyecto)
--
-- El inventario maestro (tabla inventario) NO se toca aqui.
-- Solo capa de presentacion: ocultos, precios, secciones, textos.

create table if not exists public.catalogo_editor_config (
  id text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz default now()
);

-- Crear fila de Vehiculos de Ocasion copiando la config actual de global (solo si no existe)
insert into public.catalogo_editor_config (id, config, updated_by, updated_at)
select
  'vehiculos-de-ocasion',
  src.config,
  'supabase-setup-copy',
  now()
from public.catalogo_editor_config src
where src.id = 'global'
  and not exists (
    select 1
    from public.catalogo_editor_config
    where id = 'vehiculos-de-ocasion'
  );

-- Si la fila existe pero quedo vacia, copiar una vez desde global
update public.catalogo_editor_config vdo
set
  config = src.config,
  updated_at = now(),
  updated_by = 'supabase-setup-copy'
from public.catalogo_editor_config src
where vdo.id = 'vehiculos-de-ocasion'
  and src.id = 'global'
  and vdo.config = '{}'::jsonb;

-- Verificar filas activas
select id, updated_at, updated_by
from public.catalogo_editor_config
order by id;
