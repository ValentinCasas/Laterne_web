export type Period = { from: Date; to: Date };

export type ReportFilters = {
  branchId?: number | null;
  categoryId?: number | null;
  productId?: number | null;
  supplierId?: number | null;
  userId?: number | null;
  paymentMethod?: string | null;
  channel?: string | null;
  source?: string | null;
};

export type ReportPagination = {
  page: number;
  pageSize: number;
};

export type ReportMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ResumenKpis = {
  netSales: number;
  orderCount: number;
  averageTicket: number;
  previousNetSales: number;
  previousOrderCount: number;
  previousAverageTicket: number;
  netSalesChange: number;
  orderCountChange: number;
};

export type EvolutionPoint = {
  date: string;
  netSales: number;
  orderCount: number;
};

export type TopProduct = {
  productId: number;
  productName: string;
  total: number;
  quantity: number;
};

export type VentasKpis = {
  grossSales: number;
  discounts: number;
  netSales: number;
  orderCount: number;
  averageTicket: number;
  previousNetSales: number;
  previousOrderCount: number;
  previousAverageTicket: number;
  netSalesChange: number;
  orderCountChange: number;
};

export type ProductRankingItem = {
  productId: number;
  productName: string;
  units: number;
  sales: number;
  participation: number;
  cmv: number | null;
  cmvPercent: number | null;
  margin: number | null;
  marginPercent: number | null;
  markup: number | null;
  costAvailable: boolean;
};

export type ComprasKpis = {
  totalPurchased: number;
  operationCount: number;
  activeSuppliers: number;
};

export type PurchaseItem = {
  date: string;
  supplierName: string;
  document: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  total: number;
  branchName: string;
};

export type BranchComparisonItem = {
  branchId: number;
  branchName: string;
  netSales: number;
  orderCount: number;
  averageTicket: number;
  discounts: number;
  participation: number;
  byChannel: Record<string, number>;
};

export type MenuEngineeringItem = {
  productId: number;
  productName: string;
  categoryName: string | null;
  units: number;
  sales: number;
  cmv: number | null;
  cmvPercent: number | null;
  margin: number | null;
  marginPercent: number | null;
  markup: number | null;
  costAvailable: boolean;
  previousUnits: number;
  previousSales: number;
  previousMarginPercent: number | null;
  unitsTrend: "up" | "down" | "stable";
  salesTrend: "up" | "down" | "stable";
  marginTrend: "up" | "down" | "stable";
  quadrant: "potenciar" | "revisar" | "promocionar" | "reformular" | "sin_datos";
  quadrantReason: string;
};

export type MenuEngineeringSummary = {
  totalProducts: number;
  withCostData: number;
  withoutCostData: number;
  quadrantDistribution: Record<string, number>;
  popularityMedian: number;
  marginMedian: number;
};

export type OrderDetail = {
  id: number;
  reference: string;
  createdAt: string;
  status: string;
  orderType: string;
  channel: string;
  source: string;
  paymentMethod: string;
  total: number;
  discount: number;
  customerName: string;
  userName: string | null;
};
