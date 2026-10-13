/**
 * DocuTrack Express - Backend API Single File
 * Sistema de Control de Correspondencia Inter-Sedes
 * Node.js nativo (Zero External Dependencies)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuración
const PORT = process.env.PORT || 3000;

// Crear directorio de datos si no existe
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'docutrack.json');

// Catálogo de estados con colores y labels
const ESTADOS = {
  EN_ESPERA: { label: 'En Espera Recolección', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: 'clock' },
  EN_TRANSITO: { label: 'En Tránsito (Mensajero)', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: 'truck' },
  RECIBIDO_SEDE: { label: 'Recibido en Sede', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: 'building-2' },
  ENTREGADO: { label: 'Entregado al Destinatario', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: 'check-circle-2' }
};

const SEDES = ['Administrativo', 'Tesoreria', 'Planta'];

// Estructura de base de datos en memoria
let db = { envios: [], usuarios: [], contador: 1 };

/**
 * ==========================================
 * SEGURIDAD Y HASHING DE CONTRASEÑAS (PBKDF2)
 * ==========================================
 */
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const iterations = 10000;
  const keylen = 64;
  const digest = 'sha512';
  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
  return `pbkdf2:${salt}:${iterations}:${derivedKey}`;
}

function verifyPassword(password, storedPassword) {
  if (!password || !storedPassword) return false;
  // Retrocompatibilidad con contraseñas históricas en texto plano
  if (!storedPassword.startsWith('pbkdf2:')) {
    return password === storedPassword;
  }
  try {
    const parts = storedPassword.split(':');
    if (parts.length !== 4) return false;
    const salt = parts[1];
    const iterations = parseInt(parts[2], 10);
    const originalHash = parts[3];
    const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derivedKey, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch (err) {
    console.error('Error al verificar password:', err.message);
    return false;
  }
}

/**
 * ==========================================
 * PERSISTENCIA ATÓMICA Y SEGURA (JSON)
 * ==========================================
 */
function guardarDB() {
  try {
    const payload = JSON.stringify(db, null, 2);
    const tmpPath = `${DB_PATH}.${process.pid}.${Date.now()}.tmp`;
    
    fs.writeFileSync(tmpPath, payload, 'utf8');
    try {
      fs.renameSync(tmpPath, DB_PATH);
    } catch (renameErr) {
      // En Windows el renombrado puede bloquearse si hay lecturas simultáneas
      fs.writeFileSync(DB_PATH, payload, 'utf8');
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      }
    }
  } catch (err) {
    console.error('❌ Error guardando base de datos:', err.message);
  }
}

function migrarUsuariosSiEsNecesario() {
  let modificado = false;
  if (!Array.isArray(db.usuarios)) {
    db.usuarios = [];
  }

  for (const u of db.usuarios) {
    // Si la contraseña está en texto plano, migrar a hash
    if (u.password && !u.password.startsWith('pbkdf2:')) {
      u.password = hashPassword(u.password);
      modificado = true;
    }
    // Asignar avatar e icono para perfiles visuales si no los tienen
    if (!u.avatar) {
      if (u.oficina === 'Administrativo') u.avatar = 'building-shield';
      else if (u.oficina === 'Tesoreria') u.avatar = 'landmark';
      else if (u.oficina === 'Planta') u.avatar = 'factory';
      else u.avatar = u.rol === 'admin' ? 'building-shield' : 'user-check';
      modificado = true;
    }
    if (!u.icono) {
      u.icono = u.rol === 'admin' ? 'shield' : 'user';
      modificado = true;
    }
  }

  if (modificado) {
    guardarDB();
    console.log('🔒 Contraseñas y perfiles de usuarios actualizados/migrados de forma segura');
  }
}

function cargarDB() {
  if (fs.existsSync(DB_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      db = {
        envios: Array.isArray(data.envios) ? data.envios : [],
        usuarios: Array.isArray(data.usuarios) ? data.usuarios : [],
        contador: typeof data.contador === 'number' ? data.contador : 1
      };
      console.log(`✅ Base de datos cargada (${db.envios.length} envíos, ${db.usuarios.length} usuarios)`);
      migrarUsuariosSiEsNecesario();
    } catch (e) {
      console.error('❌ Error al cargar base de datos:', e.message);
    }
  }
}

