import { type Producto } from '../hooks/useCarrito';

export const LISTA_PRODUCTOS: Producto[] = [
  {
    id: 1,
    nombre: "Procesador AMD Ryzen 7 5800X",
    precio: 899000,
    imagen: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?q=80&w=600",
    categoria: "Componentes",
    descripcion: "Procesador de alta gama de 8 núcleos y 16 hilos ideal para streaming, productividad y gaming ultra fluido.",
    stock: 12,
    marca: "AMD",
    descripcion_larga: "El procesador AMD Ryzen 7 5800X ofrece el máximo rendimiento en juegos de ritmo rápido y exigentes programas multitarea. Con su arquitectura Zen 3 de 7nm, proporciona una eficiencia energética y potencia sin precedentes en su clase.",
    especificaciones: {
      "Zócalo": "AM4",
      "Núcleos": "8",
      "Hilos": "16",
      "Frecuencia Base": "3.8 GHz",
      "Frecuencia Turbo": "4.7 GHz",
      "TDP": "105W"
    }
  },
  {
    id: 2,
    nombre: "Procesador Intel Core i5-13400F",
    precio: 749000,
    imagen: "https://images.unsplash.com/photo-1591488320449-011701bb6704?q=80&w=600",
    categoria: "Componentes",
    descripcion: "Procesador inteligente híbrido de 10 núcleos y 16 hilos, con excelente relación calidad/precio.",
    stock: 18,
    marca: "Intel",
    descripcion_larga: "El Intel Core i5-13400F combina núcleos de rendimiento (P-cores) y de eficiencia (E-cores) para ofrecer rendimiento ágil e inteligente en multitarea, juegos competitivos y tareas cotidianas exigentes, sin gráficos integrados.",
    especificaciones: {
      "Zócalo": "LGA1700",
      "Núcleos": "10 (6P + 4E)",
      "Hilos": "16",
      "Frecuencia Base": "2.5 GHz",
      "Frecuencia Turbo": "4.6 GHz",
      "Caché": "20 MB L3"
    }
  },
  {
    id: 3,
    nombre: "Tarjeta Gráfica NVIDIA RTX 4060 8GB",
    precio: 1650000,
    imagen: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?q=80&w=600",
    categoria: "Componentes",
    descripcion: "Tarjeta gráfica de última generación con DLSS 3 y Ray Tracing avanzado para gaming en 1080p y 1440p.",
    stock: 5,
    marca: "NVIDIA",
    descripcion_larga: "La tarjeta de video GeForce RTX 4060 ofrece un rendimiento increíble con la arquitectura ultra eficiente Ada Lovelace de NVIDIA. Disfruta de mundos virtuales hiper detallados con trazado de rayos (Ray Tracing) y el revolucionario multiplicador de rendimiento DLSS 3.",
    especificaciones: {
      "Memoria VRAM": "8GB GDDR6",
      "Interfaz": "128-bit",
      "Puertos": "3x DisplayPort, 1x HDMI",
      "Consumo": "115W",
      "Tecnología": "DLSS 3, Ray Tracing"
    }
  },
  {
    id: 4,
    nombre: "Tarjeta Madre ASUS TUF B550M-PLUS",
    precio: 520000,
    imagen: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=600",
    categoria: "Componentes",
    descripcion: "Tarjeta madre Micro-ATX duradera y resistente, optimizada para procesadores AMD Ryzen.",
    stock: 8,
    marca: "ASUS",
    descripcion_larga: "ASUS TUF Gaming B550M-Plus destila elementos esenciales de la última plataforma de AMD y los combina con características listas para el juego y durabilidad comprobada. Diseñada con componentes de grado militar, VRM mejorado y refrigeración integral.",
    especificaciones: {
      "Factor de forma": "Micro-ATX",
      "Socket": "AM4",
      "Chipset": "AMD B550",
      "Memoria Máxima": "128GB DDR4",
      "Puertos M.2": "2x PCIe Gen 4/3",
      "Red": "2.5Gb Ethernet"
    }
  },
  {
    id: 5,
    nombre: "RAM Corsair Vengeance RGB 16GB DDR4",
    precio: 185000,
    imagen: "https://images.unsplash.com/photo-1562976540-1502c2145186?q=80&w=600",
    categoria: "Componentes",
    descripcion: "Kit de memoria RAM de alto rendimiento con iluminación dinámica RGB multizona y diseño térmico de aluminio.",
    stock: 25,
    marca: "Corsair",
    descripcion_larga: "Corsair Vengeance RGB PRO Series DDR4 ilumina tu PC con una luz espectacular multizona direccionable individualmente, a la vez que ofrece el mejor rendimiento y estabilidad en overclocking de memorias DDR4.",
    especificaciones: {
      "Capacidad": "16GB (2 x 8GB)",
      "Tipo": "DDR4",
      "Frecuencia": "3200 MHz",
      "Latencia": "CL16",
      "Voltaje": "1.35V",
      "RGB": "Sí, direccionable"
    }
  },
  {
    id: 6,
    nombre: "SSD M.2 NVMe Samsung 970 EVO 1TB",
    precio: 380000,
    imagen: "https://images.unsplash.com/photo-1628557044797-f21a177c37ec?q=80&w=600",
    categoria: "Componentes",
    descripcion: "Unidad de estado sólido ultrarrápida con velocidades de lectura de hasta 3500 MB/s para cargas de nivel instantáneo.",
    stock: 14,
    marca: "Samsung",
    descripcion_larga: "Lleva tu experiencia de carga a límites insospechados. El Samsung 970 EVO ofrece velocidades excepcionales y una fiabilidad legendaria gracias a su controladora de última generación y a la tecnología inteligente TurboWrite.",
    especificaciones: {
      "Capacidad": "1TB",
      "Formato": "M.2 2280",
      "Interfaz": "PCIe Gen 3.0 x4",
      "Lectura": "Hasta 3,500 MB/s",
      "Escritura": "Hasta 3,300 MB/s"
    }
  },
  {
    id: 7,
    nombre: "Fuente EVGA 600W W1 80+ White",
    precio: 295000,
    imagen: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?q=80&w=600",
    categoria: "Componentes",
    descripcion: "Fuente de alimentación confiable con certificación 80 Plus para garantizar un flujo estable de energía.",
    stock: 10,
    marca: "EVGA",
    descripcion_larga: "La fuente EVGA 600W W1 es la elección ideal con el presupuesto justo. Con su ventilador súper silencioso, protecciones integradas de nivel industrial y cableado mallado negro, alimenta de forma segura tu PC gaming.",
    especificaciones: {
      "Potencia": "600W",
      "Certificación": "80 Plus White",
      "Formato": "ATX",
      "Modular": "No",
      "Ventilador": "120mm silencioso"
    }
  },
  {
    id: 8,
    nombre: "Gabinete Gaming NZXT H510 Flow Black",
    precio: 420000,
    imagen: "https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?q=80&w=600",
    categoria: "Componentes",
    descripcion: "Gabinete compacto de flujo de aire optimizado, ventana de vidrio templado y canal de cables premium.",
    stock: 7,
    marca: "NZXT",
    descripcion_larga: "El gabinete NZXT H510 Flow cuenta con un panel frontal de malla de alta ventilación para mantener tus componentes premium frescos. Incluye un sistema de gestión de cables patentado y barra de gestión icónica.",
    especificaciones: {
      "Factor de forma": "Mid-Tower",
      "Soporte Motherboard": "ATX, Micro-ATX, Mini-ITX",
      "Materiales": "Acero y Vidrio Templado",
      "Ventiladores incluidos": "2x 120mm",
      "Filtros de polvo": "Todos los ingresos de aire"
    }
  },
  {
    id: 9,
    nombre: "Cooler CPU Noctua NH-D15 chromax.black",
    precio: 350000,
    imagen: "https://images.unsplash.com/photo-1624705002806-5d72df19c3ad?q=80&w=600",
    categoria: "Componentes",
    descripcion: "Disipador de CPU de doble torre galardonado para overclocking extremo y funcionamiento ultra silencioso.",
    stock: 4,
    marca: "Noctua",
    descripcion_larga: "El NH-D15 chromax.black es una versión totalmente negra del galardonado disipador de CPU silencioso Noctua NH-D15, el buque insignia de la refrigeración por aire capaz de competir y superar a muchos sistemas de refrigeración líquida.",
    especificaciones: {
      "Tipo": "Disipador de Aire de Doble Torre",
      "Ventiladores": "2x NF-A15 PWM 140mm",
      "Nivel de Ruido": "24.6 dB(A) máx",
      "Altura": "165 mm",
      "Compatibilidad": "Intel LGA1700/1200/115x y AMD AM5/AM4"
    }
  },
  {
    id: 10,
    nombre: "Teclado Mecánico HyperX Alloy Origins Core",
    precio: 280000,
    imagen: "https://images.unsplash.com/photo-1595225476474-87563907a212?q=80&w=600",
    categoria: "Periféricos",
    descripcion: "Teclado mecánico ultra-compacto TKL con interruptores mecánicos HyperX y cuerpo de aluminio aeronáutico.",
    stock: 9,
    marca: "HyperX",
    descripcion_larga: "El HyperX Alloy Origins Core es un teclado resistente de formato TKL que cuenta con interruptores mecánicos personalizados HyperX, diseñados para ofrecer a los gamers la mejor mezcla de estilo, rendimiento y fiabilidad.",
    especificaciones: {
      "Formato": "TKL (80%)",
      "Switch": "HyperX Red (Lineales)",
      "Iluminación": "RGB por tecla",
      "Cable": "USB-C desmontable",
      "Anti-ghosting": "100% integrado"
    }
  },
  {
    id: 11,
    nombre: "Monitor LG UltraGear 27\" 144Hz IPS",
    precio: 1100000,
    imagen: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?q=80&w=600",
    categoria: "Periféricos",
    descripcion: "Monitor gamer de 27 pulgadas con panel IPS de colores vibrantes, frecuencia de refresco de 144Hz y tiempo de respuesta de 1ms GtG.",
    stock: 6,
    marca: "LG",
    descripcion_larga: "Con una alta tasa de refresco y un panel IPS ultrarrápido, el LG UltraGear te permite reaccionar antes que tus rivales. Su excelente representación de color lo hace perfecto tanto para gaming como para diseño profesional.",
    especificaciones: {
      "Tamaño de pantalla": "27 pulgadas",
      "Resolución": "FHD (1920x1080)",
      "Tipo de Panel": "IPS",
      "Tasa de refresco": "144 Hz",
      "Tiempo de respuesta": "1ms (GtG)",
      "Tecnología": "G-Sync Compatible, AMD FreeSync Premium"
    }
  },
  {
    id: 12,
    nombre: "Mouse Gamer Logitech G502 HERO",
    precio: 195000,
    imagen: "https://images.unsplash.com/photo-1527814050087-37938154799f?q=80&w=600",
    categoria: "Periféricos",
    descripcion: "Mouse con sensor óptico HERO 25K de alta precisión, pesas ajustables y 11 botones completamente programables.",
    stock: 15,
    marca: "Logitech",
    descripcion_larga: "El mouse de alto rendimiento para gaming más vendido del mundo. Cuenta con el sensor óptico de última generación HERO para una máxima precisión de seguimiento, pesas modulares de calibración y sistema de botones mecánicos.",
    especificaciones: {
      "Sensor": "HERO 25K",
      "Resolución DPI": "100 - 25,600 DPI",
      "Botones": "11 programables",
      "Sistema de Pesas": "5 pesas de 3.6g incluidas",
      "RGB": "Lightsync RGB"
    }
  }
];