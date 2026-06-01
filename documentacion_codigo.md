# NEXUS//CORE - Documentación Técnica y Arquitectura del Código

Esta es una guía de referencia técnica estructurada para comprender el funcionamiento, la arquitectura y los flujos de datos dentro de la aplicación.

---

## 1. Arquitectura General y Flujo de Datos

El sistema sigue una arquitectura SPA (Single Page Application) basada en **Vite + React + TypeScript + TailwindCSS**, integrada con **Supabase** como backend de servicios administrados.

```
+-------------------------------------------------------------+
|                        Frontend (React)                     |
|                                                             |
|   [Páginas (Pages)]  <-->  [Componentes] <--> [Contexto/    |
|                                                Hooks]       |
+-------------------------------------------------------------+
                               ^
                               | (Supabase JS Client)
                               v
+-------------------------------------------------------------+
|                       Backend (Supabase)                    |
|                                                             |
|    [Authentication]  <-->  [PostgreSQL DB] <--> [RPCs/      |
|                                                  Storage]   |
+-------------------------------------------------------------+
```

### Flujo de Compra y Pedido a WhatsApp:
1. El usuario visualiza los productos consultados desde Supabase.
2. Los agrega al carrito de compras (gestionado localmente en memoria y persistido en `localStorage` a través del hook de Zustand `useCarrito.ts`).
3. Al dar clic en "Confirmar Compra", se procesa la lista del carrito, se calcula el total y se genera una plantilla de mensaje formateado con la lista de productos, cantidades y precios.
4. Se redirige al usuario a la API de WhatsApp (`https://wa.me/`) con el número telefónico de la tienda (configurable desde el panel de administrador) y el mensaje codificado como parámetro de consulta.

---

## 2. Componentes Clave

- **Navbar (`src/components/Navbar.tsx`)**: Barra de navegación global. Contiene el control de sesión del usuario, selector de divisas (sincronizado mediante tasas de cambio virtuales), enlace al perfil y el disparador del carrito lateral y configuraciones.
- **Hero (`src/components/Hero.tsx`)**: Portada interactiva principal con efectos premium de degradados animados y botones de llamada a la acción (CTA).
- **TarjetaProducto (`src/components/TarjetaProducto.tsx`)**: Representación visual de un producto dentro de las listas. Muestra descuento calculado, disponibilidad de stock e interacciones de añadir al carrito.
- **CarritoSidebar (`src/components/CarritoSidebar.tsx`)**: Panel lateral deslizable donde el usuario gestiona las unidades seleccionadas, observa los subtotales en su divisa preferida y genera la redirección de WhatsApp para cerrar el pedido.
- **SettingsModal (`src/components/SettingsModal.tsx`)**: Modal multitab que permite:
  - **Apariencia**: Modificar el tema cromático de fondo global y la divisa activa.
  - **Mi Perfil**: Cambiar el nombre de usuario de la cuenta y actualizar su avatar (subiendo un archivo a Supabase Storage o escogiendo uno predeterminado).
  - **Admin**: Configurar el número de teléfono de destino para pedidos (exclusivo para usuarios con rol de administrador en Supabase).

---

## 3. Manejo de Estado y Hooks de Negocio

- **AuthContext (`src/context/AuthContext.tsx`)**: Administra la sesión del usuario conectado contra Supabase Auth. Escucha cambios de sesión (`onAuthStateChange`), inicializa perfiles desde la tabla relacional `perfiles`, e implementa helpers para subida de avatares a buckets de almacenamiento y actualización de perfiles y nombres de usuario.
- **useCarrito (`src/hooks/useCarrito.ts`)**: Estado global ligero y persistido de la cesta de compras programado sobre **Zustand**. Valida los límites de adición contrastándolos con el stock máximo disponible del artículo.
- **useProductos (`src/hooks/useProductos.ts`)**: Encapsula las llamadas directas de Supabase para obtener catálogos filtrados por categoría, buscar términos específicos, consultar detalles individuales por ID y publicar reseñas asociadas a un producto.
- **useSettings (`src/hooks/useSettings.ts`)**: Estado global sobre Zustand que manipula configuraciones visuales (tema claro, oscuro, minimalista) y la divisa base para la conversión automatizada de precios.

---

## 4. Estructura y Esquema de Base de Datos (Supabase)

El backend de base de datos PostgreSQL está estructurado con las siguientes relaciones clave:
- **`productos`**: ID, nombre, descripción, precio, categoría, stock, marca, especificaciones JSON y url de imagen.
- **`imagenes_producto`**: Relación uno a muchos con productos para galerías secundarias ordenadas.
- **`perfiles`**: Tabla enlazada directamente con la tabla interna de usuarios de Supabase (`auth.users`), almacenando nombre de usuario, url de avatar, rol (ej: 'admin') y marcas temporales.
- **`resenas`**: Tabla intermedia que vincula un usuario y un producto para almacenar puntuación, opiniones escritas y fechas de creación.
- **`configuraciones`**: Tabla clave-valor para almacenar parámetros persistentes de la plataforma, como el número telefónico de WhatsApp de la tienda.
