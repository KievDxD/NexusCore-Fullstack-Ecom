export interface Producto {
    nombre: string;
    precio: number;
    imagen: string;
    categoria: string;
    id: number;
}

export const LISTA_PRODUCTOS: Producto[] = [
    {
        id: 1,
        nombre: "Auriculares Gamer Pro X",
        precio: 79900,
        imagen: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?q=80&w=500",
        categoria: "Tecnología"
    },
    {
        id: 2,
        nombre: "Teclado Mecánico RGB",
        precio: 125000,
        imagen: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=500",
        categoria: "Tecnología"
    },
    {
        id: 3,
        nombre: "Mouse Inalámbrico Ergonómico",
        precio: 45000,
        imagen: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?q=80&w=500",
        categoria: "Tecnología"
    },
    {
        id: 4,
        nombre: "Smartwatch Deportivo Serie 5",
        precio: 199000,
        imagen: "https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?q=80&w=500",
        categoria: "Gadgets"
    },
    {
        id: 5,
        nombre: "iMac Intel",
        precio: 1000000,
        imagen: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?q=80&w=500",
        categoria: "Tecnologia"
    }

];