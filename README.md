# NEXUS//CORE - E-Commerce a WhatsApp

Este proyecto es una plataforma de e-commerce premium que conecta un catálogo dinámico y un panel de administración directamente con envíos de pedidos a WhatsApp utilizando Supabase como base de datos y backend de autenticación.

## Requisitos Previos

- Node.js v20+
- Base de datos en Supabase

## Instalación y Configuración

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno copiando `.env.example` a `.env.production` o `.env.qa`:
   ```bash
   cp .env.example .env.production
   ```

3. Rellenar los valores de Supabase en el archivo `.env.production` creado.

## Comandos Disponibles

- `npm run dev` - Inicia servidor de desarrollo local
- `npm run build` - Compila el proyecto listo para producción
- `npm run lint` - Ejecuta comprobación de estilo de código
- `npm run preview` - Previsualiza localmente la compilación de producción
