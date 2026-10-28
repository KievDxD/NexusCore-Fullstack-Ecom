-- =====================================================================
-- MIGRACIÓN DE RENDIMIENTO, ÍNDICES Y TRANSACCIONES RPC (IDEMPOTENTE)
-- =====================================================================

-- 1. Optimización de Políticas RLS en storage.objects (Subqueries escalares InitPlan)
drop policy if exists "Los usuarios pueden subir sus propios avatares" on storage.objects;
drop policy if exists "Los usuarios pueden actualizar sus propios avatares" on storage.objects;
drop policy if exists "Los usuarios pueden borrar sus propios avatares" on storage.objects;

create policy "Los usuarios pueden subir sus propios avatares" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (select auth.role()) = 'authenticated'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Los usuarios pueden actualizar sus propios avatares" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (select auth.role()) = 'authenticated'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Los usuarios pueden borrar sus propios avatares" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (select auth.role()) = 'authenticated'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 2. Índices adicionales para ordenamiento, filtros frecuentes y búsqueda
create index if not exists productos_stock_id_idx on public.productos ((coalesce(stock, 10) = 0), id);
create index if not exists productos_marca_idx on public.productos (marca);
create index if not exists auth_users_email_lower_idx on auth.users (lower(email));

-- 3. RPC Transaccional: Obtener detalle completo de producto + galería + reseñas en 1 solo viaje de red
create or replace function public.get_producto_detalle(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prod jsonb;
  v_imgs jsonb;
  v_resenas jsonb;
begin
  select to_jsonb(p.*) into v_prod
  from public.productos p
  where p.id = p_id;

  if v_prod is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', pi.id, 'url', pi.url, 'orden', pi.orden)
      order by pi.orden asc, pi.id asc
    ),
    '[]'::jsonb
  ) into v_imgs
  from public.producto_imagenes pi
  where pi.producto_id = p_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'puntuacion', r.puntuacion,
        'comentario', coalesce(r.comentario, ''),
        'created_at', r.created_at,
        'profiles', case
          when pr.id is not null then jsonb_build_object('username', pr.username, 'avatar_url', pr.avatar_url)
          else null
        end
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  ) into v_resenas
  from (
    select *
    from public.resenas
    where producto_id = p_id
    order by created_at desc
    limit 50
  ) r
  left join public.profiles pr on pr.id = r.user_id;

  return jsonb_build_object(
    'producto', v_prod || jsonb_build_object('imagenes', v_imgs),
    'resenas', v_resenas
  );
end;
$$;

revoke all on function public.get_producto_detalle(bigint) from public;
grant execute on function public.get_producto_detalle(bigint) to anon, authenticated;

-- 4. RPC Transaccional: Crear o actualizar producto + galería de imágenes en una sola transacción atómica
create or replace function public.upsert_producto_con_imagenes(
  p_id bigint default null,
  p_nombre text default null,
  p_precio numeric default null,
  p_imagen text default null,
  p_categoria text default null,
  p_descripcion text default null,
  p_descripcion_larga text default null,
  p_especificaciones jsonb default null,
  p_marca text default null,
  p_stock integer default 10,
  p_descuento integer default 0,
  p_imagenes jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod public.productos;
  v_imgs jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'No autorizado: se requieren permisos de administrador.';
  end if;

  if p_id is null then
    insert into public.productos (
      nombre, precio, imagen, categoria, descripcion, descripcion_larga,
      especificaciones, marca, stock, descuento
    )
    values (
      p_nombre, p_precio, p_imagen, p_categoria, p_descripcion, p_descripcion_larga,
      p_especificaciones, p_marca, coalesce(p_stock, 10), coalesce(p_descuento, 0)
    )
    returning * into v_prod;
  else
    update public.productos
    set
      nombre = coalesce(p_nombre, nombre),
      precio = coalesce(p_precio, precio),
      imagen = coalesce(p_imagen, imagen),
      categoria = coalesce(p_categoria, categoria),
      descripcion = coalesce(p_descripcion, descripcion),
      descripcion_larga = coalesce(p_descripcion_larga, descripcion_larga),
      especificaciones = coalesce(p_especificaciones, especificaciones),
      marca = coalesce(p_marca, marca),
      stock = coalesce(p_stock, stock),
      descuento = coalesce(p_descuento, descuento)
    where id = p_id
    returning * into v_prod;

    if v_prod.id is null then
      raise exception 'Producto #% no encontrado.', p_id;
    end if;
  end if;

  if p_imagenes is not null then
    delete from public.producto_imagenes where producto_id = v_prod.id;

    if jsonb_array_length(p_imagenes) > 0 then
      with inserted as (
        insert into public.producto_imagenes (producto_id, url, orden)
        select
          v_prod.id,
          elem->>'url',
          coalesce((elem->>'orden')::integer, (ord - 1)::integer)
        from jsonb_array_elements(p_imagenes) with ordinality as t(elem, ord)
        where coalesce(elem->>'url', '') <> ''
        returning id, url, orden
      )
      select coalesce(
        jsonb_agg(jsonb_build_object('id', id, 'url', url, 'orden', orden) order by orden asc),
        '[]'::jsonb
      ) into v_imgs
      from inserted;
    end if;
  else
    select coalesce(
      jsonb_agg(jsonb_build_object('id', id, 'url', url, 'orden', orden) order by orden asc),
      '[]'::jsonb
    ) into v_imgs
    from public.producto_imagenes
    where producto_id = v_prod.id;
  end if;

  return to_jsonb(v_prod) || jsonb_build_object('imagenes', v_imgs);
end;
$$;

revoke all on function public.upsert_producto_con_imagenes(bigint, text, numeric, text, text, text, text, jsonb, text, integer, integer, jsonb) from public, anon;
grant execute on function public.upsert_producto_con_imagenes(bigint, text, numeric, text, text, text, text, jsonb, text, integer, integer, jsonb) to authenticated;

