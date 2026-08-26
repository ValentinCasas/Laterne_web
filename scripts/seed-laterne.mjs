/**
 * @summary Seed DEV reutilizable para el tenant "Laterne" (sucursal "Principal").
 * Limpia SOLO datos operativos de Laterne (conserva usuarios, membresías, roles,
 * permisos, sucursales y configuración) y regenera un dataset ficticio relacionado
 * para probar todos los módulos.
 *
 * Uso: npm run seed:laterne
 * Seguridad: se ABORTA en producción. NO toca otros tenants. Idempotente.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

// ─────────────────────────── GUARD PRODUCCIÓN ───────────────────────────
if (process.env.NODE_ENV === "production") {
  throw new Error("Este seed es SOLO para desarrollo. Se abortó por NODE_ENV=production.");
}
if (process.env.NODE_ENV !== "development") {
  console.log(`[seed] NODE_ENV detectado: ${process.env.NODE_ENV ?? "(no definido)"}`);
}

const prisma = new PrismaClient();

// ─────────────────────────── HELPERS ───────────────────────────
const hex = (n) => randomBytes(Math.ceil(n / 2)).toString("hex").slice(0, n).toUpperCase();
const sha = (s) => createHash("sha256").update(s).digest("hex");
const daysFromNow = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);
const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000);
const timeOnly = (h, m = 0) => {
  const d = new Date(0);
  d.setHours(h, m, 0, 0);
  return d;
};

// ─────────────────────────── RESOLUCIÓN TENANT / SUCURSAL ───────────────────────────
async function resolveScope() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "laterne" } });
  if (!tenant) throw new Error("No se encontró el tenant 'laterne'.");
  if (tenant.id !== 1) {
    throw new Error(`El tenant Laterne tiene id ${tenant.id}; este seed requiere id 1. Abortado.`);
  }
  const branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, slug: "principal", isPrimary: true },
  });
  if (!branch) throw new Error("No se encontró la sucursal 'principal' (isPrimary) de Laterne.");
  return { tenantId: tenant.id, tenant, branch };
}
// ─────────────────────────── CLEANUP (solo datos operativos de Laterne) ───────────────────────────
const TENANT_OPERATIONAL = [
  // delivery / rutas / GPS
  "deliveryroute", "orderdeliverystatuslog", "driverposition", "driverincident",
  "driverbranch", "driverprofile", "orderdeliveryitem", "orderdelivery",
  // pedidos / pagos
  "customerpayment", "orderidempotency", "orderstatushistory", "orderitem", "customerorder",
  // carta / producto / promos
  "printjob", "printareaproduct", "printareacategory", "promotionusage", "promotionproduct",
  "promotioncategory", "productcategory", "productallergen", "productrelation",
  "productcomboitem", "productprice", "productoptiongroup", "productextra", "productvariant",
  "promotion", "testimonial", "event", "category", "product", "branchproduct",
  // inventario / recetas
  "stockmovement", "inventorycountitem", "inventorycountsession", "stocktransfer",
  "ingredientcosthistory", "recipeingredient", "unitconversion", "inventorystock",
  // compras / gastos
  "purchaseinvoicereceipt", "purchasepayment", "purchaseinvoiceitem", "purchaseinvoice",
  "purchasereceiptitem", "purchasereceipt", "purchaseorderitem", "purchaseorder",
  "supplierledgerentry", "supplierbranch", "supplier", "expense", "recurringexpense",
  "documentsequence",
  // finanzas
  "receivableallocation", "receivablepayment", "receivabledocument", "financialtransfer",
  "financialmovement", "financialaccount",
  // facturación interna
  "invoicerecorditem", "invoicerecord", "invoicedocumentartifact",
  // reservas / salón
  "reservationstatushistory", "reservationblock", "reservation",
  "tablesessionevent", "tablesession", "diningtable",
  // fidelidad
  "loyaltybranchlink", "loyaltytransaction", "loyaltyreward", "loyaltycustomer",
  // ruido / logs
  "analyticsevent", "notification", "auditlog", "errorlog", "saleslead",
  // integraciones / sesiones externas
  "externalevent", "externalorder", "conversationmessage", "conversationsession",
];
// Tablas hijas SIN columna tenantId (se limpian por FK hacia el padre de Laterne).
const CHILD_SQL = [
  // conciencia de FK (RESTRICT entre children): borrar primero deliveryitem antes que orderitem
  ["orderdeliveryitem", "deliveryId", "orderdelivery", "tenantId"],
  ["orderitem", "orderId", "customerorder", "tenantId"],
  ["orderstatushistory", "orderId", "customerorder", "tenantId"],
  ["reservationstatushistory", "reservationId", "reservation", "tenantId"],
  ["loyaltytransaction", "customerId", "loyaltycustomer", "tenantId"],
  ["invoicerecorditem", "invoiceId", "invoicerecord", "tenantId"],
  ["purchaseinvoicereceipt", "invoiceId", "purchaseinvoice", "tenantId"],
  ["purchaseinvoiceitem", "invoiceId", "purchaseinvoice", "tenantId"],
  ["purchaseorderitem", "orderId", "purchaseorder", "tenantId"],
  ["purchasereceiptitem", "receiptId", "purchasereceipt", "tenantId"],
  ["productrelation", "productId", "product", "tenantId"],
  ["leadstatushistory", "leadId", "saleslead", "tenantId"],
  ["conversationmessage", "sessionId", "conversationsession", "tenantId"],
];

async function cleanup(tenantId) {
  console.log("\n[cleanup] Limpiando datos operativos de Laterne (tenantId=%s)...", tenantId);
  // Cliente dedicado con connection_limit=1 para que FOREIGN_KEY_CHECKS aplique a TODA la limpieza.
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("connection_limit", "1");
  const cp = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    await cp.$executeRaw`SET FOREIGN_KEY_CHECKS=0`;
    for (const table of TENANT_OPERATIONAL) {
      try {
        await cp.$executeRawUnsafe(`DELETE FROM \`${table}\` WHERE tenantId = ?`, tenantId);
      } catch (e) {
        console.log(`  [skip] ${table}: ${e.message.split("\n")[0]}`);
      }
    }
    for (const [child, fk, parent, parentCol] of CHILD_SQL) {
      try {
        await cp.$executeRawUnsafe(
          `DELETE FROM \`${child}\` WHERE ${fk} IN (SELECT id FROM \`${parent}\` WHERE ${parentCol} = ?)`,
          tenantId
        );
      } catch (e) {
        console.log(`  [skip] ${child}: ${e.message.split("\n")[0]}`);
      }
    }
    await cp.$executeRawUnsafe(
      `DELETE FROM productrelation WHERE productId IN (SELECT id FROM product WHERE tenantId = ?) OR relatedProductId IN (SELECT id FROM product WHERE tenantId = ?)`,
      tenantId, tenantId
    ).catch(() => {});
    await cp.$executeRaw`SET FOREIGN_KEY_CHECKS=1`;
  } finally {
    await cp.$disconnect().catch(() => {});
  }
  console.log("[cleanup] Limpieza finalizada.");
}
// ─────────────────────────── USUARIOS DEV POR ROL REAL ───────────────────────────
// Rol real detectado en DB (tenant id 1): owner, administrator, menu_editor,
// moderator, reservation_manager, order_manager, analyst, viewer, driver.
// NO se inventan roles. Mín. 10 caracteres, al menos 1 mayúscula (validación real).
const DEV_USERS = [
  { email: "propietario1@gmail.com", password: "Propietario1", roleKey: "owner", name: "Propietario DEV" },
  { email: "administrador1@gmail.com", password: "Administrador123", roleKey: "administrator", name: "Admin DEV 1" },
  { email: "carta1@gmail.com", password: "EditorCarta12", roleKey: "menu_editor", name: "Editor Carta DEV" },
  { email: "moderador1@gmail.com", password: "Moderador123", roleKey: "moderator", name: "Moderador DEV" },
  { email: "reservas1@gmail.com", password: "Reservas123", roleKey: "reservation_manager", name: "Reservas DEV" },
  { email: "encargado1@gmail.com", password: "Encargado12", roleKey: "order_manager", name: "Encargado DEV" },
  { email: "analista1@gmail.com", password: "Analista123", roleKey: "analyst", name: "Analista DEV" },
  { email: "lector1@gmail.com", password: "Lectura123", roleKey: "viewer", name: "Lector DEV" },
  { email: "repartidor1@gmail.com", password: "Repartidor1", roleKey: "driver", name: "Repartidor 1" },
  { email: "repartidor2@gmail.com", password: "Repartidor2", roleKey: "driver", name: "Repartidor 2" },
];

async function seedDevUsers(tx, scope, roles) {
  const created = [];
  const reused = [];
  const { tenantId } = scope;

  for (const dev of DEV_USERS) {
    const role = roles.find((r) => r.key === dev.roleKey);
    if (!role) throw new Error(`Rol real no encontrado para key=${dev.roleKey}`);
    let user = await tx.user.findUnique({ where: { email: dev.email } });
    if (!user) {
      user = await tx.user.create({
        data: {
          name: dev.name,
          email: dev.email,
          password: await bcrypt.hash(dev.password, 12),
          role: ["owner", "administrator"].includes(role.key) ? 1 : 0,
          imageUrl: "avatar_profile_default.png",
        },
      });
      created.push({ role: role.key, email: dev.email });
    } else {
      reused.push({ role: role.key, email: dev.email });
    }

    // Membership (única por tenant+user). Si existe, se conserva sin tocar su rol original.
    const membership = await tx.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
    });
    const membershipRow =
      membership ??
      (await tx.tenantMembership.create({
        data: {
          tenantId,
          userId: user.id,
          roleId: role.id,
          status: "active",
          allBranches: ["owner", "administrator"].includes(role.key),
        },
      }));

    // Acceso a sucursal Principal (branchId 1). owner/administrator ven también Laterne Centro (id 2).
    const wantedBranches = ["owner", "administrator"].includes(role.key) ? [scope.branch.id, 2] : [scope.branch.id];
    for (const branchId of wantedBranches) {
      const exists = await tx.branchMembership.findFirst({
        where: { membershipId: membershipRow.id, branchId },
      });
      if (!exists) {
        await tx.branchMembership.create({ data: { membershipId: membershipRow.id, branchId } });
      }
    }
  }

  console.log(`[users] Creados: ${created.length} | Reutilizados (sin tocar password): ${reused.length}`);
  return { created, reused };
}

// ─────────────────────────── PERFILES DE REPARTIDOR ───────────────────────────
async function seedDrivers(tx, scope, roles) {
  const driverRole = roles.find((r) => r.key === "driver");
  const { tenantId } = scope;
  const driverSpecs = [
    { email: "repartidor1@gmail.com", name: "Repartidor 1", phone: "2665010001", vehicle: "Moto", plate: "DEV 001", color: "Negro" },
    { email: "repartidor2@gmail.com", name: "Repartidor 2", phone: "2665010002", vehicle: "Moto", plate: "DEV 002", color: "Rojo" },
  ];
  const profiles = [];
  for (const spec of driverSpecs) {
    const user = await tx.user.findUnique({ where: { email: spec.email } });
    if (!user) throw new Error(`Falta el usuario dev ${spec.email} para crear DriverProfile`);
    let profile = await tx.driverProfile.findFirst({
      where: { tenantId, userId: user.id },
    });
    if (!profile) {
      profile = await tx.driverProfile.create({
        data: {
          tenantId,
          userId: user.id,
          name: spec.name,
          phone: spec.phone,
          status: "AVAILABLE",
          active: true,
          locationSharingEnabled: true,
          vehicleType: spec.vehicle,
          plate: spec.plate,
          color: spec.color,
        },
      });
    }
    // Vínculo a la sucursal Principal (relación N:M)
    const link = await tx.driverBranch.findUnique({
      where: { tenantId_driverId_branchId: { tenantId, driverId: profile.id, branchId: scope.branch.id } },
    });
    if (!link) {
      await tx.driverBranch.create({
        data: { tenantId, driverId: profile.id, branchId: scope.branch.id },
      });
    }
    profiles.push({ profile, user });
  }
  console.log(`[drivers] ${profiles.length} perfil(es) de repartidor listos en Principal.`);
  return profiles;
}
// ─────────────────────────── CATÁLOGO: CATEGORÍAS Y PRODUCTOS ───────────────────────────
const IMG = {
  webp1: "1e569970-9268-11ee-aefa-3529348b1b8e.webp",
  webp2: "10698930-9268-11ee-aefa-3529348b1b8e.webp",
  webp3: "fc75a800-9267-11ee-aefa-3529348b1b8e.webp",
  defaultImage: "product_default.png",
};

const CATEGORIES = [
  { name: "Pizzas", slug: "pizzas", description: "Pizzas artesanales de piedra", imageUrl: IMG.webp1 },
  { name: "Hamburguesas", slug: "hamburguesas", description: "Hamburguesas de carne", imageUrl: IMG.webp2 },
  { name: "Bebidas", slug: "bebidas", description: "Bebidas sin alcohol", imageUrl: IMG.defaultImage },
  { name: "Cervezas", slug: "cervezas", description: "Cervezas artesanales", imageUrl: IMG.webp3 },
  { name: "Entradas", slug: "entradas", description: "Para compartir", imageUrl: IMG.defaultImage },
  { name: "Postres", slug: "postres", description: "Dulces para cerrar", imageUrl: IMG.defaultImage },
];

const MENU_PRODUCTS = [
  { name: "Pizza Muzza", slug: "pizza-muzza", cat: "pizzas", price: 8200, desc: "Mozzarella, salsa de tomate y orégano.", featured: true },
  { name: "Pizza Especial", slug: "pizza-especial", cat: "pizzas", price: 10800, desc: "Jamón, morrones y aceitunas.", featured: true },
  { name: "Pizza Napolitana", slug: "pizza-napolitana", cat: "pizzas", price: 9600, desc: "Tomate natural, ajo y albahaca." },
  { name: "Hamburguesa Clásica", slug: "hamburguesa-clasica", cat: "hamburguesas", price: 7400, desc: "Carne, cheddar, lechuga y tomate.", recommended: true },
  { name: "Hamburguesa Doble", slug: "hamburguesa-doble", cat: "hamburguesas", price: 9800, desc: "Doble carne, doble cheddar." },
  { name: "Hamburguesa Bacon", slug: "hamburguesa-bacon", cat: "hamburguesas", price: 10400, desc: "Carne, bacon crocante y cheddar." },
  { name: "Coca Cola", slug: "coca-cola", cat: "bebidas", price: 2600, desc: "Lata 473 ml bien fría." },
  { name: "Agua mineral", slug: "agua-mineral", cat: "bebidas", price: 1800, desc: "Botella 500 ml." },
  { name: "Sprite", slug: "sprite", cat: "bebidas", price: 2600, desc: "Lata 473 ml." },
  { name: "Cerveza IPA", slug: "cerveza-ipa", cat: "cervezas", price: 3200, desc: "Amarga, 6.5% ABV." },
  { name: "Cerveza Golden", slug: "cerveza-golden", cat: "cervezas", price: 3000, desc: "Suave, 4.8% ABV." },
  { name: "Cerveza Honey", slug: "cerveza-honey", cat: "cervezas", price: 3100, desc: "Notas a miel, 5.2% ABV." },
  { name: "Papas fritas", slug: "papas-fritas", cat: "entradas", price: 4200, desc: "Porción grande con cheddar.", vegetarian: true },
  { name: "Empanadas", slug: "empanadas", cat: "entradas", price: 1900, desc: "Unidad de carne cortada a cuchillo." },
  { name: "Brownie", slug: "brownie", cat: "postres", price: 3500, desc: "Con helado de crema.", vegetarian: true },
];

const INGREDIENTS = [
  { name: "Harina", slug: "insumo-harina", unit: "kg", cost: 620, desc: "Harina 0000" },
  { name: "Mozzarella", slug: "insumo-mozzarella", unit: "kg", cost: 5800, desc: "Queso muzzarella" },
  { name: "Salsa de tomate", slug: "insumo-salsa-tomate", unit: "l", cost: 1400, desc: "Salsa de tomate" },
  { name: "Jamón", slug: "insumo-jamon", unit: "kg", cost: 7200, desc: "Jamón cocido" },
  { name: "Bacon", slug: "insumo-bacon", unit: "kg", cost: 9800, desc: "Panceta ahumada" },
  { name: "Carne picada", slug: "insumo-carne", unit: "kg", cost: 8600, desc: "Carne picada especial" },
  { name: "Pan de hamburguesa", slug: "insumo-pan", unit: "unidad", cost: 380, desc: "Pan brioche" },
  { name: "Papas", slug: "insumo-papas", unit: "kg", cost: 1900, desc: "Papas congeladas" },
  { name: "Cheddar", slug: "insumo-cheddar", unit: "kg", cost: 9400, desc: "Queso cheddar en barra" },
];

async function seedCatalog(tx, scope) {
  const { tenantId } = scope;
  const catMap = {};
  for (const c of CATEGORIES) {
    const created = await tx.category.create({
      data: { tenantId, branchId: scope.branch.id, name: c.name, slug: c.slug, description: c.description, imageUrl: c.imageUrl, status: "published", sortOrder: CATEGORIES.indexOf(c) },
    });
    catMap[c.slug] = created;
  }
  console.log(`[catalog] ${CATEGORIES.length} categorías creadas.`);

  const menuProducts = {};
  for (const p of MENU_PRODUCTS) {
    const prod = await tx.product.create({
      data: {
        tenantId, name: p.name, slug: p.slug, description: p.desc,
        availability: "disponible", price: p.price, imageUrl: IMG.webp1,
        status: "published", featured: p.featured ?? false, recommended: p.recommended ?? false,
        vegetarian: p.vegetarian ?? false, preparationMinutes: p.cat === "pizzas" ? 20 : 12,
      },
    });
    await tx.productCategory.create({ data: { tenantId, productId: prod.id, categoryId: catMap[p.cat].id } });
    await tx.branchProduct.create({ data: { tenantId, branchId: scope.branch.id, productId: prod.id, active: true, sortOrder: MENU_PRODUCTS.indexOf(p) } });
    menuProducts[p.slug] = prod;
  }
  console.log(`[catalog] ${MENU_PRODUCTS.length} productos de carta + asignación a Principal.`);
  return { catMap, menuProducts };
}
// Variantes, extras y recetas
async function seedVariantsAndRecipes(tx, scope, menuProducts) {
  const { tenantId } = scope;
  const muzza = menuProducts["pizza-muzza"];
  const esp = menuProducts["pizza-especial"];
  const clasica = menuProducts["hamburguesa-clasica"];

  for (const pizza of [muzza, esp]) {
    const group = await tx.productOptionGroup.create({
      data: { tenantId, productId: pizza.id, kind: "variant", name: "Tamaño", required: true, minSelections: 1, maxSelections: 1, sortOrder: 0 },
    });
    for (const [i, v] of [["Individual", 0], ["Mediana", 3000], ["Grande", 5500]].entries()) {
      await tx.productVariant.create({ data: { tenantId, productId: pizza.id, groupId: group.id, name: v[0], priceAdjustment: v[1], sortOrder: i } });
    }
    const extrasGroup = await tx.productOptionGroup.create({
      data: { tenantId, productId: pizza.id, kind: "extra", name: "Agregados", required: false, maxSelections: 3, sortOrder: 1 },
    });
    for (const [i, e] of [["Extra queso", 1200], ["Jamón", 1000], ["Bacon", 1200]].entries()) {
      await tx.productExtra.create({ data: { tenantId, productId: pizza.id, groupId: extrasGroup.id, name: e[0], price: e[1], sortOrder: i } });
    }
  }
  const burgerGroup = await tx.productOptionGroup.create({
    data: { tenantId, productId: clasica.id, kind: "extra", name: "Sumá a tu burger", required: false, maxSelections: 3, sortOrder: 0 },
  });
  for (const [i, e] of [["Extra cheddar", 900], ["Huevo", 700], ["Bacon", 1000]].entries()) {
    await tx.productExtra.create({ data: { tenantId, productId: clasica.id, groupId: burgerGroup.id, name: e[0], price: e[1], sortOrder: i } });
  }

  const ingMap = {};
  for (const ing of INGREDIENTS) {
    const prod = await tx.product.create({
      data: {
        tenantId, name: ing.name, slug: ing.slug, description: ing.desc,
        availability: "disponible", price: Math.round(ing.cost * 1.5), imageUrl: IMG.defaultImage,
        status: "published", cost: ing.cost, costUnit: ing.unit,
      },
    });
    ingMap[ing.slug] = prod;
  }
  console.log(`[catalog] ${INGREDIENTS.length} ingredientes creados.`);

  const recipeDefs = [
    { product: muzza, items: [["insumo-harina", 0.25, "kg"], ["insumo-salsa-tomate", 0.12, "l"], ["insumo-mozzarella", 0.18, "kg"]] },
    { product: clasica, items: [["insumo-pan", 1, "unidad"], ["insumo-carne", 0.15, "kg"], ["insumo-cheddar", 0.02, "kg"]] },
  ];
  for (const r of recipeDefs) {
    for (const [ingSlug, qty, unit] of r.items) {
      await tx.recipeIngredient.create({
        data: { tenantId, productId: r.product.id, ingredientProductId: ingMap[ingSlug].id, quantity: qty, unit, sortOrder: 0 },
      });
    }
  }
  await tx.unitConversion.create({ data: { tenantId, fromUnit: "bolsa", toUnit: "kg", factor: 25 } }).catch(() => {});
  console.log("[catalog] Recetas y conversión de unidades creadas.");
  return ingMap;
}

// Inventario inicial en Principal
async function seedInventory(tx, scope, menuProducts, ingMap) {
  const { tenantId } = scope;
  const STOCK = [
    ["insumo-harina", 25, 5, "kg"], // alto
    ["insumo-mozzarella", 18, 5, "kg"],
    ["insumo-salsa-tomate", 12, 4, "l"],
    ["insumo-jamon", 6, 3, "kg"], // normal
    ["insumo-bacon", 3, 3, "kg"], // bajo (alerta)
    ["insumo-carne", 30, 8, "kg"], // alto
    ["insumo-pan", 80, 20, "unidad"],
    ["insumo-papas", 22, 6, "kg"],
    ["insumo-cheddar", 4.5, 4, "kg"], // bajo
    ["coca-cola", 48, 12, "unidad"],
    ["sprite", 24, 12, "unidad"],
    ["cerveza-ipa", 36, 12, "unidad"],
  ];
  for (const [slug, current, minimum, unit] of STOCK) {
    const prod = menuProducts[slug] ?? ingMap[slug];
    if (!prod) throw new Error(`Stock: producto inexistente ${slug}`);
    const stock = await tx.inventoryStock.create({
      data: { tenantId, branchId: scope.branch.id, productId: prod.id, tracked: true, current, minimum, unit },
    });
    await tx.stockMovement.create({
      data: { tenantId, stockId: stock.id, type: "purchase_receipt", quantity: current, balanceAfter: current, reason: "Stock inicial DEV", reference: "SEED-DEV" },
    });
    await tx.ingredientCostHistory.create({
      data: { tenantId, productId: prod.id, cost: prod.cost ?? prod.price, unit, reason: "Costo inicial DEV" },
    }).catch(() => {});
  }
  console.log(`[inventory] ${STOCK.length} productos con stock inicial en Principal.`);
}
// ─────────────────────────── PROVEEDORES, GASTOS Y COMPRAS ───────────────────────────
const SUPPLIERS = [
  { code: "PROV-001", name: "Distribuidora Central", taxId: "30-71111111-9", contact: "Laura Gómez", phone: "2664001111", email: "ventas@distcentral.com.ar", address: "Av. Illia 800, San Luis", terms: "30 días", category: "General", creditLimit: 500000 },
  { code: "PROV-002", name: "Bebidas San Luis", taxId: "30-72222222-0", contact: "Marcos Pereyra", phone: "2664002222", email: "pedidos@bebidassl.com.ar", address: "Ruta 7 km 5, San Luis", terms: "Contado", category: "Bebidas", creditLimit: 300000 },
  { code: "PROV-003", name: "Carnes del Centro", taxId: "30-73333333-1", contact: "Ana Suárez", phone: "2664003333", email: "carnes@delcentro.com.ar", address: "Av. de los Incas 1200, San Luis", terms: "7 días", category: "Carnes", creditLimit: 400000 },
  { code: "PROV-004", name: "Lácteos del Valle", taxId: "30-74444444-2", contact: "Pedro Lucero", phone: "2664004444", email: "contacto@lacteosdelvalle.com.ar", address: "Ruta 20 km 12, La Punta", terms: "15 días", category: "Lácteos/Congelados", creditLimit: 250000 },
];

async function seedSuppliers(tx, scope) {
  const { tenantId } = scope;
  const supplierMap = {};
  for (const s of SUPPLIERS) {
    const sup = await tx.supplier.create({
      data: {
        tenantId, code: s.code, name: s.name, taxId: s.taxId, contactName: s.contact, phone: s.phone,
        email: s.email, address: s.address, paymentTerms: s.terms, currency: "ARS", status: "active",
        category: s.category, creditLimit: s.creditLimit,
      },
    });
    await tx.supplierBranch.create({ data: { tenantId, supplierId: sup.id, branchId: scope.branch.id } });
    supplierMap[s.name] = sup;
  }
  console.log(`[suppliers] ${SUPPLIERS.length} proveedores + vínculo a Principal.`);
  return supplierMap;
}

// Categorías de gasto (defaults por negocio)
async function seedExpenseCategories(tx, scope) {
  const { tenantId } = scope;
  const defs = [
    { group: "Insumos", name: "Insumos y mercadería" },
    { group: "Servicios", name: "Luz" },
    { group: "Servicios", name: "Gas" },
    { group: "Servicios", name: "Internet" },
    { group: "Operación", name: "Mantenimiento" },
    { group: "Marketing", name: "Publicidad" },
    { group: "Administración", name: "Honorarios" },
  ];
  const catMap = {};
  for (const c of defs) {
    let cat = await tx.expenseCategory.findFirst({ where: { tenantId, name: c.name } });
    if (!cat) {
      cat = await tx.expenseCategory.create({ data: { tenantId, group: c.group, name: c.name, active: true, sortOrder: defs.indexOf(c) } });
    }
    catMap[c.name] = cat;
  }
  console.log(`[expenses] ${defs.length} categorías de gasto aseguradas.`);
  return catMap;
}

async function seedExpenses(tx, scope, catMap, supplierMap) {
  const { tenantId } = scope;
  const defs = [
    { name: "Luz", number: "GA-0001", amount: 45800, cat: "Luz", dateOffset: -12, paid: true },
    { name: "Gas", number: "GA-0002", amount: 12400, cat: "Gas", dateOffset: -10, paid: true },
    { name: "Internet", number: "GA-0003", amount: 21500, cat: "Internet", dateOffset: -8, paid: false },
    { name: "Mantenimiento", number: "GA-0004", amount: 78000, cat: "Mantenimiento", dateOffset: -5, paid: false },
    { name: "Insumos de limpieza", number: "GA-0005", amount: 32600, cat: "Insumos y mercadería", dateOffset: -3, paid: true },
    { name: "Publicidad en redes", number: "GA-0006", amount: 60000, cat: "Publicidad", dateOffset: -1, paid: false },
  ];
  for (const d of defs) {
    await tx.expense.create({
      data: {
        tenantId, branchId: scope.branch.id, categoryId: catMap[d.cat].id, number: d.number,
        status: "issued", expenseDate: daysFromNow(d.dateOffset), amountNet: d.amount, total: d.amount,
        paidAmount: d.paid ? d.amount : 0, financialCategory: catMap[d.cat].group, notes: `Gasto DEV ${d.name}`,
      },
    });
  }
  console.log(`[expenses] ${defs.length} gastos creados.`);
}
// Compras: pedidos + recepciones + facturas + pagos
async function seedPurchases(tx, scope, menuProducts, ingMap) {
  const { tenantId } = scope;
  const sup = (name) => SUPPLIERS.find((s) => s.name === name);
  const supplierId = async (name) => (await tx.supplier.findFirst({ where: { tenantId, name } })).id;
  const stockId = async (productId) =>
    (await tx.inventoryStock.findUnique({ where: { branchId_productId: { branchId: scope.branch.id, productId } } })).id;

  const PO = {
    // 1) Borrador
    "OC-0001": { supplier: "Distribuidora Central", status: "draft", dateOffset: -3, expected: +2,
      lines: [["coca-cola", 50, 2600], ["insumo-harina", 25, 620]] },
    // 2) Enviado
    "OC-0002": { supplier: "Carnes del Centro", status: "sent", dateOffset: -2, expected: 0,
      lines: [["insumo-carne", 30, 8600], ["insumo-pan", 50, 380]] },
    // 3) Recibido parcial (recibo 60/25 del pedido)
    "OC-0003": { supplier: "Bebidas San Luis", status: "partially_received", dateOffset: -1, expected: -1,
      lines: [["coca-cola", 100, 2600], ["cerveza-ipa", 50, 3200]], received: { "coca-cola": 60, "cerveza-ipa": 25 } },
    // 4) Recibido completo + facturado + pagado
    "OC-0004": { supplier: "Lácteos del Valle", status: "received", dateOffset: -2, expected: -2,
      lines: [["insumo-harina", 25, 620], ["insumo-mozzarella", 20, 5800], ["insumo-carne", 40, 8600]], received: "full" },
  };

  for (const [number, def] of Object.entries(PO)) {
    const supId = await supplierId(def.supplier);
    const order = await tx.purchaseOrder.create({
      data: {
        tenantId, branchId: scope.branch.id, supplierId: supId, number, status: def.status,
        orderDate: daysFromNow(def.dateOffset), postingDate: daysFromNow(def.dateOffset),
        expectedDate: def.expected !== null && def.expected !== undefined ? daysFromNow(def.expected) : undefined,
        notes: `Pedido DEV ${number}`,
      },
    });
    for (const [slug, qty, cost] of def.lines) {
      const prod = menuProducts[slug] ?? ingMap[slug];
      if (!prod) throw new Error(`PO ${number}: producto inexistente ${slug}`);
      const receivedQty = def.received === "full" ? qty : (def.received?.[slug] ?? 0);
      await tx.purchaseOrderItem.create({
        data: {
          orderId: order.id, productId: prod.id, quantity: qty, unit: prod.costUnit ?? "unidad",
          unitCost: cost, receivedQuantity: receivedQty, invoicedQuantity: 0, sortOrder: 0,
        },
      });
    }

    // Recepciones
    const doReceive = async (number, quantities, notes) => {
      const receipt = await tx.purchaseReceipt.create({
        data: { tenantId, branchId: scope.branch.id, supplierId: supId, orderId: order.id, number, receivedAt: daysFromNow(def.dateOffset + 1), notes },
      });
      for (const [slug, qty, cost] of def.lines) {
        const prod = menuProducts[slug] ?? ingMap[slug];
        const recQty = quantities === "full" ? qty : (quantities[slug] ?? 0);
        if (recQty <= 0) continue;
        await tx.purchaseReceiptItem.create({
          data: { receiptId: receipt.id, productId: prod.id, quantity: recQty, unit: prod.costUnit ?? "unidad", unitCost: cost, sortOrder: 0 },
        });
        // Movimiento de stock (ingreso por recepción)
        await tx.stockMovement.create({
          data: { tenantId, stockId: await stockId(prod.id), type: "purchase_receipt", quantity: recQty, balanceAfter: recQty, reference: number, reason: `Recepción ${number}` },
        });
      }
      return receipt;
    };

    if (def.received === "full") {
      const receipt = await doReceive("RC-0002", "full", "Recepción completa DEV");
      // Factura de compra + pago
      const total = def.lines.reduce((acc, [, qty, cost]) => acc + qty * cost, 0);
      const invoice = await tx.purchaseInvoice.create({
        data: { tenantId, branchId: scope.branch.id, supplierId: supId, orderId: order.id, number: "GC-0001", status: "issued", documentDate: daysFromNow(def.dateOffset), subtotal: total, total, paidAmount: total, notes: "Factura DEV no fiscal" },
      });
      await tx.purchasePayment.create({
        data: { tenantId, invoiceId: invoice.id, number: "PC-0001", amount: total, method: "transferencia", paidAt: daysFromNow(def.dateOffset + 1), notes: "Pago DEV" },
      });
      for (const [slug, qty, cost] of def.lines) {
        const prod = menuProducts[slug] ?? ingMap[slug];
        await tx.purchaseInvoiceItem.create({ data: { invoiceId: invoice.id, productId: prod.id, description: prod.name, quantity: qty, unit: prod.costUnit ?? "unidad", unitCost: cost } });
      }
      await tx.purchaseInvoiceReceipt.create({ data: { invoiceId: invoice.id, receiptId: receipt.id } });
      await tx.supplierLedgerEntry.create({
        data: { tenantId, supplierId: supId, branchId: scope.branch.id, type: "purchase_invoice", referenceType: "purchase-invoice", referenceId: invoice.id, documentNumber: "GC-0001", originalAmount: total, appliedAmount: total, remainingAmount: 0, status: "paid", notes: "Ledger DEV" },
      });
    } else if (def.received) {
      await doReceive("RC-0001", def.received, "Recepción parcial DEV");
    }
  }
  console.log("[purchases] 4 pedidos de compra (draft, enviado, parcial, recibido), recepciones, factura y pago DEV creados.");
}
// ─────────────────────────── CLIENTES + PROGRAMA DE FIDELIDAD ───────────────────────────
const CUSTOMERS = [
  { name: "Juan Pérez", email: "juan.perez@gmail.com", phone: "2665011001", address: "Av. Lafinur 450, San Luis", points: 40 },
  { name: "Sofía Gómez", email: "sofia.gomez@gmail.com", phone: "2665011002", address: "San Martín 890, San Luis", points: 90 },
  { name: "Carlos Martínez", email: "carlos.martinez@gmail.com", phone: "2665011003", address: "Junín 234, San Luis", points: 120 },
  { name: "Lucía Fernández", email: "lucia.fernandez@gmail.com", phone: "2665011004", address: "Rivadavia 567, San Luis", points: 15 },
  { name: "Martín López", email: "martin.lopez@gmail.com", phone: "2665011005", address: "La Punta, Manzana 11 Casa 12", points: 60 },
  { name: "Paula Rodríguez", email: "paula.rodriguez@gmail.com", phone: "2665011006", address: "Illia 123, San Luis", points: 30 },
  { name: "Federico Díaz", email: "federico.diaz@gmail.com", phone: "2665011007", address: "Belgrano 876, San Luis", points: 75 },
  { name: "Camila Torres", email: "camila.torres@gmail.com", phone: "2665011008", address: "Colón 654, San Luis", points: 45 },
  { name: "Ignacio Herrera", email: "ignacio.herrera@gmail.com", phone: "2665011009", address: "Ejército de los Andes 321, San Luis", points: 5 },
  { name: "Valentina Acosta", email: "valentina.acosta@gmail.com", phone: "2665011010", address: "Ruta 20 km 8, La Punta", points: 100 },
];

async function seedCustomersAndLoyalty(tx, scope) {
  const { tenantId } = scope;
  const rewards = [
    { name: "10% de descuento", pointsNeeded: 100, benefitType: "discount", value: "10", description: "Descontá un 10% en tu próximo pedido." },
    { name: "Bebida gratis", pointsNeeded: 150, benefitType: "product", value: "Bebida de línea", description: "Canjeá una bebida de línea." },
    { name: "Pizza Muzza gratis", pointsNeeded: 250, benefitType: "product", value: "Pizza Muzza", description: "Canjeá una pizza Muzza individual." },
  ];
  for (const r of rewards) {
    await tx.loyaltyReward.create({ data: { tenantId, name: r.name, pointsNeeded: r.pointsNeeded, benefitType: r.benefitType, value: r.value, description: r.description, active: true, sortOrder: rewards.indexOf(r) } });
  }

  const customerMap = {};
  for (const c of CUSTOMERS) {
    const cust = await tx.loyaltyCustomer.create({
      data: {
        tenantId, publicTokenHash: sha(`customer-${c.email}`), name: c.name, email: c.email, phone: c.phone,
        address: c.address, points: c.points, tier: c.points >= 100 ? "premium" : c.points >= 50 ? "frecuente" : "inicial",
        consentAt: daysFromNow(-30), currentBalance: 0, currency: "ARS",
      },
    });
    await tx.loyaltyBranchLink.create({ data: { tenantId, branchId: scope.branch.id, customerId: cust.id, lastActivityAt: hoursAgo(48) } });
    // Historial de puntos consistente con customer.points
    await tx.loyaltyTransaction.create({
      data: { customerId: cust.id, points: c.points, reason: "Ajuste inicial DEV (pedidos previos)", reference: "SEED-DEV" },
    });
    customerMap[c.name] = cust;
  }
  console.log(`[customers] ${CUSTOMERS.length} clientes + ${rewards.length} recompensas de fidelidad.`);
  return customerMap;
}
// ─────────────────────────── SALÓN: MESAS Y SESIONES ───────────────────────────
async function seedTables(tx, scope, waiterUserId) {
  const { tenantId } = scope;
  let sector = await tx.tableSector.findFirst({ where: { tenantId, branchId: scope.branch.id, active: true }, orderBy: { id: "asc" } });
  if (!sector) {
    sector = await tx.tableSector.create({ data: { tenantId, branchId: scope.branch.id, name: "Salón", active: true, sortOrder: 0 } });
  }
  const tables = [];
  for (let i = 1; i <= 10; i++) {
    const t = await tx.diningTable.create({
      data: { tenantId, branchId: scope.branch.id, code: `M-${String(i).padStart(2, "0")}`, name: `Mesa ${i}`, sector: sector.name, sectorId: sector.id, capacity: i % 3 === 0 ? 6 : 4, active: true, positionX: (i - 1) * 12, positionY: (i % 5) * 12 },
    });
    tables.push(t);
  }
  console.log(`[tables] 10 mesas creadas en sector "${sector.name}".`);

  // Sesiones abiertas para mesas 1-4 (ocupada / esperando pedido / lista para cobrar)
  const sessionSpecs = [
    { table: tables[0], status: "occupied", customerName: "Mesa libre test", partySize: 2 },
    { table: tables[1], status: "occupied", customerName: "Comensales DEV", partySize: 4 },
    { table: tables[2], status: "waiting_order", customerName: "Familia Pérez", partySize: 5 },
    { table: tables[3], status: "ready_to_bill", customerName: "Pareja DEV", partySize: 2 },
  ];
  for (const s of sessionSpecs) {
    const session = await tx.tableSession.create({
      data: {
        tenantId, branchId: scope.branch.id, tableId: s.table.id, status: s.status,
        customerName: s.customerName, partySize: s.partySize, openedAt: hoursAgo(2),
        waiterUserId: waiterUserId ?? undefined, notes: s.status === "ready_to_bill" ? "Cliente pidió la cuenta" : undefined,
      },
    });
    await tx.tableSessionEvent.create({
      data: { tenantId, branchId: scope.branch.id, sessionId: session.id, eventType: "opened", note: "Apertura de mesa DEV", userId: waiterUserId ?? undefined, createdAt: hoursAgo(2) },
    });
  }
  console.log("[tables] 4 sesiones abiertas (ocupada / esperando pedido / lista para cobrar).");
  return tables;
}
// ─────────────────────────── PEDIDOS, DELIVERY, RUTAS Y GPS ───────────────────────────
const COORDS = [
  ["-33.1802", "-66.3120"], ["-33.1769", "-66.3071"], ["-33.1835", "-66.3180"],
  ["-33.1785", "-66.3234"], ["-33.1857", "-66.3017"], ["-33.1725", "-66.3255"],
  ["-33.1901", "-66.3002"], ["-33.1820", "-66.3155"], ["-33.1750", "-66.3098"],
  ["-33.1866", "-66.3261"], ["-33.1793", "-66.2990"],
];

// Estado por pedido. type: delivery | dine_in | takeaway. delivery.status solo para delivery.
const ORDERS = [
  { type: "delivery", status: "ready", customer: "Juan Pérez", hoursAgo: 0.3, deliveryFee: 1500, method: "transfer", items: [["pizza-muzza", 1], ["coca-cola", 2]], dlv: { status: "ON_THE_WAY", driver: 0, coords: 0, route: "ACTIVE", stop: 1 } },
  { type: "delivery", status: "ready", customer: "Sofía Gómez", hoursAgo: 1, deliveryFee: 1500, method: "transfer", items: [["hamburguesa-bacon", 1], ["cerveza-golden", 2]], dlv: { status: "PICKED_UP", driver: 0, coords: 1, route: "ACTIVE", stop: 2 } },
  { type: "delivery", status: "confirmed", customer: "Carlos Martínez", hoursAgo: 2, deliveryFee: 2000, method: "transfer", items: [["pizza-especial", 1], ["cerveza-ipa", 2]], dlv: { status: "ASSIGNED", driver: 0, coords: 2, route: "ACTIVE", stop: 3 } },
  { type: "delivery", status: "received", customer: "Lucía Fernández", hoursAgo: 0.5, deliveryFee: 1500, method: "on_delivery", items: [["pizza-napolitana", 1]], dlv: { status: "PENDING_ASSIGNMENT", coords: 3 } },
  { type: "delivery", status: "delivered", customer: "Martín López", hoursAgo: 20, deliveryFee: 1500, method: "efectivo", items: [["hamburguesa-clasica", 1], ["papas-fritas", 1]], dlv: { status: "DELIVERED", driver: 1, coords: 4, route: "ROUTE_B", stop: 1, hoursDone: 19 } },
  { type: "delivery", status: "delivered", customer: "Paula Rodríguez", hoursAgo: 20, deliveryFee: 1500, method: "transfer", items: [["cerveza-ipa", 3]], dlv: { status: "DELIVERED", driver: 1, coords: 5, route: "ROUTE_B", stop: 2, hoursDone: 19 } },
  { type: "delivery", status: "delivered", customer: "Federico Díaz", hoursAgo: 20, deliveryFee: 2000, method: "efectivo", items: [["pizza-muzza", 2]], dlv: { status: "DELIVERED", driver: 1, coords: 6, route: "ROUTE_B", stop: 3, hoursDone: 18.5 } },
  { type: "delivery", status: "delivered", customer: "Camila Torres", hoursAgo: 44, deliveryFee: 1500, method: "transfer", items: [["hamburguesa-doble", 1], ["coca-cola", 1]], dlv: { status: "DELIVERED", driver: 0, coords: 7, route: "ROUTE_C", stop: 1, hoursDone: 43 } },
  { type: "delivery", status: "delivered", customer: "Ignacio Herrera", hoursAgo: 44, deliveryFee: 1500, method: "efectivo", items: [["empanadas", 6], ["sprite", 1]], dlv: { status: "DELIVERED", driver: 0, coords: 8, route: "ROUTE_C", stop: 2, hoursDone: 43 } },
  { type: "delivery", status: "delivered", customer: "Valentina Acosta", hoursAgo: 44, deliveryFee: 2000, method: "transfer", items: [["brownie", 2], ["cerveza-honey", 2]], dlv: { status: "DELIVERED", driver: 0, coords: 9, route: "ROUTE_C", stop: 3, hoursDone: 42.5 } },
  { type: "delivery", status: "delivered", customer: "Juan Pérez", hoursAgo: 70, deliveryFee: 1500, method: "efectivo", items: [["hamburguesa-bacon", 2]], dlv: { status: "DELIVERED", driver: 1, coords: 10, route: null } },
  { type: "delivery", status: "cancelled", customer: "Sofía Gómez", hoursAgo: 30, deliveryFee: 1500, method: "on_delivery", items: [["pizza-especial", 1]], dlv: { status: "CANCELLED", driver: null, coords: 1 } },
  { type: "dine_in", status: "preparing", customer: "Comensales", tableIdx: 1, hoursAgo: 1, method: "efectivo", items: [["pizza-muzza", 1], ["pizza-especial", 1], ["coca-cola", 3]] },
  { type: "dine_in", status: "ready", customer: "Familia Pérez", tableIdx: 2, hoursAgo: 3, method: "efectivo", items: [["papas-fritas", 1], ["hamburguesa-doble", 2]] },
  { type: "takeaway", status: "confirmed", customer: "Martín López", hoursAgo: 2, method: "transfer", items: [["pizza-muzza", 1], ["agua-mineral", 1]] },
  { type: "takeaway", status: "completed", customer: "Camila Torres", hoursAgo: 26, method: "efectivo", items: [["empanadas", 3], ["coca-cola", 1]] },
];
async function seedOrders(tx, scope, ctx) {
  const { tenantId, branch } = scope;
  const { menuProducts, customerMap, tables, drivers } = ctx;
  const createdAtForOrder = [];

  const custIdOf = (name) => {
    const c = customerMap[name];
    return c ? c.id : null;
  };

  for (let idx = 0; idx < ORDERS.length; idx++) {
    const o = ORDERS[idx];
    const reference = `PED-${hex(6)}`;
    let subtotal = 0;
    const orderItems = o.items.map(([slug, qty]) => {
      const p = menuProducts[slug];
      if (!p) throw new Error(`Pedido: producto inexistente ${slug}`);
      const line = Number(p.price) * qty;
      subtotal += line;
      return { slug, qty, p, lineTotal: line };
    });
    const fee = o.type === "delivery" ? (o.deliveryFee ?? 1500) : 0;
    const total = subtotal + fee;
    const channel = o.type === "delivery" ? "DELIVERY" : o.type === "dine_in" ? "SALON" : "MOSTRADOR";
    const source = o.type === "dine_in" ? "TABLE_QR" : "MENUCLICK_WEB";
    const table = o.type === "dine_in" && o.tableIdx !== undefined ? tables[o.tableIdx] : null;
    const created = hoursAgo(o.hoursAgo);

    const order = await tx.customerOrder.create({
      data: {
        tenantId, branchId: branch.id, tableId: table?.id ?? null,
        reference, publicTokenHash: sha(`order-${reference}`), status: o.status, orderType: o.type,
        channel, source, customerName: o.customer, phone: "2663999000",
        deliveryAddress: o.type === "delivery" ? "Domicilio DEV, San Luis" : null,
        requestedAt: created, subtotal, discount: 0, deliveryFee: fee, total,
        currency: "ARS", paymentMethod: o.method,
        paymentStatus: ["delivered", "completed"].includes(o.status) ? "paid" : "pending",
        createdAt: created, updatedAt: created,
      },
    });
    for (const it of orderItems) {
      const oi = await tx.orderItem.create({
        data: { orderId: order.id, productId: it.p.id, productName: it.p.name, quantity: it.qty, unitPrice: Number(it.p.price), lineTotal: it.lineTotal },
      });
      it._orderItemId = oi.id;
    }
    await tx.orderStatusHistory.create({
      data: { orderId: order.id, toStatus: o.status, note: o.status === "received" ? "Pedido creado (DEV)" : undefined, createdAt: created },
    });
    if (["delivered", "completed"].includes(o.status)) {
      await tx.customerPayment.create({
        data: { tenantId, orderId: order.id, customerId: custIdOf(o.customer), number: `PAG-${String(idx).padStart(2, "0")}`, amount: total, method: o.method, paidAt: hoursAgo(o.hoursAgo - 0.5), notes: "Pago DEV" },
      });
    }
    createdAtForOrder.push({ order, o, items: orderItems, total, created });
  }
  console.log(`[orders] ${ORDERS.length} pedidos creados.`);
  return createdAtForOrder;
}
async function seedDeliveries(tx, scope, ctx, createdOrders) {
  const { tenantId, branch } = scope;
  const { customerMap, drivers } = ctx;
  const custIdOf = (name) => customerMap[name]?.id ?? null;
  const deliveryRows = [];

  for (const rec of createdOrders) {
    const { o, order, items } = rec;
    if (o.type !== "delivery" || !o.dlv) continue;
    const dlv = o.dlv;
    const driver = dlv.driver !== null && dlv.driver !== undefined ? drivers[dlv.driver] : null;
    const coord = COORDS[dlv.coords] ?? ["-33.1827322", "-66.3091023"];
    const created = hoursAgo(o.hoursAgo);
    const deliveredAt = o.status === "delivered" ? hoursAgo(dlv.hoursDone ?? o.hoursAgo) : null;
    const delivery = await tx.orderDelivery.create({
      data: {
        tenantId, orderId: order.id, number: `ENT-${hex(6)}`, deliveryDate: created, branchId: branch.id,
        customerId: custIdOf(o.customer), customerName: o.customer,
        deliveryAddress: "Domicilio DEV, San Luis", deliveryType: "full", status: dlv.status,
        provider: "MENUCLICK", driverId: driver?.user.id ?? null, driverProfileId: driver?.profile.id ?? null,
        assignedAt: dlv.status === "PENDING_ASSIGNMENT" ? null : hoursAgo(o.hoursAgo - 0.1),
        pickedUpAt: ["PICKED_UP", "ON_THE_WAY", "DELIVERED"].includes(dlv.status) ? hoursAgo(o.hoursAgo - 0.3) : null,
        deliveredAt,
        latitude: coord[0], longitude: coord[1], contactPhone: "2663999000", contactName: o.customer,
        deliveryFee: o.deliveryFee ?? 1500, createdAt: created,
      },
    });
    for (const it of items) {
      await tx.orderDeliveryItem.create({
        data: { deliveryId: delivery.id, orderItemId: it._orderItemId, productId: it.p.id, productName: it.p.name, quantityDelivered: it.qty, unitPrice: Number(it.p.price) },
      });
    }
    // Status logs
    const chain = ["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "ON_THE_WAY", "DELIVERED"];
    let prev = null;
    for (const st of chain) {
      if (chain.indexOf(st) > chain.indexOf(dlv.status) && dlv.status !== "DELIVERED") break;
      await tx.orderDeliveryStatusLog.create({
        data: { tenantId, deliveryId: delivery.id, previousStatus: prev, status: st, changedAt: hoursAgo(o.hoursAgo - 0.1), changedById: driver?.user.id ?? null, driverProfileId: driver?.profile.id ?? null, reason: prev ? `Avance DEV a ${st}` : "Sin asignar" },
      });
      if (st === dlv.status) break;
      prev = st;
    }
    deliveryRows.push({ delivery, dlv });
  }
  console.log(`[delivery] ${deliveryRows.length} entregas creadas.`);

  // Rutas
  const routeSpecs = [
    { key: "ACTIVE", status: "IN_PROGRESS", driverIdx: 0, started: 1.5 },
    { key: "ROUTE_B", status: "COMPLETED", driverIdx: 1, started: 20, doneAt: 18, dur: 7200 },
    { key: "ROUTE_C", status: "COMPLETED", driverIdx: 0, started: 44, doneAt: 42, dur: 6900 },
  ];
  for (const spec of routeSpecs) {
    const driver = drivers[spec.driverIdx];
    const stops = deliveryRows.filter((d) => d.dlv.route === spec.key).sort((a, b) => a.dlv.stop - b.dlv.stop);
    const route = await tx.deliveryRoute.create({
      data: {
        tenantId, driverProfileId: driver.profile.id, branchId: branch.id, status: spec.status,
        startedAt: hoursAgo(spec.started), completedAt: spec.status === "COMPLETED" ? hoursAgo(spec.doneAt) : null,
        totalStops: stops.length, completedStops: spec.status === "COMPLETED" ? stops.length : 0,
        incidentCount: 0, totalDurationS: spec.dur ?? null, notes: spec.status === "COMPLETED" ? "Recorrido DEV histórico" : "Recorrido DEV activo",
      },
    });
    for (const d of stops) {
      await tx.orderDelivery.update({
        where: { id: d.delivery.id },
        data: { routeId: route.id, routeOrder: d.dlv.stop, plannedOrder: d.dlv.stop },
      });
    }
    console.log(`  [route] ${spec.key} (${spec.status}): ${stops.length} paradas`);
  }

  // GPS: última posición de cada repartidor cerca de Principal
  const gps = [
    { driverIdx: 0, coord: COORDS[0], del: deliveryRows.find((d) => d.dlv.status === "ON_THE_WAY")?.delivery },
    { driverIdx: 1, coord: COORDS[4], del: null },
  ];
  for (const g of gps) {
    const driver = drivers[g.driverIdx];
    await tx.driverPosition.create({
      data: { tenantId, branchId: branch.id, deliveryId: g.del?.id ?? null, driverId: driver.user.id, driverProfileId: driver.profile.id, latitude: g.coord[0], longitude: g.coord[1], accuracy: "12", recordedAt: new Date() },
    });
  }
  console.log("[gps] Posiciones DEV creadas para repartidores en zona de Principal.");
  return deliveryRows;
}
// ─────────────────────────── RESERVAS ───────────────────────────
async function seedReservations(tx, scope) {
  const { tenantId } = scope;
  const specs = [
    { name: "Ana Müller", phone: "2665999001", date: 0, time: "20:00", size: 4, status: "pending" },
    { name: "Roberto Sosa", phone: "2665999002", date: 0, time: "20:30", size: 2, status: "confirmed" },
    { name: "María Ledesma", phone: "2665999003", date: 1, time: "21:00", size: 6, status: "confirmed" },
    { name: "Diego Agüero", phone: "2665999004", date: 1, time: "19:30", size: 3, status: "pending" },
    { name: "Clara Molina", phone: "2665999005", date: 2, time: "21:30", size: 2, status: "cancelled" },
    { name: "Nicolás Vega", phone: "2665999006", date: 3, time: "20:00", size: 5, status: "confirmed" },
    { name: "Rosa Altamirano", phone: "2665999007", date: -1, time: "21:00", size: 4, status: "completed" },
    { name: "Hugo Sarmiento", phone: "2665999008", date: -2, time: "20:30", size: 2, status: "no_show" },
  ];
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const reference = `RES-${hex(6)}`;
    const [hh, mm] = s.time.split(":").map(Number);
    const t = timeOnly(hh, mm);
    const reservation = await tx.reservation.create({
      data: {
        tenantId, branchId: scope.branch.id, reference, status: s.status,
        reservationDate: daysFromNow(s.date), reservationTime: t, partySize: s.size,
        customerName: s.name, phone: s.phone, email: `${s.name.toLowerCase().replaceAll(" ", ".")}@gmail.com`,
        acceptedPolicy: true, source: s.status === "pending" ? "website" : "admin", estimatedDuration: 120,
        createdAt: hoursAgo(10 + i),
      },
    });
    await tx.reservationStatusHistory.create({
      data: { reservationId: reservation.id, toStatus: s.status, note: "Solicitud creada desde la web (DEV)", createdAt: hoursAgo(10 + i) },
    });
    if (s.status === "confirmed" || s.status === "completed") {
      await tx.reservationStatusHistory.create({
        data: { reservationId: reservation.id, fromStatus: "pending", toStatus: s.status, note: "Confirmada por el negocio (DEV)", createdAt: hoursAgo(8) },
      });
    }
  }
  console.log(`[reservations] ${specs.length} reservas (hoy, mañana, próximos días).`);
}

// ─────────────────────────── TESTIMONIOS ───────────────────────────
async function seedTestimonials(tx, scope) {
  const { tenantId } = scope;
  const texts = [
    "Excelente atención y la muzza es de las mejores de la ciudad.",
    "El delivery llegó rápido y bien caliente. ¡Muy recomendable!",
    "Lindo lugar para ir con amigos, la carta es variada.",
    "La hamburguesa doble es enorme. Repetimos seguro.",
    "Muy buena relación precio-calidad. Súper atentos.",
    "Pedimos por la web y fue todo muy fácil.",
    "Ambiente genial y las cervezas artesanales imperdibles.",
  ];
  const statuses = ["published", "published", "pending", "published", "hidden", "published", "pending"];
  for (let i = 0; i < texts.length; i++) {
    await tx.testimonial.create({
      data: { tenantId, branchId: scope.branch.id, description: texts[i], state: statuses[i] === "published", moderationStatus: statuses[i], date: daysFromNow(-(7 - i)) },
    });
  }
  console.log(`[testimonials] ${texts.length} testimonios (publicados, pendientes y ocultos).`);
}

// ─────────────────────────── EVENTOS ───────────────────────────
async function seedEvents(tx, scope) {
  const { tenantId } = scope;
  const events = [
    { name: "Happy Hour 2x1", date: daysFromNow(5), description: "2x1 en cervezas de 18 a 20 h", location: "Laterne · Principal" },
    { name: "Noche de IPA", date: daysFromNow(12), description: "Degustación de IPA artesanales", location: "Laterne · Principal" },
    { name: "Música en vivo", date: daysFromNow(19), description: "Trío acústico en el salón", location: "Laterne · Principal" },
    { name: "Promo 2x1 Pizzas", date: daysFromNow(26), description: "2x1 en pizzas los miércoles", location: "Laterne · Principal" },
  ];
  for (const e of events) {
    await tx.event.create({
      data: { tenantId, branchId: scope.branch.id, name: e.name, date: e.date, time: timeOnly(21, 0), description: e.description, location: e.location, status: "published" },
    });
  }
  console.log(`[events] ${events.length} eventos creados.`);
}

// ─────────────────────────── PROMOCIONES / CUPONES ───────────────────────────
async function seedPromotions(tx, scope, menuProducts, catMap, createdOrders) {
  const { tenantId } = scope;
  const promoDefs = [
    { name: "Bienvenido 10%", slug: "bienvenido10", type: "percentage", discountValue: 10, code: "BIENVENIDO10", desc: "10% de descuento en tu primera compra.", status: "published", usageLimit: 500, perCustomerLimit: 1 },
    { name: "MenuClick 20", slug: "menuclick20", type: "fixed_amount", discountValue: 500, code: "MENUCLICK20", desc: "$500 de descuento a partir de $8.000.", status: "published", minimumPurchase: 8000, perCustomerLimit: 3 },
    { name: "Delivery 15", slug: "delivery15", type: "fixed_amount", discountValue: 1500, code: "DELIVERY15", desc: "$1.500 de descuento en delivery.", status: "published", usageLimit: 300 },
    { name: "2x1 Pizzas", slug: "2x1-pizzas", type: "two_for_one", buyQuantity: 2, receiveQuantity: 1, code: null, desc: "Llevás 2 pizzas y pagás 1.", status: "published" },
  ];
  const promotions = [];
  for (const p of promoDefs) {
    const promo = await tx.promotion.create({
      data: { tenantId, branchId: scope.branch.id, slug: p.slug, name: p.name, description: p.desc, type: p.type, discountValue: p.discountValue, minimumPurchase: p.minimumPurchase, buyQuantity: p.buyQuantity, receiveQuantity: p.receiveQuantity, startAt: daysFromNow(-30), endAt: daysFromNow(60), code: p.code, usageLimit: p.usageLimit, perCustomerLimit: p.perCustomerLimit, status: p.status, publishAt: daysFromNow(-30), priority: 1 },
    });
    const cat = p.slug === "2x1-pizzas" ? catMap["pizzas"] : null;
    if (cat) await tx.promotionCategory.create({ data: { tenantId, promotionId: promo.id, categoryId: cat.id } }).catch(() => {});
    promotions.push(promo);
  }
  const delivered = createdOrders.filter((c) => c.o.status === "delivered");
  if (delivered[0] && promotions[0]) {
    await tx.promotionUsage.create({ data: { tenantId, promotionId: promotions[0].id, orderId: delivered[0].order.id, customerEmail: "juan.perez@gmail.com", createdAt: delivered[0].created } }).catch(() => {});
  }
  console.log(`[promotions] ${promotions.length} promociones/cupones (2x1, %, fijo, delivery).`);
  return promotions;
}
// ─────────────────────────── FACTURACIÓN INTERNA ───────────────────────────
async function seedInvoices(tx, scope, createdOrders, deliveryRows) {
  const { tenantId } = scope;
  const delivered = createdOrders.filter((c) => c.o.status === "delivered");
  const deliveredR = deliveryRows.filter((d) => d.delivery.status === "DELIVERED");
  const specs = [
    { orderRec: delivered[0], status: "issued", number: "REC-0001", delivery: deliveredR[0]?.delivery ?? null },
    { orderRec: delivered[1], status: "draft", number: null, delivery: null },
  ];
  for (const s of specs) {
    if (!s.orderRec) continue;
    const { order, items, total, created } = s.orderRec;
    const invoice = await tx.invoiceRecord.create({
      data: {
        tenantId, branchId: scope.branch.id, orderId: order.id, deliveryId: s.delivery?.id ?? null,
        status: s.status, documentType: "internal_receipt", number: s.number, customerName: order.customerName,
        subtotal: total, total, currency: "ARS", notes: "Comprobante interno NO fiscal (DEV)", issuedAt: s.status === "issued" ? created : null,
      },
    });
    for (const it of items) {
      await tx.invoiceRecordItem.create({
        data: { invoiceId: invoice.id, productId: it.p.id, productName: it.p.name, quantity: it.qty, unitPrice: Number(it.p.price), lineTotal: it.lineTotal },
      });
    }
  }
  console.log("[invoices] 2 comprobantes internos DEV (issued + draft, no fiscales).");
}

// ─────────────────────────── FINANZAS ───────────────────────────
async function seedFinancials(tx, scope, createdOrders) {
  const { tenantId } = scope;
  const caja = await tx.financialAccount.create({ data: { tenantId, branchId: scope.branch.id, name: "Caja Principal", code: "CAJA-01", type: "caja", currency: "ARS", status: "active", openingBalance: 100000, openingDate: daysFromNow(-30) } });
  const banco = await tx.financialAccount.create({ data: { tenantId, branchId: scope.branch.id, name: "Banco San Luis", code: "BANCO-01", type: "banco", currency: "ARS", status: "active", openingBalance: 500000, openingDate: daysFromNow(-30) } });
  const transfer = await tx.financialTransfer.create({ data: { tenantId, reference: `TRF-${hex(6)}`, fromAccountId: caja.id, toAccountId: banco.id, amount: 150000, transferDate: daysFromNow(-10), notes: "Aporte a banco DEV" } });
  await tx.financialMovement.create({ data: { tenantId, branchId: scope.branch.id, accountId: caja.id, date: daysFromNow(-10), type: "transfer_out", direction: "OUT", amount: 150000, concept: "Transferencia a banco", reference: transfer.reference, origin: "transfer", transferId: transfer.id } });
  await tx.financialMovement.create({ data: { tenantId, branchId: scope.branch.id, accountId: banco.id, date: daysFromNow(-10), type: "transfer_in", direction: "IN", amount: 150000, concept: "Transferencia desde caja", reference: transfer.reference, origin: "transfer", transferId: transfer.id } });
  const sales = createdOrders.filter((c) => ["delivered", "completed"].includes(c.o.status)).reduce((acc, c) => acc + c.total, 0);
  await tx.financialMovement.create({ data: { tenantId, branchId: scope.branch.id, accountId: caja.id, date: hoursAgo(30), type: "sale", direction: "IN", amount: Math.round(sales / 2), concept: "Ingresos por ventas DEV", origin: "sale", referenceType: "order" } });
  await tx.financialMovement.create({ data: { tenantId, branchId: scope.branch.id, accountId: caja.id, date: hoursAgo(20), type: "expense", direction: "OUT", amount: 45800, concept: "Pago de luz", origin: "expense", referenceType: "expense" } });
  await tx.financialMovement.create({ data: { tenantId, branchId: scope.branch.id, accountId: banco.id, date: hoursAgo(15), type: "purchase", direction: "OUT", amount: 325000, concept: "Compra a Lácteos del Valle", origin: "purchase", referenceType: "purchase-invoice" } });
  const cust = await tx.loyaltyCustomer.findFirst({ where: { tenantId, name: "Carlos Martínez" } });
  if (cust) {
    await tx.receivableDocument.create({ data: { tenantId, branchId: scope.branch.id, customerId: cust.id, number: `CXC-${hex(6)}`, documentDate: hoursAgo(24), dueDate: daysFromNow(9), originalAmount: 21400, status: "open", notes: "Cuenta corriente DEV" } });
  }
  console.log("[financials] Cuentas, transferencia, movimientos y cuenta a cobrar DEV creados.");
}
// ─────────────────────────── MAIN + RESUMEN ───────────────────────────
async function runSummary() {
  const t = 1;
  const c = (sql) => prisma.$queryRawUnsafe(sql);
  const n = (rows) => Number(rows[0]?.total ?? 0);
  const q = (tbl, extra = "") => prisma.$queryRawUnsafe(`SELECT COUNT(*) AS total FROM ${tbl} WHERE tenantId = ${t} ${extra}`);

  const counts = {
    "Pedidos (orders)": n(await q("customerorder")),
    "Entregas (deliveries)": n(await q("orderdelivery")),
    "Recorridos (routes)": n(await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS total FROM deliveryroute WHERE tenantId = 1`)),
    "Repartidores (driver profiles)": n(await q("driverprofile")),
    "Productos (carta+insumos)": n(await q("product")),
    "Categorías": n(await q("category")),
    "Clientes (loyalty)": n(await q("loyaltycustomer")),
    "Reservas": n(await q("reservation")),
    "Mesas": n(await q("diningtable")),
    "Testimonios": n(await q("testimonial")),
    "Ingredientes con stock": n(await q("inventorystock")),
    "Proveedores": n(await q("supplier")),
    "Pedidos de compra": n(await q("purchaseorder")),
    "Gastos": n(await q("expense")),
    "Promociones/cupones": n(await q("promotion")),
    "Eventos": n(await q("event")),
    "Comprobantes internos": n(await q("invoicerecord")),
    "Cuentas financieras": n(await q("financialaccount")),
    "Usuarios (total)": n(await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS total FROM user`)),
    "Usuarios (laterne)": n(await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS total FROM tenantmembership WHERE tenantId = 1`)),
  };
  console.log("\n================ RESUMEN POST-SEED (Laterne / Principal) ================");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  console.log("==========================================================================");
}

async function main() {
  const scope = await resolveScope();
  console.log(`[seed] Tenant: ${scope.tenant.name} (id=${scope.tenantId}, slug=${scope.tenant.slug})`);
  console.log(`[seed] Sucursal: ${scope.branch.name} (id=${scope.branch.id}, slug=${scope.branch.slug}, isPrimary=${scope.branch.isPrimary})`);

  await cleanup(scope.tenantId);

  const roles = await prisma.role.findMany({ where: { tenantId: scope.tenantId } });
  const roleKeys = roles.map((r) => r.key).sort();
  console.log(`[roles] Roles reales del tenant: ${roleKeys.join(", ")}`);

  await prisma.$transaction(
    async (tx) => {
      await seedDevUsers(tx, scope, roles);
      const drivers = await seedDrivers(tx, scope, roles);

      const { catMap, menuProducts } = await seedCatalog(tx, scope);
      const ingMap = await seedVariantsAndRecipes(tx, scope, menuProducts);
      await seedInventory(tx, scope, menuProducts, ingMap);
      await seedSuppliers(tx, scope);
      await seedPurchases(tx, scope, menuProducts, ingMap);
      const customerMap = await seedCustomersAndLoyalty(tx, scope);
      const catExp = await seedExpenseCategories(tx, scope);
      await seedExpenses(tx, scope, catExp);
      const tables = await seedTables(tx, scope);

      const createdOrders = await seedOrders(tx, scope, { menuProducts, customerMap, tables });
      const deliveryRows = await seedDeliveries(tx, scope, { customerMap, drivers }, createdOrders);

      await seedReservations(tx, scope);
      await seedTestimonials(tx, scope);
      await seedEvents(tx, scope);
      await seedPromotions(tx, scope, menuProducts, catMap, createdOrders);
      await seedInvoices(tx, scope, createdOrders, deliveryRows);
      await seedFinancials(tx, scope, createdOrders);
    },
    { timeout: 120000, maxWait: 30000 }
  );

  console.log("\n[seed] Transacción DEV completada.");
  await runSummary();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\n[seed] ERROR:", e);
  await prisma.$disconnect();
  process.exit(1);
});