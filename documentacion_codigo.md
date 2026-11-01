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
  - **Admin & Control de Inventario**:
    - **Gestión de Stock Crítico**: Panel visual que filtra y lista productos con stock $\le 3$ o agotados, con botones de un solo clic para reposición rápida (+5 y +10 unidades) mediante `handleQuickRestock`.
    - **Fijación de Stock Masivo**: Definición de inventario global para todos los productos mediante input personalizado y acción confirmada.
    - **Descuentos Dinámicos por Categoría**: Lista reactiva que itera sobre todas las categorías activas del catálogo (`CATEGORIAS_PRODUCTO`).
    - **Gestión de Pedidos en Vivo**: Liquidación a estado pagado o cancelación con devolución automática de inventario a la base de datos.
- **AdminProductoModal (`src/components/AdminProductoModal.tsx`)**: Modal de administración con arquitectura en tres pestañas (`General`, `Ficha`, `Galería`). Incorpora categorización jerárquica desacoplada en dos fases:
  1. *Grupo Principal:* Selector tipo pestaña/toggle entre `Componentes` y `Periféricos`.
  2. *Subcategoría Específica:* Menú desplegable contextual a ancho completo que elimina desbordes o truncamientos de texto ("Otros Componen..."), organizando de forma limpia procesadores, tarjetas gráficas, memoria RAM, almacenamiento, motherboards, fuentes, chasis y refrigeración.
- **Barra de Filtros y Desplazamiento Horizontal (`src/pages/Home.tsx` & `src/index.css`)**:
  - **Scrollbar Estilizado (`.custom-h-scrollbar`)**: Barra horizontal visible con altura de 6px y contraste temático adaptativo que indica la posición exacta de las categorías.
  - **Navegación Asistida**: Botones de scroll lateral (`ChevronLeft`, `ChevronRight`) y soporte nativo de rueda de ratón horizontal (`handleWheel`).
  - **Aislamiento Total del Viewport**: Integración con `data-lenis-prevent="true"`, `overscroll-contain` y listener no pasivo (`passive: false`) con `preventDefault()` y `stopPropagation()`, garantizando que rodar el mouse sobre las categorías desplace únicamente la fila de filtros sin mover verticalmente la página.
  - **Filtro Anclado de Disponibilidad**: Botón conmutador `soloEnStock` con estado visual esmeralda y contador reactivo.
- **ErrorBoundary (`src/components/ErrorBoundary.tsx`)**: Interceptor global de errores de React que evita que la aplicación se congele ante excepciones no controladas. Provee un mecanismo de "cierre de sesión de emergencia" que limpia exhaustivamente el almacenamiento local y la sesión de Supabase para desatascar bucles de error.

---

## 3. Manejo de Estado y Hooks de Negocio

- **AuthContext (`src/context/AuthContext.tsx`)**: Administra la sesión del usuario conectado contra Supabase Auth. Escucha cambios de sesión (`onAuthStateChange`), inicializa perfiles desde la tabla relacional `perfiles`, e implementa helpers para subida de avatares a buckets de almacenamiento y actualización de perfiles y nombres de usuario.
- **useCarrito (`src/hooks/useCarrito.ts`)**: Estado global ligero y persistido de la cesta de compras programado sobre **Zustand**. Valida los límites de adición contrastándolos con el stock máximo disponible del artículo.
- **useProductos (`src/hooks/useProductos.ts`)**: Encapsula las llamadas directas de Supabase para obtener catálogos filtrados por categoría, buscar términos específicos, consultar detalles individuales por ID y publicar reseñas asociadas a un producto. Incluye soporte para mutaciones masivas (`bulkUpdateStock`, `bulkCategoryDiscount`).
- **useSettings (`src/hooks/useSettings.ts`)**: Estado global sobre Zustand que manipula configuraciones visuales (tema claro, oscuro, minimalista) y la divisa base para la conversión automatizada de precios.

---

## 4. Estructura y Esquema de Base de Datos (Supabase)

El backend de base de datos PostgreSQL está estructurado con las siguientes relaciones clave:
- **`productos`**: ID, nombre, descripción, precio, categoría, stock, descuento (%), marca, especificaciones JSON y url de imagen.
- **`imagenes_producto`**: Relación uno a muchos con productos para galerías secundarias ordenadas.
- **`perfiles`**: Tabla enlazada directamente con la tabla interna de usuarios de Supabase (`auth.users`), almacenando nombre de usuario, url de avatar, rol (ej: 'admin') y marcas temporales.
- **`resenas`**: Tabla intermedia que vincula un usuario y un producto para almacenar puntuación, opiniones escritas y fechas de creación.
- **`configuraciones`**: Tabla clave-valor para almacenar parámetros persistentes de la plataforma, como el número telefónico de WhatsApp de la tienda.
- **`pedidos`**: Registro de órdenes con cliente, teléfono, método de pago (`whatsapp` | `wompi`), divisa, total, estado (`pendiente` | `pagado` | `cancelado`) y referencia de pago.
- **`pedido_items`**: Detalle de productos y cantidades asociadas a cada pedido con precio unitario congelado al momento de la compra.

