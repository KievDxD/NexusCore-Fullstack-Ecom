// Tipos de dominio compartidos. Viven aquí (y no en un hook) para evitar
// dependencias circulares entre useCarrito <-> useProductos.

export type Moneda = 'COP' | 'USD' | 'MXN';

export interface ProductoImagen {
  id: number;
  url: string;
  orden: number;
}

// Estructura exacta de lo que viene de la base de datos (Supabase)
export interface Producto {
  id: number;
  nombre: string;
  precio: number;
  imagen: string;
  categoria: string;
  descripcion: string;
  stock: number;
  descuento?: number;
  descripcion_larga?: string;
  especificaciones?: Record<string, string>;
  marca?: string;
  imagenes?: ProductoImagen[];
}

// Un CartItem es un Producto, con la cantidad y una marca de "aún sin resolver en catálogo"
export interface CartItem extends Producto {
  cantidad: number;
  pendiente?: boolean;
}

export interface CartItemPersisted {
  id: number;
  cantidad: number;
}

export interface ResenaPerfil {
  username: string;
  avatar_url: string;
}

export interface Resena {
  id: number;
  puntuacion: number;
  comentario: string;
  created_at: string;
  profiles?: ResenaPerfil | null;
}

export type EstadoPedido = 'pendiente' | 'pagado' | 'cancelado';
export type MetodoPago = 'whatsapp' | 'wompi';

export interface PedidoItem {
  producto_id: number;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  imagen?: string;
}

export interface Pedido {
  id: string;
  user_id?: string | null;
  cliente_nombre: string;
  cliente_telefono: string;
  metodo_pago: MetodoPago;
  moneda: Moneda;
  total: number;
  estado: EstadoPedido;
  referencia_pago?: string | null;
  items: PedidoItem[];
  created_at: string;
}

export type PCBuilderSlot =
  | 'cpu'
  | 'board'
  | 'ram'
  | 'gpu'
  | 'storage'
  | 'case'
  | 'cooler'
  | 'psu';
