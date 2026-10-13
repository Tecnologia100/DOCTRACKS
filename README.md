# 📦 DocuTrack Express v2.0 Pro

Sistema integral de Control de Correspondencia Inter-Sedes con cadena de custodia completa, códigos QR, firma digital en pantalla y exportación de reportes.

---

## ✨ Características Principales

- **Gestión de envíos inter-sedes**: Administrativo ⇄ Tesorería ⇄ Planta.
- **Cadena de custodia en 3 etapas**: En Espera → En Tránsito → Recibido en Destino → Entregado.
- **Acceso visual por perfiles (1-Clic)**: Selector interactivo organizado por sedes y roles (Admin / Operador) sin necesidad de memorizar nombres técnicos de usuario.
- **Seguridad robusta**: Hashing de contraseñas con PBKDF2 (SHA-512) nativo y validación estricta de tokens en todas las operaciones del backend.
- **Códigos QR de radicación**: Generación dinámica e instantánea de etiquetas listas para imprimir en térmicas o estándar (`@media print`).
- **Firma digital manuscrita**: Captura en pantalla táctil o con ratón en Canvas HTML5 y almacenamiento directo en Base64.
- **Trazabilidad y auditoría**: Registro del usuario real que radicado, despachó, recibió y entregó cada sobre con marcas de tiempo precisas.
- **Exportación oficial a Excel / CSV**: Descarga en un clic con codificación BOM UTF-8 compatible nativamente con Microsoft Excel.
- **Preselección inteligente**: Al radicar correspondencia, el sistema autoselecciona la sede de origen y sugiere los datos del usuario conectado.
- **Cero dependencias npm**: 100% Node.js nativo (funciona inmediatamente sin `npm install`).

---

## 🚀 Instalación y Puesta en Marcha

### 1. Iniciar el servidor
```bash
node server-single-file.js
```

### 2. Abrir la aplicación
Abrir en el navegador web:
👉 **`http://localhost:3000`**

> 💡 **Nota:** La base de datos (`data/docutrack.json`) se inicializa automáticamente la primera vez con usuarios y envíos de demostración con contraseñas protegidas.

---

## 👥 Perfiles y Modos de Acceso

La aplicación incluye un **Selector Visual de Perfiles** donde puedes ingresar con **1 solo clic**:

| Sede | Perfil | Rol | Función Principal |
|------|--------|-----|-------------------|
| **Administrativo** | Admin Administrativo | Admin | Gestión integral y auditoría de correspondencia |
| **Administrativo** | Operador Administrativo | Operador | Ventanilla de radicación y recepción |
| **Tesorería** | Admin Tesorería | Admin | Auditoría y control de valijas financieras |
| **Tesorería** | Operador Tesorería | Operador | Ventanilla de recepción y entrega de cheques |
| **Planta** | Admin Planta | Admin | Control de envíos y valijas técnicas |
| **Planta** | Operador Planta | Operador | Ventanilla de despacho y recepción en planta |

> **Ingreso manual alternativo:** Puedes usar la pestaña *Ingreso Manual* con los usuarios (`admin_a`, `admin_b`, `admin_p`, `op_a`, `op_b`, `op_p`) y la contraseña demo: `admin123`.

---

## 🏗️ Estructura del Proyecto

```
DOCUTRACK/
├── server-single-file.js    # Backend API seguro (Node.js nativo, PBKDF2, CSV, auth)
├── public/
│   └── index.html           # Frontend SPA responsivo (Tailwind CSS + QR + Canvas Firma)
├── data/
│   └── docutrack.json       # Base de datos JSON con persistencia atómica
├── test_backend.js          # Suite de pruebas automatizadas del API
├── package.json             # Metadatos del proyecto y scripts
└── README.md                # Documentación del sistema
```

---

## 📡 API Endpoints

### Autenticación y Perfiles
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/auth/perfiles` | Lista pública de perfiles (sin contraseñas) para el selector visual |
| POST | `/api/auth/login` | Autenticación con contraseña `{username, password}` |
| GET | `/api/auth/me` | Consulta del perfil del usuario actualmente autenticado |

### Gestión de Envíos (Requieren Bearer Token)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/envios` | Listado de correspondencia con filtros `?estado=`, `?ruta=`, `?busqueda=` |
| GET | `/api/envios/:radicado` | Detalle del sobre y timeline completo de custodia |
| POST | `/api/envios` | Radicar nuevo documento (atribuye automáticamente al usuario creador) |
| PUT | `/api/envios/:radicado/estado` | Avanzar estado de custodia `{estado, responsable?, detalle, firma?}` |

### Reportes y Analítica
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/export/csv` | Descarga de reporte completo en formato CSV (compatible Excel) |
| GET | `/api/stats` | Métricas consolidadas (totales, activos, por sede y por prioridad) |

---

## 🎯 Flujo de Operación para Entrega

1. **Ingreso:** Al acceder a `http://localhost:3000`, haz clic en tu perfil o sede en el modal de bienvenida.
2. **Radicación:** En la pestaña *Radicar Envío*, la sede origen ya viene seleccionada. Completa el destinatario, asunto y haz clic en *Radicar e Imprimir Etiqueta*.
3. **Impresión de Etiqueta:** Se abrirá el modal con el código QR y formato de valija listo para imprimir (`Ctrl+P` o botón Imprimir).
4. **Punto de Control:**
   - **En Espera** ➔ Registrar despacho con mensajero en ruta (*En Tránsito*).
   - **En Tránsito** ➔ Confirmar llegada a ventanilla destino (*Recibido en Sede*).
   - **Recibido en Sede** ➔ Registrar entrega física al destinatario capturando su firma digital en pantalla (*Entregado*).
5. **Auditoría:** En el listado, presiona el icono de reloj para ver la línea de tiempo completa y la firma digital almacenada.
6. **Exportar:** Haz clic en *Exportar CSV* para descargar el reporte consolidado para contabilidad o gerencia.

---

## 📄 Licencia

MIT - Desarrollado para gestión y custodia de correspondencia inter-sedes.