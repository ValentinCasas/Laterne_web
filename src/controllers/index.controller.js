import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import BusinessInfo from '../models/businessInfo.model.js';
import Category from '../models/category.model.js';
import Event from '../models/event.model.js';
import OpeningHour from '../models/openingHour.model.js';
import Product from '../models/product.model.js';
import ProductCategory from '../models/productCategory.model.js';
import Testimonial from '../models/testimonial.model.js';
import User from '../models/user.model.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const avatarDirectory = path.join(currentDirectory, '../../public/images/avatars_defect');

const groupOpeningHours = (openingHours) => {
  const groups = {};

  for (const openingHour of openingHours) {
    const key = [
      openingHour.morningStartTime,
      openingHour.morningEndTime,
      openingHour.eveningStartTime,
      openingHour.eveningEndTime,
    ].join('-');

    groups[key] ||= {
      morningStartTime: openingHour.morningStartTime,
      morningEndTime: openingHour.morningEndTime,
      eveningStartTime: openingHour.eveningStartTime,
      eveningEndTime: openingHour.eveningEndTime,
      days: [],
    };

    for (const day of openingHour.dayOfWeek.split(',').map((value) => value.trim()).filter(Boolean)) {
      if (!groups[key].days.includes(day)) groups[key].days.push(day);
    }
  }

  return groups;
};

export const goIndex = async (req, res) => {
  const [events, businessInfo, testimonials, openingHours, imagesUrls] = await Promise.all([
    Event.findAll(),
    BusinessInfo.findOne(),
    Testimonial.findAll({ where: { state: 1 } }),
    OpeningHour.findAll(),
    readdir(avatarDirectory),
  ]);

  res.render('pages/index', {
    Events: events,
    BusinessInfo: businessInfo,
    ImagesUrls: imagesUrls,
    GroupedOpeningHours: groupOpeningHours(openingHours),
    Testimonials: testimonials,
  });
};

export const goCardVirtual = async (req, res) => {
  const [products, categories, productCategories] = await Promise.all([
    Product.findAll(),
    Category.findAll(),
    ProductCategory.findAll(),
  ]);

  const productIdsByCategory = new Map();
  for (const association of productCategories) {
    const productIds = productIdsByCategory.get(association.categoryId) || new Set();
    productIds.add(association.productId);
    productIdsByCategory.set(association.categoryId, productIds);
  }

  const groupedProducts = categories
    .map((category) => ({
      category,
      products: products.filter((product) => productIdsByCategory.get(category.id)?.has(product.id)),
    }))
    .filter((group) => group.products.length > 0);

  res.render('pages/card-virtual', { GroupedProducts: groupedProducts });
};

export const goHome = async (req, res) => {
  const [productCount, categoryCount, userCount, testimonialCount, eventCount] = await Promise.all([
    Product.count(),
    Category.count(),
    User.count(),
    Testimonial.count(),
    Event.count(),
  ]);

  res.render('pages/home', {
    productCount,
    categoryCount,
    userCount,
    testimonialCount,
    eventCount,
  });
};