// Inicializar datos de demostración si la base de datos está vacía
function inicializarDatosDemo() {
  let necesitaGuardar = false;

  if (db.usuarios.length === 0) {
    db.usuarios = [
      { id: 1, username: 'admin_a', password: hashPassword('admin123'), nombre: 'Admin Administrativo', rol: 'admin', oficina: 'Administrativo', avatar: 'building-shield', icono: 'shield', creado_en: '2026-10-01T00:00:00' },
      { id: 2, username: 'admin_b', password: hashPassword('admin123'), nombre: 'Admin Tesoreria', rol: 'admin', oficina: 'Tesoreria', avatar: 'landmark', icono: 'shield', creado_en: '2026-10-01T00:00:00' },
      { id: 3, username: 'admin_p', password: hashPassword('admin123'), nombre: 'Admin Planta', rol: 'admin', oficina: 'Planta', avatar: 'factory', icono: 'shield', creado_en: '2026-10-01T00:00:00' },
      { id: 4, username: 'op_a', password: hashPassword('admin123'), nombre: 'Operador Administrativo', rol: 'operador', oficina: 'Administrativo', avatar: 'user-check', icono: 'user', creado_en: '2026-10-01T00:00:00' },
      { id: 5, username: 'op_b', password: hashPassword('admin123'), nombre: 'Operador Tesoreria', rol: 'operador', oficina: 'Tesoreria', avatar: 'coins', icono: 'user', creado_en: '2026-10-01T00:00:00' },
      { id: 6, username: 'op_p', password: hashPassword('admin123'), nombre: 'Operador Planta', rol: 'operador', oficina: 'Planta', avatar: 'hard-hat', icono: 'user', creado_en: '2026-10-01T00:00:00' }
    ];
    necesitaGuardar = true;
  }

  if (db.envios.length === 0) {
    db.envios = [
      {
        id: 'demo-1',
        radicado: 'RAD-2026-0001',
        origen: 'Administrativo',
        destino: 'Tesoreria',
        remitente: 'Contabilidad - Ana María V.',
        destinatario: 'Tesorería - Carlos R.',
        tipo: 'Facturas / Cheques',
        prioridad: 'Alta',
        asunto: 'Facturas aprobadas para firma de cheque quincenal',
        estado: 'EN_TRANSITO',
        creado_en: '2026-10-13T07:30:00',
        creado_por: 'Admin Administrativo',
        actualizado_en: '2026-10-13T08:10:00',
        historial: [
          { estado: 'EN_ESPERA', fecha: '2026-10-13T07:30:00', responsable: 'Recepción Administrativo (Admin Administrativo)', detalle: 'Documento radicado y embalado en sobre' },
          { estado: 'EN_TRANSITO', fecha: '2026-10-13T08:10:00', responsable: 'Mensajero: Juan Morales', detalle: 'Retirado de Administrativo. En ruta hacia Tesoreria' }
        ]
      },
      {
        id: 'demo-2',
        radicado: 'RAD-2026-0002',
        origen: 'Tesoreria',
        destino: 'Administrativo',
        remitente: 'Recursos Humanos - Sofía T.',
        destinatario: 'Nómina - Pedro Castro',
        tipo: 'Contrato / Legal',
        prioridad: 'Normal',
        asunto: 'Contratos firmados de nuevos contratistas',
        estado: 'RECIBIDO_SEDE',
        creado_en: '2026-10-12T15:20:00',
        creado_por: 'Admin Tesoreria',
        actualizado_en: '2026-10-13T07:50:00',
        historial: [
          { estado: 'EN_ESPERA', fecha: '2026-10-12T15:20:00', responsable: 'Recepción Tesoreria (Admin Tesoreria)', detalle: 'Radicado generado' },
          { estado: 'EN_TRANSITO', fecha: '2026-10-13T07:00:00', responsable: 'Mensajero: Juan Morales', detalle: 'Retirado de Tesoreria' },
          { estado: 'RECIBIDO_SEDE', fecha: '2026-10-13T07:50:00', responsable: 'Recepción Administrativo', detalle: 'Ingresado a Administrativo. Listo para entrega a Nómina' }
        ]
      },
      {
        id: 'demo-3',
        radicado: 'RAD-2026-0003',
        origen: 'Planta',
        destino: 'Administrativo',
        remitente: 'Jefe de Planta - Roberto M.',
        destinatario: 'Auditoría Interna - Laura G.',
        tipo: 'Valija Confidencial',
        prioridad: 'Alta',
        asunto: 'Informe de auditoría técnica confidencial',
        estado: 'EN_ESPERA',
        creado_en: '2026-10-13T08:00:00',
        creado_por: 'Admin Planta',
        actualizado_en: '2026-10-13T08:00:00',
        historial: [
          { estado: 'EN_ESPERA', fecha: '2026-10-13T08:00:00', responsable: 'Recepción Planta (Admin Planta)', detalle: 'Sobre sellado en espera de recolección' }
        ]
      }
    ];
    db.contador = 4;
    necesitaGuardar = true;
  }

  if (necesitaGuardar) {
    guardarDB();
    console.log('✅ Datos de demo inicializados correctamente');
  }
}

