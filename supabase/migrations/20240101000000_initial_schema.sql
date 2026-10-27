create extension if not exists "uuid-ossp";

-- 1. CREACIÓN DE LA TABLA DE PERFILES
-- Aquí nos aseguramos de que tenga las columnas username, email, avatar_url, role.
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  email text,
  role text default 'usuario' check (role in ('admin', 'usuario')),
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Asegurarse de que si la tabla ya existía, tenga la columna email
alter table public.profiles add column if not exists email text;

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "Cualquier persona puede ver perfiles" on public.profiles;
drop policy if exists "Los usuarios pueden editar su propio perfil" on public.profiles;
drop policy if exists "Los usuarios pueden insertar su propio perfil" on public.profiles;

create policy "Cualquier persona puede ver perfiles" on public.profiles
  for select using (true);

create policy "Los usuarios pueden editar su propio perfil" on public.profiles
  for update using (auth.uid() = id);

create policy "Los usuarios pueden insertar su propio perfil" on public.profiles
  for insert with check (auth.uid() = id);

-- 2. TRIGGER DESPUÉS DE CREAR USUARIO (handle_new_user)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, email, role, avatar_url)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
    new.email,
    'usuario',
    'https://api.dicebear.com/7.x/bottts/svg?seed=' || new.id
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. TRIGGER DE VALIDACIÓN ANTES DE REGISTRO (validate_signup)
-- CORREGIDO: Para que no arroje "Database error saving new user"
create or replace function public.validate_signup()
returns trigger as $$
declare
  username_val text;
begin
  -- Si el username no viene en los metadatos, tomamos la primera parte del correo (igual que en handle_new_user)
  username_val := lower(trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))));

  if username_val is null or length(username_val) < 3 then
    raise exception 'El nombre de usuario debe tener al menos 3 caracteres.';
  end if;

  if exists (select 1 from public.profiles where lower(username) = username_val) then
    raise exception 'El nombre de usuario "@%" ya está registrado.', username_val;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_signup_validation on auth.users;
create trigger on_auth_user_signup_validation
  before insert on auth.users
  for each row execute procedure public.validate_signup();

-- 4. FUNCIONES DE AYUDA
create or replace function public.check_user_exists(email_to_check text, username_to_check text)
returns table(email_exists boolean, username_exists boolean) as $$
begin
  return query
  select 
    exists(select 1 from auth.users where lower(email) = lower(trim(email_to_check))) as email_exists,
    exists(select 1 from public.profiles where lower(username) = lower(trim(username_to_check))) as username_exists;
end;
$$ language plpgsql security definer;

create or replace function public.get_email_by_username(username_to_find text)
returns text as $$
declare
  user_email text;
begin
  select email into user_email
  from auth.users
  where id = (
    select id from public.profiles
    where lower(username) = lower(trim(username_to_find))
    limit 1
  );
  return user_email;
end;
$$ language plpgsql security definer;

-- 5. STORAGE BUCKET: AVATARS
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Cualquier persona puede ver avatars" on storage.objects;
drop policy if exists "Los usuarios pueden subir sus propios avatares" on storage.objects;
drop policy if exists "Los usuarios pueden actualizar sus propios avatares" on storage.objects;
drop policy if exists "Los usuarios pueden borrar sus propios avatares" on storage.objects;

create policy "Cualquier persona puede ver avatars" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "Los usuarios pueden subir sus propios avatares" on storage.objects
  for insert with check (
    bucket_id = 'avatars' 
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Los usuarios pueden actualizar sus propios avatares" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Los usuarios pueden borrar sus propios avatares" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6. TABLAS DE PRODUCTOS Y RESEÑAS
create table if not exists public.productos (
  id bigint generated by default as identity primary key,
  nombre text not null,
  precio numeric not null,
  imagen text not null,
  categoria text not null,
  descripcion text,
  descripcion_larga text,
  especificaciones jsonb,
  marca text,
  stock integer default 10,
  descuento integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.productos enable row level security;

drop policy if exists "Cualquier persona puede ver productos" on public.productos;
drop policy if exists "Solo administradores pueden modificar productos" on public.productos;

create policy "Cualquier persona puede ver productos" on public.productos
  for select using (true);

create policy "Solo administradores pueden modificar productos" on public.productos
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create table if not exists public.producto_imagenes (
  id bigint generated by default as identity primary key,
  producto_id bigint references public.productos on delete cascade,
  url text not null,
  orden integer default 0
);

alter table public.producto_imagenes enable row level security;

drop policy if exists "Cualquier persona puede ver imágenes adicionales" on public.producto_imagenes;
drop policy if exists "Solo administradores pueden modificar imágenes adicionales" on public.producto_imagenes;

create policy "Cualquier persona puede ver imágenes adicionales" on public.producto_imagenes
  for select using (true);

create policy "Solo administradores pueden modificar imágenes adicionales" on public.producto_imagenes
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create table if not exists public.resenas (
  id bigint generated by default as identity primary key,
  producto_id bigint references public.productos on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  puntuacion integer check (puntuacion >= 1 and puntuacion <= 5) not null,
  comentario text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.resenas 
  drop constraint if exists resenas_user_id_fkey,
  add constraint resenas_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.resenas enable row level security;

drop policy if exists "Cualquier persona puede ver reseñas" on public.resenas;
drop policy if exists "Usuarios autenticados pueden crear reseñas" on public.resenas;
drop policy if exists "Usuarios pueden borrar su propia reseña" on public.resenas;

create policy "Cualquier persona puede ver reseñas" on public.resenas
  for select using (true);

create policy "Usuarios autenticados pueden crear reseñas" on public.resenas
  for insert with check (auth.uid() = user_id);

create policy "Usuarios pueden borrar su propia reseña" on public.resenas
  for delete using (auth.uid() = user_id or exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));

create or replace function public.finalizar_compra(items_json jsonb)
returns void as $$
declare
  item record;
  prod_stock integer;
  prod_nombre text;
begin
  for item in select * from jsonb_to_recordset(items_json) as x(id bigint, cantidad integer) loop
    select stock, nombre into prod_stock, prod_nombre
    from public.productos
    where id = item.id
    for update;

    if prod_nombre is null then
      raise exception 'El producto con ID % no existe.', item.id;
    end if;

    if prod_stock < item.cantidad then
      raise exception 'Stock insuficiente para el producto "%". Stock disponible: %, Solicitado: %', prod_nombre, prod_stock, item.cantidad;
    end if;
  end loop;

  for item in select * from jsonb_to_recordset(items_json) as x(id bigint, cantidad integer) loop
    update public.productos
    set stock = stock - item.cantidad
    where id = item.id;
  end loop;
end;
$$ language plpgsql security definer;

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
