/**
 * Tipos compartidos del módulo de Compras.
 *
 * Evita redefinir Supplier, BranchOption, ProductOption, OrderRow, ReceiptRow,
 * InvoiceRow y sus detalles en cada componente del flujo Pedido → Recepción →
 * Factura → Pago.
 */

/** @summary Opción de sucursal para selectores del módulo de compras. */
export type BranchOption = {
  id: number;
  name: string;
  slug: string;
  active: boolean;
};

/** @summary Opción de producto para selectores del módulo de compras. */
export type ProductOption = {
  id: number;
  name: string;
  cost?: number | string | null;
  costUnit?: string | null;
  imageUrl?: string | null;
};

/** @summary Proveedor del módulo de compras. */
export type Supplier = {
  id: number;
  code?: string | null;
  name: string;
  taxId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  paymentTerms?: string | null;
  currency?: string | null;
  status: string;
  category?: string | null;
  creditLimit?: number | null;
  currentBalance?: number | null;
  blockedAt?: string | null;
  blockedReason?: string | null;
  notes?: string | null;
  branches?: Array<{ branch: { id: number; name: string } }>;
};

/** @summary Fila de pedido de compra para tablas. */
export type OrderRow = {
  id: number;
  number: string;
  status: string;
  orderDate: string;
  expectedDate?: string | null;
  externalReference?: string | null;
  supplier: { id: number; name: string };
  branch: { id: number; name: string };
  items: Array<{
    quantity: string | number;
    receivedQuantity: string | number;
  }>;
  createdBy?: { id: number; name: string } | null;
};

/** @summary Fila de recepción física para tablas. */
export type ReceiptRow = {
  id: number;
  number: string;
  receivedAt: string;
  notes?: string | null;
  supplier: { id: number; name: string };
  branch: { id: number; name: string };
  order?: { id: number; number: string } | null;
  items: Array<{
    id: number;
    quantity: string | number;
    unit: string;
    unitCost: string | number;
    product?: { id: number; name: string };
  }>;
  createdBy?: { id: number; name: string } | null;
};

/** @summary Fila de factura de compra para tablas. */
export type InvoiceRow = {
  id: number;
  number: string;
  status: string;
  documentDate: string;
  dueDate?: string | null;
  externalNumber?: string | null;
  supplier: { id: number; name: string };
  branch?: { id: number; name: string } | null;
  subtotal: string | number;
  taxAmount: string | number;
  total: string | number;
  paidAmount: string | number;
  receipts?: Array<{ receipt: { id: number; number: string } }>;
};

/** @summary Detalle completo de pedido de compra. */
export type PurchaseOrderDetail = {
  id: number;
  number: string;
  status: string;
  orderDate: string;
  expectedDate?: string | null;
  externalReference?: string | null;
  notes?: string | null;
  supplier: { id: number; name: string; paymentTerms?: string | null };
  branch: { id: number; name: string };
  items: Array<{
    id: number;
    quantity: string | number;
    receivedQuantity: string | number;
    unit: string;
    unitCost: string | number;
    discountPercent?: string | number;
    taxPercent?: string | number;
    product: ProductOption;
  }>;
  receipts: Array<{
    id: number;
    number: string;
    receivedAt: string;
    createdBy?: { id: number; name: string } | null;
    items: Array<{
      id: number;
      quantity: string | number;
      unit: string;
      unitCost: string | number;
      product?: { id: number; name: string };
    }>;
  }>;
  invoices: Array<{
    id: number;
    number: string;
    status: string;
    total: string | number;
    documentDate: string;
    externalNumber?: string | null;
  }>;
};

/** @summary Detalle completo de factura de compra. */
export type PurchaseInvoiceDetail = {
  id: number;
  number: string;
  status: string;
  documentDate: string;
  dueDate?: string | null;
  externalNumber?: string | null;
  financialCategory?: string | null;
  notes?: string | null;
  supplier: { id: number; name: string; paymentTerms?: string | null };
  branch?: { id: number; name: string } | null;
  subtotal: string | number;
  taxAmount: string | number;
  total: string | number;
  paidAmount: string | number;
  items: Array<{
    id: number;
    productId?: number | null;
    description: string;
    quantity: string | number;
    unit: string;
    unitCost: string | number;
    discountPercent?: string | number;
    taxPercent?: string | number;
  }>;
  payments: Array<{
    id: number;
    number: string;
    amount: string | number;
    method: string;
    paidAt: string;
    notes?: string | null;
    createdBy?: { id: number; name: string } | null;
  }>;
  receipts: Array<{ receipt: ReceiptRow }>;
};
