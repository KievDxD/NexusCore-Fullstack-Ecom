import { type Product, useCartStore } from '../store/useCartStore';

interface ProductCardProps {
product: Product;
}

export const ProductCard = ({ product }: ProductCardProps) => {
const addToCart = useCartStore((state) => state.addToCart);

  // Estructura visual limpia (Mentalidad BEM)
const styles = {
    block: "p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between",
    image: "w-full h-48 object-cover rounded-lg",
    title: "text-lg font-bold text-gray-800 mt-3",
    price: "text-xl font-semibold text-emerald-600 mt-1",
    button: "mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors"
};

return (
    <div className={styles.block}>
    <div>
        <img src={product.image} alt={product.name} className={styles.image} />
        <h3 className={styles.title}>{product.name}</h3>
        <p className={styles.price}>${product.price.toLocaleString()}</p>
    </div>
    <button className={styles.button} onClick={() => addToCart(product)}>
        Agregar al carrito
    </button>
    </div>
);
};