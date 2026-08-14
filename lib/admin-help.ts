export type AdminHelpEntry = {
  title: string;
  intro: string;
  points: string[];
  warning?: string;
  related?: string[];
  guideSlug?: string;
};

/**
 * Contenido centralizado de ayuda contextual de la Administración.
 * Cada sección usa una clave estable (coincide con la ruta o el recurso)
 * y se muestra desde el ícono "?" de la cabecera.
 */
export const adminHelpContent: Record<string, AdminHelpEntry> = {
  resumen: {
    title: "Resumen",
    intro: "La puerta de entrada al panel: muestra cómo está tu negocio hoy y qué conviene revisar.",
    points: [
      "Las tarjetas superiores muestran cantidades generales (productos, categorías, eventos, opiniones).",
      "La sección “Atención operativa” junta lo que necesita tu mirada: pedidos en curso, reservas pendientes y stock bajo.",
      "Los números son enlaces: hacé clic para ir directo a la sección correspondiente.",
    ],
    related: ["pedidos", "reservas", "inventario", "notificaciones"],
  },
  onboarding: {
    title: "Puesta en marcha",
    intro: "Una lista de pasos guiada para dejar el negocio listo antes de abrir al público.",
    points: [
      "Cada paso reconoce automáticamente si ya está hecho.",
      "Podés salir y volver cuando quieras: el avance se guarda solo.",
      "El porcentaje muestra cuánto falta para publicar la página.",
    ],
    related: ["productos", "marca", "horarios"],
  },
  productos: {
    title: "Productos",
    intro: "Cada producto alimenta tu carta pública: nombre, precio, imagen, disponibilidad y publicación.",
    points: [
      "Los estados de publicación controlan si se ve: Publicado (visible), Programado (a futuro), Borrador (sin publicar), Oculto (guardado pero oculto) y Archivado (fuera de uso).",
      "Podés limitar días y horarios de disponibilidad, y marcar un producto como Agotado.",
      "Los productos pueden tener variantes (tamaños, presentaciones) y agregados (extras) que se eligen en el panel de Variantes y agregados.",
      "Si el producto tiene control de stock activo, los pedidos verifican existencias antes de confirmarse.",
      "La experiencia 3D y realidad aumentada (modelos, medidas, escala y superficie) se configura en la sección avanzada del formulario del producto.",
    ],
    warning: "El precio que ve el cliente siempre es el precio promocional si existe; revisalo antes de publicar.",
    related: ["opciones-producto", "categorias", "inventario"],
  },
  "opciones-producto": {
    title: "Variantes y agregados",
    intro: "Configurá opciones que los clientes eligen al pedir, sin duplicar productos.",
    points: [
      "Las variantes son presentaciones (ej. tamaño, combinación) que pueden ajustar el precio.",
      "Los agregados son extras (ej. ingredientes) que suman importe por unidad.",
      "Los cambios se aplican automáticamente en la carta y en los pedidos.",
    ],
    related: ["productos"],
  },
  categorias: {
    title: "Categorías",
    intro: "Organizá los productos en grupos para que la carta se lea con orden.",
    points: [
      "Una categoría puede tener imagen, descripción y orden de aparición.",
      "Los productos se asignan a una categoría desde el propio producto o desde aquí.",
      "Las categorías sin productos se muestran igualmente en la carta.",
    ],
    related: ["productos"],
  },
  promociones: {
    title: "Promociones",
    intro: "Creá beneficios que se aplican solos o con código cuando los clientes piden.",
    points: [
      "Tipos disponibles: porcentaje, descuento fijo, precio especial, dos por uno, happy hour, por día, por horario y cupón.",
      "Podés limitar el descuento a productos o categorías puntuales, y exigir una compra mínima.",
      "La vigencia combina fechas, horarios y días de la semana según la zona horaria del negocio.",
      "Una promoción “Publicada” o “Programada” aparece en la página pública y se aplica en los pedidos cuando corresponde.",
      "Combo y cumpleaños figuran como “Próximamente”: todavía no se aplican automáticamente.",
    ],
    warning: "Los códigos deben ser únicos: no dupliques un cupón existente o el cliente usará el primero.",
    related: ["productos", "categorias", "pedidos"],
  },
  eventos: {
    title: "Eventos",
    intro: "Promocioná fechas especiales, shows y propuestas para que aparezcan en tu página.",
    points: [
      "Cada evento muestra fecha, lugar e imagen en la sección pública de agenda.",
      "Los eventos recientes también aparecen en el Resumen del panel.",
    ],
    related: ["resumen"],
  },
  horarios: {
    title: "Horarios",
    intro: "Definí cuándo abre y cierra tu negocio según el día.",
    points: [
      "Se usan en la página pública y en los avisos de disponibilidad.",
      "Podés tener horario de mañana y de tarde por día.",
    ],
    related: ["productos"],
  },
  testimonios: {
    title: "Testimonios",
    intro: "Opiniones que dejan tus clientes en la página; vos decidís cuáles se publican.",
    points: [
      "Las opiniones nuevas llegan como Pendiente y necesitan aprobación.",
      "Arrastrá cada opinión entre columnas o usá sus botones rápidos.",
      "Solo las opiniones Publicadas se muestran al público.",
    ],
    related: ["resumen"],
  },
  pedidos: {
    title: "Pedidos",
    intro: "Un pedido es una compra de tus clientes. Mesa, retiro y delivery son solo la forma en que lo reciben.",
    points: [
      "Cada pedido guarda productos, precios verificados e historial de estados.",
      "El movimiento de estados (Recibido → Confirmado → En preparación → Listo → Entregado/Cancelado) lo hacés desde las tarjetas.",
      "Abrí un pedido para ver cliente, entrega, importes, avance y crear o ver su comprobante.",
      "Los pedidos descuentan stock automáticamente cuando corresponde; cancelar devuelve las unidades.",
    ],
    warning: "Cancelar un pedido devuelve las unidades al inventario; no lo canceles dos veces.",
    related: ["cocina", "inventario", "facturacion", "estadisticas"],
  },
  cocina: {
    title: "Cocina",
    intro: "Una pantalla simple para el equipo que prepara: qué hay que hacer y cuándo está listo.",
    points: [
      "Los pedidos esperando aparecen para empezar y después pasan a preparación.",
      "Con EMPEZAR se marca que el pedido está en preparación; con LISTO queda para entregar.",
      "Esta vista también funciona bien en una tablet o un monitor de cocina.",
    ],
    related: ["pedidos"],
  },
  reservas: {
    title: "Reservas",
    intro: "Administrá las mesas reservadas, la capacidad y los próximos visitantes.",
    points: [
      "Las reservas pasan por Pendiente → Confirmada → Finalizada, o se cancelan.",
      "La capacidad por franja horaria se controla desde “Configurar reservas”.",
      "Hoy muestra quién viene, con quién y a qué hora.",
      "Los bloqueos permiten sacar franjas completas de la disponibilidad pública.",
    ],
    related: ["mesas", "estadisticas"],
  },
  facturacion: {
    title: "Comprobantes",
    intro: "Generá comprobantes internos de los pedidos para llevar el control de facturación.",
    points: [
      "Los comprobantes son documentos internos y no sustituyen una factura fiscal.",
      "La integración con un proveedor fiscal autorizado se suma más adelante.",
      "Cada comprobante queda vinculado a su pedido.",
    ],
    warning: "La integración fiscal todavía no está activa; no la uses para emitir facturas oficiales.",
    related: ["pedidos"],
  },
  inventario: {
    title: "Inventario",
    intro: "Controlá las existencias de tus productos y evitá vender lo que no hay.",
    points: [
      "Activá el control solo en los productos que quieras descontar con cada pedido.",
      "Cada producto puede tener un mínimo: cuando el stock llega a ese nivel, se genera una alerta.",
      "Los pedidos descuentan existencias automáticamente y los movimientos quedan registrados.",
      "Los ajustes manuales y las restituciones por cancelación también quedan en el historial.",
    ],
    warning: "El stock se maneja por sucursal: verificá sobre cuál estás trabajando antes de ajustar.",
    related: ["pedidos", "sucursales", "productos"],
  },
  mesas: {
    title: "Mesas y QR",
    intro: "Cada mesa tiene un código QR que lleva al cliente directamente a tu carta.",
    points: [
      "Cada mesa pertenece a una sucursal y a un sector del salón.",
      "Imprimí los carteles con el QR para colocarlos en el salón.",
      "Las mesas se vinculan con los pedidos de mesa y con las reservas.",
    ],
    related: ["reservas", "sucursales", "pedidos"],
  },
  sucursales: {
    title: "Sucursales",
    intro: "Si tu negocio tiene más de un local, administrá cada sucursal por separado.",
    points: [
      "Cada sucursal define su propio stock, mesas, delivery y pedidos mínimos.",
      "Las promociones, productos y contenidos son del negocio en general.",
      "Las operaciones diarias se identifican con el nombre de la sucursal correspondiente.",
    ],
    related: ["inventario", "mesas", "pedidos"],
  },
  "clientes-frecuentes": {
    title: "Clientes frecuentes",
    intro: "Los clientes que aceptan el programa suman puntos con cada pedido y los pueden canjear.",
    points: [
      "Cada perfil guarda pedidos, puntos, nivel y movimientos con su historial.",
      "Podés ajustar puntos manualmente cuando haga falta corregir un movimiento.",
      "Los canjes y reversiones quedan registrados para evitar errores dobles.",
    ],
    warning: "Canjear o revertir puntos es una operación sensible: revisá el saldo antes de confirmar.",
    related: ["pedidos", "auditoria"],
  },
  negocio: {
    title: "Negocio",
    intro: "Los datos básicos que identifican tu negocio en la página y en los pedidos.",
    points: [
      "Dirección, teléfono, email y redes se muestran al público.",
      "La ubicación se usa para indicar cómo llegar.",
    ],
    related: ["marca", "seo"],
  },
  marca: {
    title: "Marca y presencia digital",
    intro: "Una sola configuración controla la identidad visual de tu página pública.",
    points: [
      "Logo, isotipo, favicon, colores y tipografía se aplican en todo el sitio.",
      "Los textos y perfiles sociales también se editan desde aquí.",
      "Un cambio se refleja al instante en toda la página.",
    ],
    related: ["negocio", "seo"],
  },
  landing: {
    title: "Editor de portada",
    intro: "Diseñá el inicio de tu página pública con vista previa en tiempo real.",
    points: [
      "El título, el texto y la imagen se guardan con la marca del negocio.",
      "La vista previa muestra el resultado con tus colores mientras escribís.",
      "La imagen se carga por arrastre y queda disponible en la biblioteca multimedia.",
    ],
    related: ["marca", "seo"],
  },
  busqueda: {
    title: "Búsqueda global",
    intro: "Encontrá contenido de todo el negocio sin cambiar de sección.",
    points: [
      "Buscá productos, categorías, clientes, pedidos y reservas en una sola pantalla.",
      "Cada resultado lleva directo al registro para editarlo o revisarlo.",
      "Los resultados respetan los permisos de tu perfil.",
    ],
    related: ["pedidos", "clientes-frecuentes", "productos"],
  },
  seo: {
    title: "SEO",
    intro: "Controla cómo aparece tu negocio en buscadores y cuando compartís enlaces.",
    points: [
      "Cada página pública puede tener su título y descripción propios.",
      "Estos textos se usan al compartir el enlace en WhatsApp, redes o Google.",
    ],
    related: ["negocio", "marca"],
  },
  redirecciones: {
    title: "Redirecciones",
    intro: "Enviá visitantes de una dirección antigua a una nueva sin que se pierdan.",
    points: [
      "Útil cuando cambiás una dirección o un producto de lugar.",
      "Cada regla redirige una dirección a otra con un código de respuesta.",
    ],
    related: ["seo"],
  },
  integraciones: {
    title: "Integraciones",
    intro: "Conexiones con servicios externos para avisos y pagos. Las claves se guardan solo en el servidor.",
    points: [
      "Las claves privadas nunca se muestran ni se guardan en el panel.",
      "Email, WhatsApp, Web Push, Mercado Pago y almacenamiento externo están en “Próximamente”.",
      "El canal Panel funciona dentro de MenuClick.",
    ],
    related: ["notificaciones", "facturacion"],
  },
  legales: {
    title: "Páginas legales",
    intro: "Políticas, condiciones y avisos que se publican en tu página.",
    points: [
      "Creá y editá textos como políticas de privacidad o condiciones.",
      "Cada página puede estar publicada, en borrador u oculta.",
    ],
    related: ["seo"],
  },
  casos: {
    title: "Casos de éxito",
    intro: "Testimonios destacados para la sección de clientes de tu página.",
    points: [
      "Cada caso muestra logo, imagen de portada y una historia.",
      "Sirven para presentar el trabajo en la página pública de clientes.",
    ],
    related: ["testimonios"],
  },
  estadisticas: {
    title: "Analítica",
    intro: "Números propios y anónimos para entender cómo funciona tu negocio.",
    points: [
      "Elegí el período: 7, 30 o 90 días.",
      "Los datos son propios: no dependen de servicios de terceros.",
      "Podés exportar el resumen en CSV.",
    ],
    related: ["pedidos", "reservas"],
  },
  notificaciones: {
    title: "Notificaciones",
    intro: "Avisos que MenuClick te deja en el panel cuando pasa algo importante.",
    points: [
      "Cada aviso lleva a la sección donde tenés que actuar.",
      "Elegí qué eventos querés seguir desde la configuración.",
      "El canal Panel funciona hoy; los canales externos están en “Próximamente”.",
    ],
    related: ["resumen", "inventario", "pedidos"],
  },
  oportunidades: {
    title: "Oportunidades",
    intro: "Consultas que llegan desde el formulario de solicitud de demostración.",
    points: [
      "Cada consulta se agrupa por etapa del proceso comercial.",
      "Podés cambiar la etapa a medida que avanza la conversación.",
    ],
  },
  planes: {
    title: "Planes y precios",
    intro: "La oferta comercial que se muestra en la página pública de planes.",
    points: [
      "Los cambios se reflejan al instante en la página pública.",
      "Cada plan define su precio, descripción y características.",
    ],
    warning: "Cambiar la oferta activa afecta lo que ven los visitantes: revisalo antes de publicar.",
    related: ["resumen"],
  },
  usuarios: {
    title: "Usuarios",
    intro: "Las personas que trabajan en tu negocio y sus permisos dentro del panel.",
    points: [
      "Cada usuario tiene un rol que define qué puede ver y qué puede modificar.",
      "Un usuario sin permiso no ve las acciones que no puede ejecutar.",
      "Los roles se asignan acá y controlan el acceso a cada sección.",
    ],
    related: ["auditoria"],
  },
  auditoria: {
    title: "Auditoría",
    intro: "Permite revisar quién realizó cambios importantes y cuándo.",
    points: [
      "Cada fila muestra la acción, el usuario, la fecha y el resultado.",
      "Podés abrir los valores anteriores y nuevos de cada cambio.",
      "Solo se registran operaciones sensibles, no cada clic.",
    ],
    related: ["usuarios", "clientes-frecuentes"],
  },
  errores: {
    title: "Errores técnicos",
    intro: "Incidentes reducidos y agrupables para que el equipo técnico pueda revisarlos.",
    points: [
      "No se envían datos personales ni trazas privadas desde el navegador.",
      "Podés marcar un error como resuelto o revisado.",
    ],
    related: ["soporte"],
  },
  archivos: {
    title: "Biblioteca multimedia",
    intro: "Todas las imágenes y archivos que usás en tu página, en un solo lugar.",
    points: [
      "Los archivos se organizan por colección según su uso (productos, eventos, etc.).",
      "Podés reemplazar un archivo y actualizará todas las referencias.",
      "Cada archivo guarda información útil como peso y formato.",
    ],
    related: ["productos", "marca"],
  },
  datos: {
    title: "Importar y exportar",
    intro: "Llevá tus datos de un lado a otro en formatos abiertos.",
    points: [
      "Exportá productos, pedidos, reservas o clientes en CSV.",
      "La importación siempre se valida antes de escribir cualquier dato.",
      "La copia de seguridad completa permite restaurar tu información.",
    ],
    warning: "Restaurar una copia de seguridad reemplaza la información actual.",
    related: ["auditoria"],
  },
  ayuda: {
    title: "Centro de ayuda",
    intro: "Las guías que lees y las que tus clientes consultan, editadas desde acá.",
    points: [
      "Cada artículo tiene una audiencia: pública (la ven los clientes) o administrativa.",
      "Los artículos públicos aparecen en la sección Ayuda de tu página.",
    ],
    related: ["soporte"],
  },
  soporte: {
    title: "Soporte",
    intro: "Consultas que llegan desde el centro de ayuda de tu página.",
    points: [
      "Cada consulta tiene un estado y notas internas.",
      "Podés responder o cerrar el hilo cuando quede resuelto.",
    ],
    related: ["ayuda"],
  },
  cuenta: {
    title: "Mi cuenta",
    intro: "Tu acceso personal al panel: contraseña y sesiones abiertas.",
    points: [
      "Mantené una contraseña robusta y única.",
      "Podés cerrar sesiones abiertas en otros dispositivos.",
    ],
    related: ["usuarios"],
  },
};

/** @summary Devuelve la ayuda configurada para una sección o null si no existe. */
export function getAdminHelp(section: string) {
  return adminHelpContent[section] ?? null;
}
