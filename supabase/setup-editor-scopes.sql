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

-- Fila aislada para vehiculosdeocasion.cl (config vacia si no existia)
insert into public.catalogo_editor_config (id, config, updated_by, updated_at)
select
  'vehiculos-de-ocasion',
  '{}'::jsonb,
  'supabase-setup',
  now()
where not exists (
  select 1
  from public.catalogo_editor_config
  where id = 'vehiculos-de-ocasion'
);

-- Opcional: copiar UNA VEZ la config actual de Catalogo Vedisa como punto de partida
-- (solo si aun no existe la fila de Vehiculos de Ocasion con datos).
-- Descomenta las 3 lineas siguientes si lo necesitas:
--
-- update public.catalogo_editor_config vdo
-- set config = src.config, updated_at = now(), updated_by = 'supabase-setup-copy'
-- from public.catalogo_editor_config src
-- where vdo.id = 'vehiculos-de-ocasion'
--   and src.id = 'global'
--   and vdo.config = '{}'::jsonb;

-- Verificar filas activas
select id, updated_at, updated_by, jsonb_object_keys(config) as config_keys
from public.catalogo_editor_config
order by id;