---

## 5. Comparador Técnico Inteligente y Filtrado Dinámico

- **`useComparador.ts`**: Store persistente sobre Zustand (`nexus_comparador_v1`) que gestiona la selección de hasta 3 productos.
  - **Clasificación Automática de Hardware (`obtenerTipoProducto`)**: Normaliza y agrupa los productos por su arquitectura física o periférica (`CATEGORIAS_PRODUCTO`: Procesadores, Gráficas, RAM, Almacenamiento, Tarjetas Madre, Fuentes, Chasis, Coolers, Teclados, Mouses, Monitores, Audio).
  - **Jerarquía Anti-Colisiones en Detección**: Evalúa primero las tarjetas madre (`Chipset`, `motherboard`, `tarjeta madre`, familias de chipsets `B550`, `Z790`, etc.) y sistemas de refrigeración (`cooler`, `disipador`) antes de evaluar procesadores. Esto previene que placas madre que mencionan compatibilidad con *"procesadores AMD Ryzen"* o *"Intel Core"* en su descripción sean categorizadas erróneamente como CPUs.
  - **Aislamiento y Bloqueo de Comparación Cruzada**: Bloquea de forma tajante comparar componentes de distinta índole (e.g. un CPU con una placa madre o un módulo de RAM) emitiendo notificaciones informativas discretas.
  - **Métricas Ganadoras (`obtenerIndicesGanadores`)**: Algoritmo que analiza los valores técnicos extraídos de las especificaciones y precios para destacar automáticamente en verde las celdas con ventaja cuantitativa (menor precio, mayor frecuencia, mayor VRAM, menor latencia, etc.).
- **`ComparadorModal.tsx`**: Modal lado a lado con tabla técnica completa, cálculo de diferencias y barra flotante de control.
- **Filtrado Reactivo en `Home.tsx`**: Cuando hay al menos un producto en comparación, el catálogo oculta automáticamente todos los productos ajenos a esa categoría, permitiendo al usuario seleccionar exclusivamente entre componentes del mismo tipo.

---

## 6. Asistente de Compatibilidad PC Builder

- **`usePCBuilder.ts`**: Motor algorítmico de ensamble y verificación de compatibilidad de hardware.
  - **Pasos Secuenciales**: Flujo guiado por slots (`cpu`, `board`, `ram`, `gpu`, `storage`, `cooler`, `case`, `psu`).
  - **Matriz de Compatibilidad**: Valida compatibilidad de sockets (AM4, AM5, LGA1700, LGA1200), estándar de memoria (DDR4 vs DDR5), factor de forma físico (ATX, Micro-ATX, Mini-ITX) y soporte en el chasis.
  - **Cálculo de Consumo Energético**: Suma el TDP estimado de las piezas seleccionadas y calcula la potencia de fuente de poder recomendada con margen de seguridad (+150W a +200W).
- **`PCBuilderModal.tsx`**: Interfaz interactiva donde el usuario visualiza las piezas seleccionadas, alertas de incompatibilidad en tiempo real y el botón para exportar todo el ensamble al carrito en un solo clic.

---

## 7. Pasarela de Pagos Wompi y Motor Transaccional

- **`usePedidos.ts`**: Administra el ciclo de vida de los pedidos, reservas de stock y generación de firmas criptográficas.
  - **Firma de Integridad Wompi (`generarFirmaIntegridadWompi`)**: Calcula el hash SHA-256 concatenando la referencia, el monto en centavos, la divisa (`COP`) y el Integrity Secret de Wompi mediante la Web Crypto API nativa.
  - **Reserva Atómica de Stock (`crear_pedido_con_reserva`)**: Invoca la función almacenada de Postgres (RPC) para verificar stock, decrementar unidades y crear la orden dentro de una transacción ACID, previniendo sobreventas (*overselling*).
- **`WompiCheckoutModal.tsx`**: Widget incrustado que conecta con el Checkout Web de Wompi para procesar tarjetas de crédito/débito, PSE, Nequi y Bancolombia.
- **Webhook de Supabase (`supabase/functions/wompi-webhook`)**: Edge Function que valida eventos de confirmación (`transaction.updated`), verifica el checksum y actualiza el pedido a `pagado` o revierte el stock en caso de transacción declinada.

---

## 8. Utilidades de Negocio y Precios

- **`currency.ts`**:
  - `precioConDescuento`: Aplica el porcentaje de rebaja sobre el precio base.
  - `convertPrice` / `formatCurrency`: Convierte y formatea valores entre COP, USD y MXN según las tasas sincronizadas en `useSettings`.
- **`discount.ts`**:
  - `getDiscountBadgeStyle`: Clasifica descuentos en niveles (`none`, `low`, `medium`, `high`) para asignar estilos, animaciones (`animate-bounce`, `animate-pulse`) y badges distintivos según el ahorro porcentual.
