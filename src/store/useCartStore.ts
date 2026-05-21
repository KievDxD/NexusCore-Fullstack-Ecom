import { create } from 'zustand';

// Definimos cómo es un producto

export interface Product {
id: number;
name: string;
price: number;
image: string;
}

// Definimos el producto dentro del carrito (con su cantidad)
export interface CartItem extends Product {
quantity: number;
}

interface CartState {
cart: CartItem[];
addToCart: (product: Product) => void;
removeFromCart: (productId: number) => void;
clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
cart: [],

addToCart: (product) => set((state) => {
    const existingItem = state.cart.find((item) => item.id === product.id);
    
    if (existingItem) {
      // Si ya existe, le sumamos 1 a la cantidad
    return {
        cart: state.cart.map((item) =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        ),
    };
    }
    // Si es nuevo, lo agregamos con cantidad 1
    return { cart: [...state.cart, { ...product, quantity: 1 }] };
}),

removeFromCart: (productId) => set((state) => ({
    cart: state.cart.filter((item) => item.id !== productId),
})),

clearCart: () => set({ cart: [] }),
}));