/**
 * ==========================================
 * HELPERS DE AUTENTICACIÓN Y REQUESTS
 * ==========================================
 */
function generarToken() {
  return crypto.randomBytes(32).toString('hex');
}

function extraerToken(req, searchParams) {
  const authHeader = req.headers.authorization || req.headers.token;
  if (authHeader) {
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  }
  if (searchParams && searchParams.get('token')) {
    return searchParams.get('token').trim();
  }
  return null;
}

function autenticar(req, res, searchParams = null) {
  const token = extraerToken(req, searchParams);
  if (!token) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'No autorizado o token expirado' }));
    return null;
  }

  const user = db.usuarios.find(u => u.token && u.token === token);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'No autorizado o token expirado' }));
    return null;
  }

  req.user = user;
  return user;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Proteger contra requests gigantes (máx 2MB)
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('Tamaño del cuerpo de la solicitud excedido'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('JSON malformado en el cuerpo de la petición'));
      }
    });
    req.on('error', reject);
  });
}

function escaparCSV(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * ==========================================
 * SERVIDOR HTTP PRINCIPAL
 * ==========================================
 */
const server = http.createServer(async (req, res) => {
  // Configuración de cabeceras CORS robustas
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, token, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'URL inválida' }));
    return;
  }

  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  // ==========================================
  // RUTAS DE API (/api/*)
  // ==========================================
  if (pathname.startsWith('/api/')) {
    
    // 1. Iniciar Sesión (Login)
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      try {
        const { username, password } = await parseBody(req);
        if (!username || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Usuario y contraseña requeridos' }));
          return;
        }

        const user = db.usuarios.find(u => u.username === username);
        if (!user || !verifyPassword(password, user.password)) {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Credenciales inválidas' }));
          return;
        }

        // Si la contraseña aún no estaba hasheada, migrarla automáticamente ahora
        if (!user.password.startsWith('pbkdf2:')) {
          user.password = hashPassword(password);
        }

        const token = generarToken();
        user.token = token;
        guardarDB();

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          token,
          user: {
            id: user.id,
            username: user.username,
            nombre: user.nombre,
            rol: user.rol,
            oficina: user.oficina,
            avatar: user.avatar,
            icono: user.icono
          }
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message || 'Error al procesar solicitud' }));
      }
      return;
    }

    // 2. Perfiles públicos para selector de usuarios rápido
    if ((pathname === '/api/auth/perfiles' || pathname === '/api/usuarios/publicos') && req.method === 'GET') {
      const perfilesPublicos = db.usuarios.map(u => ({
        id: u.id,
        username: u.username,
        nombre: u.nombre,
        rol: u.rol,
        oficina: u.oficina,
        avatar: u.avatar || (u.rol === 'admin' ? 'building-shield' : 'user-check'),
        icono: u.icono || (u.rol === 'admin' ? 'shield' : 'user')
      }));

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(perfilesPublicos));
      return;
    }

    // 3. Usuario actual autenticado (/api/auth/me)
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const user = autenticar(req, res, searchParams);
      if (!user) return;

      const userData = {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        rol: user.rol,
        oficina: user.oficina,
        avatar: user.avatar || (user.rol === 'admin' ? 'building-shield' : 'user-check'),
        icono: user.icono || (user.rol === 'admin' ? 'shield' : 'user')
      };

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        user: userData,
        ...userData
      }));
      return;
    }

    // 4. Exportar a CSV descargable
    if (pathname === '/api/export/csv' && req.method === 'GET') {
      if (!autenticar(req, res, searchParams)) return;

      const headers = [
        'Radicado',
        'Fecha',
        'Origen',
        'Destino',
        'Remitente',
        'Destinatario',
        'Tipo',
        'Prioridad',
        'Asunto',
        'Estado',
        'Último Responsable'
      ];

      const rows = db.envios.map(e => {
        const ultimoHistorial = e.historial && e.historial.length > 0 ? e.historial[e.historial.length - 1] : null;
        const ultimoResp = ultimoHistorial ? ultimoHistorial.responsable : (e.creado_por || '');
        const estadoLabel = ESTADOS[e.estado]?.label || e.estado;
        const fecha = e.creado_en ? new Date(e.creado_en).toLocaleString('es-CO') : '';

        return [
          escaparCSV(e.radicado),
          escaparCSV(fecha),
          escaparCSV(e.origen),
          escaparCSV(e.destino),
          escaparCSV(e.remitente),
          escaparCSV(e.destinatario),
          escaparCSV(e.tipo),
          escaparCSV(e.prioridad),
          escaparCSV(e.asunto),
          escaparCSV(estadoLabel),
          escaparCSV(ultimoResp)
        ].join(',');
      });

      // UTF-8 BOM (\uFEFF) para visualización correcta en Excel
      const csvContent = '\uFEFF' + [headers.map(escaparCSV).join(','), ...rows].join('\r\n');
      const filenameDate = new Date().toISOString().slice(0, 10);

      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="envios-docutrack-${filenameDate}.csv"`,
        'Cache-Control': 'no-cache'
      });
      res.end(csvContent);
      return;
    }

    // 5. Estadísticas del sistema (/api/stats)
    if (pathname === '/api/stats' && req.method === 'GET') {
      if (!autenticar(req, res, searchParams)) return;

      const por_estado = {
        EN_ESPERA: 0,
        EN_TRANSITO: 0,
        RECIBIDO_SEDE: 0,
        ENTREGADO: 0
      };
      const por_sede = {};
      const por_prioridad = {};

      for (const envio of db.envios) {
        if (por_estado[envio.estado] !== undefined) {
          por_estado[envio.estado]++;
        } else {
          por_estado[envio.estado] = 1;
        }

        if (envio.origen) {
          por_sede[envio.origen] = (por_sede[envio.origen] || 0) + 1;
        }

        if (envio.prioridad) {
          por_prioridad[envio.prioridad] = (por_prioridad[envio.prioridad] || 0) + 1;
        }
      }

      const stats = {
        total: db.envios.length,
        activos: (por_estado.EN_ESPERA || 0) + (por_estado.EN_TRANSITO || 0) + (por_estado.RECIBIDO_SEDE || 0),
        entregados: por_estado.ENTREGADO || 0,
        por_estado,
        por_sede,
        por_prioridad
      };

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(stats));
      return;
    }

    // 6. Listado de envíos (con filtros)
    if (pathname === '/api/envios' && req.method === 'GET') {
      if (!autenticar(req, res, searchParams)) return;

      const estado = searchParams.get('estado');
      const ruta = searchParams.get('ruta');
      const busqueda = searchParams.get('busqueda');

      let resultados = [...db.envios];

      if (estado && estado !== 'todos') {
        resultados = resultados.filter(e => e.estado === estado);
      }

      if (ruta && ruta !== 'todas') {
        // Formato: "Origen_Destino" (ej: Administrativo_Tesoreria)
        const [origenRuta, destinoRuta] = ruta.split('_');
        resultados = resultados.filter(e => e.origen === origenRuta && e.destino === destinoRuta);
      }

      if (busqueda) {
        const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const term = norm(busqueda);
        resultados = resultados.filter(e => 
          norm(e.radicado).includes(term) ||
          norm(e.destinatario).includes(term) ||
          norm(e.remitente).includes(term) ||
          norm(e.asunto).includes(term)
        );
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(resultados));
      return;
    }

    // 7. Obtener envío por radicado
    if (pathname.match(/^\/api\/envios\/[^\/]+$/) && req.method === 'GET') {
      if (!autenticar(req, res, searchParams)) return;

      const radicado = pathname.split('/').pop().toUpperCase();
      const envio = db.envios.find(e => e.radicado?.toUpperCase() === radicado);

      if (!envio) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Envío no encontrado' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(envio));
      return;
    }

    // 8. Crear nuevo envío
    if (pathname === '/api/envios' && req.method === 'POST') {
      if (!autenticar(req, res, searchParams)) return;

      try {
        const { origen, destino, remitente, destinatario, tipo, prioridad, asunto } = await parseBody(req);
        
        if (!origen || !destino || !remitente || !destinatario || !asunto) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Todos los campos obligatorios deben ser completados' }));
          return;
        }

        const ahora = new Date().toISOString();
        const radicado = `RAD-${new Date().getFullYear()}-${String(db.contador).padStart(4, '0')}`;
        const creadorNombre = req.user.nombre || req.user.username || 'Sistema';

        const nuevo = {
          id: crypto.randomUUID(),
          radicado,
          origen,
          destino,
          remitente,
          destinatario,
          tipo: tipo || 'Correspondencia General',
          prioridad: prioridad || 'Normal',
          asunto,
          estado: 'EN_ESPERA',
          creado_en: ahora,
          creado_por: creadorNombre,
          actualizado_en: ahora,
          historial: [{
            estado: 'EN_ESPERA',
            fecha: ahora,
            responsable: `Recepción ${origen} (${creadorNombre})`,
            detalle: `Radicado creado por ${remitente}. En espera de recolección.`
          }]
        };

        db.envios.unshift(nuevo);
        db.contador++;
        guardarDB();

        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(nuevo));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message || 'Error al procesar la solicitud' }));
      }
      return;
    }

    // 9. Actualizar estado de envío
    if (pathname.match(/^\/api\/envios\/[^\/]+\/estado$/) && req.method === 'PUT') {
      if (!autenticar(req, res, searchParams)) return;

      const radicado = pathname.split('/')[3].toUpperCase();
      try {
        const { estado, responsable, detalle, firma } = await parseBody(req);
        
        if (!estado || !ESTADOS[estado]) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            error: `Estado inválido. Los estados permitidos son: ${Object.keys(ESTADOS).join(', ')}`
          }));
          return;
        }

        const envio = db.envios.find(e => e.radicado?.toUpperCase() === radicado);
        if (!envio) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Envío no encontrado' }));
          return;
        }

        const ahora = new Date().toISOString();
        const usuarioActivo = req.user.nombre || req.user.username;
        const responsableFinal = (responsable && responsable.trim() !== '') ? responsable.trim() : usuarioActivo;
        const detalleFinal = (detalle && detalle.trim() !== '') ? detalle.trim() : `Cambio de estado a ${ESTADOS[estado].label}`;

        envio.estado = estado;
        envio.actualizado_en = ahora;
        envio.historial.push({
          estado,
          fecha: ahora,
          responsable: responsableFinal,
          detalle: detalleFinal,
          firma: firma || null
        });
        
        guardarDB();

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(envio));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: e.message || 'Error al procesar la solicitud' }));
      }
      return;
    }

    // 10. Ruta API no encontrada
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Endpoint de API no encontrado' }));
    return;
  }

  // ==========================================
  // SERVIR ARCHIVOS ESTÁTICOS (/public)
  // Con protección contra Path Traversal
  // ==========================================
  const publicDir = path.resolve(__dirname, 'public');
  let targetFile = pathname === '/' ? '/index.html' : pathname;

  try {
    targetFile = decodeURIComponent(targetFile);
  } catch (_) {}

  // Normalizar y limpiar secuencias '..'
  const safePath = path.normalize(targetFile).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.resolve(publicDir, '.' + (safePath.startsWith(path.sep) ? safePath : path.sep + safePath));

  // Verificación estricta de Path Traversal
  if (!fullPath.startsWith(publicDir)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Acceso denegado: ruta fuera de los límites permitidos' }));
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback a index.html si no tiene extensión (soporte SPA)
      if (!path.extname(fullPath)) {
        const fallbackIndex = path.join(publicDir, 'index.html');
        if (fs.existsSync(fallbackIndex)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          fs.createReadStream(fallbackIndex).pipe(res);
          return;
        }
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Archivo no encontrado');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.csv': 'text/csv; charset=utf-8'
    };

    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Content-Length': stats.size
    });
    fs.createReadStream(fullPath).pipe(res);
  });
});

// Inicialización del sistema
cargarDB();
inicializarDatosDemo();

// Iniciar servidor en el puerto configurado
server.listen(PORT, () => {
  console.log(`🚀 DocuTrack Express corriendo exitosamente en http://localhost:${PORT}`);
});