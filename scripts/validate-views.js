import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pug from 'pug';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const viewsDirectory = path.resolve(scriptDirectory, '../views');

const collectPugFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectPugFiles(entryPath) : [entryPath];
  }));

  return nestedFiles.flat().filter((file) => file.endsWith('.pug'));
};

const viewFiles = await collectPugFiles(viewsDirectory);

for (const viewFile of viewFiles) {
  pug.compileFile(viewFile, { basedir: viewsDirectory });
}

const sampleCategory = { id: 1, name: 'Cervezas', description: 'Artesanales', imageUrl: 'beer-svgrepo-com.png' };
const sampleProduct = { id: 1, name: 'IPA', description: 'Cerveza lupulada', price: 1000, availavility: 'disponible', imageUrl: 'product_default.png' };
const sampleEvent = { id: 1, name: 'Música en vivo', description: 'Una noche especial', date: '2026-08-09', time: '21:00:00', location: 'Laterne', imageUrl: null };
const sampleUser = { id: 1, name: 'Usuario', email: 'usuario@example.com', role: 1, imageUrl: 'avatar_profile_default.png' };
const sampleBusiness = { address: 'La Punta', email: 'hola@example.com', phoneNumber: '123456', facebookUrl: 'https://facebook.com', instagramUrl: 'https://instagram.com', latitude: -33, longitude: -66 };
const sampleHour = { id: 1, dayOfWeek: 'Lunes', morningStartTime: '09:00:00', morningEndTime: '13:00:00', eveningStartTime: '18:00:00', eveningEndTime: '23:00:00' };
const sampleTestimonial = { id: 1, description: 'Excelente', date: '2026-08-09', state: 1 };
const commonLocals = { isLoggedIn: true, role: 1 };

const renderCases = {
  'business-info.pug': { BusinessInfo: sampleBusiness },
  'card-virtual.pug': { GroupedProducts: [{ category: sampleCategory, products: [sampleProduct] }] },
  'category-create.pug': { Categories: [sampleCategory], Images: [{ name: 'beer-svgrepo-com.png', path: '/images/images_categories/beer-svgrepo-com.png' }] },
  'category-edit.pug': { Category: sampleCategory, Images: [{ name: 'beer-svgrepo-com.png', path: '/images/images_categories/beer-svgrepo-com.png' }] },
  'error.pug': { statusCode: 404, title: 'No encontrada', message: 'No existe' },
  'event-create.pug': { Events: [sampleEvent] },
  'event-edit.pug': { Event: sampleEvent },
  'home.pug': { productCount: 1, categoryCount: 1, userCount: 1, testimonialCount: 1, eventCount: 1 },
  'index.pug': { Events: [sampleEvent], BusinessInfo: sampleBusiness, ImagesUrls: [], GroupedOpeningHours: { sample: sampleHour }, Testimonials: [sampleTestimonial] },
  'login.pug': { isLoggedIn: false },
  'opening-hours.pug': { OpeningHour: [sampleHour] },
  'product-create.pug': { Products: [sampleProduct], Categories: [sampleCategory] },
  'product-edit.pug': { Product: sampleProduct, Categories: [sampleCategory], ProductCategory: [{ categoryId: 1, Category: sampleCategory }] },
  'profile.pug': { User: sampleUser },
  'testimonials.pug': { TestimonialsAcepted: [sampleTestimonial], TestimonialsNoAcepted: [{ ...sampleTestimonial, id: 2, state: 0 }] },
  'user-edit.pug': { User: sampleUser },
  'users.pug': { Users: [sampleUser] },
};

for (const [viewName, viewLocals] of Object.entries(renderCases)) {
  const html = pug.renderFile(path.join(viewsDirectory, 'pages', viewName), {
    ...commonLocals,
    ...viewLocals,
  });

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) {
    throw new Error(`${viewName} contiene IDs duplicados: ${[...new Set(duplicateIds)].join(', ')}`);
  }
}

console.log(`Vistas Pug válidas: ${viewFiles.length}; páginas renderizadas: ${Object.keys(renderCases).length}`);
