-- =====================================================================
-- ENDURECIMIENTO DE SEGURIDAD Y RENDIMIENTO (idempotente)
-- Aplicar sobre bases existentes (SQL editor de Supabase) o como parte
-- de supabase_schema.sql en instalaciones nuevas.
-- =====================================================================

-- 1. Helper de rol admin (security definer: no depende de la RLS de profiles)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2. PROFILES: nadie puede auto-asignarse rol 'admin'
drop policy if exists "Los usuarios pueden editar su propio perfil" on public.profiles;
drop policy if exists "Los usuarios pueden insertar su propio perfil" on public.profiles;

create policy "Los usuarios pueden editar su propio perfil" on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Los usuarios pueden insertar su propio perfil" on public.profiles
  for insert
  with check ((select auth.uid()) = id and role = 'usuario');

-- Defensa en profundidad: aunque una politica falle, el rol no cambia desde la API (anon/authenticated).
-- Un administrador de BD (SQL editor / service_role) si puede cambiarlo.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role_trg on public.profiles;
create trigger protect_profile_role_trg
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- 3. PROFILES: ocultar el email de la lectura publica (solo columnas no sensibles)
revoke select on public.profiles from anon, authenticated;
grant select (id, username, avatar_url, role, created_at) on public.profiles to anon, authenticated;

-- 4. Politicas de escritura de catalogo: una por comando, con WITH CHECK
drop policy if exists "Solo administradores pueden modificar productos" on public.productos;
drop policy if exists "Admins insertan productos" on public.productos;
drop policy if exists "Admins actualizan productos" on public.productos;
drop policy if exists "Admins eliminan productos" on public.productos;

create policy "Admins insertan productos" on public.productos
  for insert with check (public.is_admin());
create policy "Admins actualizan productos" on public.productos
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins eliminan productos" on public.productos
  for delete using (public.is_admin());

drop policy if exists "Solo administradores pueden modificar imágenes adicionales" on public.producto_imagenes;
drop policy if exists "Admins insertan imagenes" on public.producto_imagenes;
drop policy if exists "Admins actualizan imagenes" on public.producto_imagenes;
drop policy if exists "Admins eliminan imagenes" on public.producto_imagenes;

create policy "Admins insertan imagenes" on public.producto_imagenes
  for insert with check (public.is_admin());
create policy "Admins actualizan imagenes" on public.producto_imagenes
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins eliminan imagenes" on public.producto_imagenes
  for delete using (public.is_admin());

drop policy if exists "Usuarios autenticados pueden crear reseñas" on public.resenas;
drop policy if exists "Usuarios pueden borrar su propia reseña" on public.resenas;

create policy "Usuarios autenticados pueden crear reseñas" on public.resenas
  for insert with check ((select auth.uid()) = user_id);
create policy "Usuarios pueden borrar su propia reseña" on public.resenas
  for delete using ((select auth.uid()) = user_id or public.is_admin());

-- 4b. Integridad de datos
alter table public.productos drop constraint if exists productos_precio_check;
alter table public.productos add constraint productos_precio_check check (precio >= 0);
alter table public.productos drop constraint if exists productos_stock_check;
alter table public.productos add constraint productos_stock_check check (stock is null or stock >= 0);
alter table public.productos drop constraint if exists productos_descuento_check;
alter table public.productos add constraint productos_descuento_check check (descuento is null or (descuento between 0 and 100));

-- 5. Indices (FKs y filtros frecuentes)
create index if not exists productos_categoria_idx on public.productos (categoria);
create index if not exists producto_imagenes_producto_id_idx on public.producto_imagenes (producto_id, orden);
create index if not exists resenas_producto_id_idx on public.resenas (producto_id, created_at desc);
create index if not exists resenas_user_id_idx on public.resenas (user_id);

-- 6. Trigger de alta: username normalizado igual que en validate_signup (lower + trim)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email, role, avatar_url)
  values (
    new.id,
    lower(trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)))),
    new.email,
    'usuario',
    'https://api.dicebear.com/7.x/bottts/svg?seed=' || new.id
  );
  return new;
end;
$$;

-- 7. RPCs auxiliares: search_path fijo
create or replace function public.check_user_exists(email_to_check text, username_to_check text)
returns table(email_exists boolean, username_exists boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    exists(select 1 from auth.users where lower(email) = lower(trim(email_to_check))) as email_exists,
    exists(select 1 from public.profiles where lower(username) = lower(trim(username_to_check))) as username_exists;
end;
$$;

create or replace function public.get_email_by_username(username_to_find text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
begin
  select u.email into user_email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(trim(username_to_find))
  limit 1;
  return user_email;
end;
$$;

-- 8. finalizar_compra: solo administradores (descuenta stock de forma atomica)
--    Antes cualquier visitante podia vaciar el inventario llamando a la RPC.
create or replace function public.finalizar_compra(items_json jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  prod_stock integer;
  prod_nombre text;
begin
  if not public.is_admin() then
    raise exception 'No autorizado.';
  end if;

  for item in select * from jsonb_to_recordset(items_json) as x(id bigint, cantidad integer) loop
    if item.cantidad is null or item.cantidad <= 0 then
      raise exception 'Cantidad invalida para el producto %.', item.id;
    end if;

    select stock, nombre into prod_stock, prod_nombre
    from public.productos
    where id = item.id
    for update;

    if prod_nombre is null then
      raise exception 'El producto con ID % no existe.', item.id;
    end if;

    if coalesce(prod_stock, 0) < item.cantidad then
      raise exception 'Stock insuficiente para el producto "%". Stock disponible: %, Solicitado: %', prod_nombre, prod_stock, item.cantidad;
    end if;

    update public.productos set stock = stock - item.cantidad where id = item.id;
  end loop;
end;
$$;

revoke all on function public.finalizar_compra(jsonb) from public, anon;
grant execute on function public.finalizar_compra(jsonb) to authenticated;

