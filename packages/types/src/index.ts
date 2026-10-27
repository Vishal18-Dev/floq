/**
 * FLOQ Shared Domain Types & Enums
 * Single source of truth for Vendor App, Customer PWA, Kitchen Display, Admin, and Shared Backend.
 */

export type MerchantStatus = 'ACTIVE' | 'SUSPENDED';

export interface Merchant {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: MerchantStatus;
  createdAt: string;
  updatedAt: string;
}

export type StoreType =
  | 'TEA_STALL'
  | 'BREAKFAST'
  | 'FOOD_STALL'
  | 'JUICE'
  | 'BAKERY'
  | 'GROCERY'
  | 'VEGETABLE'
  | 'SPECIALTY_VENDOR'
  | 'LAUNDRY'
  | 'SALON'
  | 'OTHER';

export type StoreStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED_TEMPORARILY';

/**
 * Operating mode drives the whole UX:
 * - FOOD: made-to-order counter with a live queue, prep timers, tokens and
 *   optional voice call-outs (tea stall, breakfast joint).
 * - RETAIL: sell → charge → receipt, no kitchen queue (reseller / distributor
 *   of packaged goods). Orders complete instantly at charge time.
 */
export type StoreMode = 'FOOD' | 'RETAIL';

export interface Store {
  id: string;
  merchantId: string;
  name: string;
  nameLocal?: string;
  slug: string;
  storeType: StoreType;
  mode: StoreMode;
  address?: string;
  city?: string;
  imageUrl?: string;
  phone?: string;
  openingTime?: string;
  closingTime?: string;
  timezone: string;
  status: StoreStatus;
  createdAt: string;
  updatedAt: string;
}

export type StaffRole = 'OWNER' | 'MANAGER' | 'STAFF';
export type StaffStatus = 'ACTIVE' | 'INACTIVE';

export interface Staff {
  id: string;
  storeId: string;
  name: string;
  phone: string;
  role: StaffRole;
  status: StaffStatus;
  createdAt: string;
}

export type DeviceRole = 'VENDOR' | 'KITCHEN' | 'DISPLAY';

export interface Device {
  id: string;
  storeId: string;
  name: string;
  role: DeviceRole;
  lastActiveAt?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  storeId: string;
  name: string;
  nameLocal?: string;
  sortOrder: number;
  isActive: boolean;
  /** Default supplier for one-tap reorder (retail stores). */
  supplier?: string;
  createdAt: string;
}

export type ProductStation = 'BEVERAGE' | 'HOT_FOOD' | 'GRILL' | 'BAKERY' | 'PACKAGED' | 'GENERAL';

export interface ProductModifier {
  id: string;
  productId: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
}

export interface ProductInventorySummary {
  currentStock: number;
  lowStockThreshold: number;
  unit: string;
}

/**
 * A sellable pack size of a packed product (e.g. "500 ml", "1 L"). Each pack is
 * its own SKU with its own counter price, wholesale price, cost, live stock and
 * daily sales rate (used for days-left estimates).
 */
export interface ProductPack {
  id: string;
  productId: string;
  storeId: string;
  size: string;
  price: number;
  wholesalePrice?: number;
  costPrice?: number;
  stock: number;
  /** Units per case, for wholesale shop orders. */
  caseQty?: number;
  /** Average units sold per day, for days-left. */
  dailyRate: number;
  /** Free-text expiry warning, e.g. "6 expire in 12 days". */
  expiryNote?: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  nameLocal?: string;
  description?: string;
  /** Base price; for packed products this is 0 and packs carry the prices. */
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  sortOrder: number;
  station: ProductStation;
  modifiers?: ProductModifier[];
  inventory?: ProductInventorySummary;
  /** Pack sizes for a packed product (empty for loose goods). */
  packs?: ProductPack[];
  /** Sold loose by weight rather than in packs. */
  isLoose?: boolean;
  /** Loose price per kg. */
  perKg?: number;
  /** Loose stock in grams. */
  stockGrams?: number;
  /** Loose average sold per day, in grams. */
  dailyGrams?: number;
  createdAt: string;
  updatedAt: string;
}

export type CreditCustomerKind = 'SHOP' | 'REGULAR';

/** A shop or regular who buys on credit against a limit. */
export interface CreditCustomer {
  id: string;
  storeId: string;
  name: string;
  kind: CreditCustomerKind;
  phone?: string;
  creditLimit: number;
  /** Denormalised balance (sum of the dues ledger). */
  owes: number;
  /** Timestamp of the oldest unpaid charge, for ageing. */
  oldestDueAt?: string;
  createdAt: string;
}

export type DueEntryKind = 'CHARGE' | 'PAYMENT';

/** One line of the credit ledger: a credit sale (CHARGE) or a repayment (PAYMENT). */
export interface DueEntry {
  id: string;
  storeId: string;
  customerId: string;
  orderId?: string;
  kind: DueEntryKind;
  /** Positive = charged to the account, negative = paid off. */
  amount: number;
  note?: string;
  businessDate?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  storeId: string;
  productId: string;
  currentStock: number;
  lowStockThreshold: number;
  unit: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  storeId: string;
  name?: string;
  phone?: string;
  createdAt: string;
}

export type OrderSource = 'STAFF_POS' | 'CUSTOMER_QR' | 'WHATSAPP' | 'DELIVERY' | 'API';

export type OrderStatus =
  | 'NEW'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'UPI' | 'CASH' | 'CREDIT' | 'OTHER';

/** How a counter bill was settled. */
export type SellUnit = 'UNIT' | 'GRAM';

export interface OrderItemModifierSnapshot {
  name: string;
  priceDelta: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  /** Pack sold, when the line is a packed SKU. */
  packId?: string;
  /** UNIT for packs/food, GRAM for loose goods sold by weight. */
  sellUnit?: SellUnit;
  productNameSnapshot: string;
  unitPriceSnapshot: number;
  /** Cost at sale time, snapshotted for profit reporting. */
  costSnapshot?: number;
  quantity: number;
  modifiers?: OrderItemModifierSnapshot[];
  subtotal: number;
}

export interface Order {
  id: string;
  clientOrderId?: string;
  storeId: string;
  businessDate?: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  source: OrderSource;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  /** How the bill was settled (retail). */
  payMethod?: PaymentMethod;
  /** Wholesale shop order rather than a walk-in counter bill. */
  isWholesale?: boolean;
  /** Account the bill went on, for credit sales / shop invoices. */
  creditCustomerId?: string | null;
  /** Shop-order invoice number (FL-0231 ...). */
  invoiceNumber?: string;
  /** Cash handed over, for change calculation. */
  cashTendered?: number;
  ticketNumber: string;
  subtotal: number;
  discount: number;
  total: number;
  notes?: string;
  items: OrderItem[];
  createdAt: string;
  acceptedAt?: string | null;
  preparingAt?: string | null;
  readyAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
}

export interface Payment {
  id: string;
  orderId: string;
  provider: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  providerReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueueTicket {
  id: string;
  orderId: string;
  storeId: string;
  ticketNumber: string;
  createdAt: string;
  calledAt?: string | null;
  readyAt?: string | null;
  completedAt?: string | null;
}

export type VoiceLanguage = 'en-IN' | 'hi-IN' | 'mr-IN' | 'ta-IN';
export type VoiceVerbosity = 'BRIEF' | 'DETAILED';

/** Second language shown alongside English throughout the UI. */
export type SecondaryLanguage = 'ta' | 'hi' | 'mr' | 'none';

export interface StoreSettings {
  id: string;
  storeId: string;
  secondaryLanguage: SecondaryLanguage;
  voiceEnabled: boolean;
  voiceLanguage: VoiceLanguage;
  voiceVerbosity: VoiceVerbosity;
  typicalPrepTimeMinutes: number;
  ticketPrefix: string;
  autoAcceptQrOrders: boolean;
  upiId?: string;
  upiName?: string;
}

export interface TopProductMetric {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface HourlyMetric {
  hour: number;
  orderCount: number;
  revenue: number;
}

export interface DailySalesSummary {
  date: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  upiRevenue: number;
  cashRevenue: number;
  otherRevenue: number;
  /** Retail: revenue booked on credit today (sales + shop invoices on account). */
  creditRevenue?: number;
  /** Retail: gross profit today from snapshotted line costs. */
  grossProfit?: number;
  /** Retail: money collected against the dues ledger today. */
  duesCollected?: number;
  topProducts: TopProductMetric[];
  peakHour: number | null;
  hourlyDistribution: HourlyMetric[];
  averagePreparationMinutes: number;
  delayedOrdersCount: number;
}

export interface PublicStoreInfo {
  id: string;
  name: string;
  slug: string;
  storeType: StoreType;
  address?: string;
  phone?: string;
  openingTime?: string;
  closingTime?: string;
  upiId?: string;
  upiName?: string;
  typicalPrepTimeMinutes: number;
}

export interface PublicCategoryWithProducts {
  category: Category;
  products: Product[];
}

export interface UserSession {
  userId: string;
  phone: string;
  name: string;
  merchantId: string;
  storeIds: string[];
  role: StaffRole;
  token: string;
  expiresAt: string;
}

export interface JWTPayload {
  userId: string;
  phone: string;
  merchantId: string;
  storeIds: string[];
  role: StaffRole;
  iat?: number;
  exp?: number;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole: StaffRole;
  storeId: string;
  action: string;
  entityType: string;
  entityId: string;
  detailsJson?: string;
  createdAt: string;
}

export type RealtimeEventType =
  | 'CONNECTED'
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_CANCELLED'
  | 'QUEUE_UPDATED'
  | 'PAYMENT_UPDATED'
  | 'STOCK_ALERT';

export interface RealtimeEvent {
  eventId: string;
  type: RealtimeEventType;
  storeId: string;
  timestamp: string;
  order?: Order;
  payment?: Payment;
  previousStatus?: OrderStatus;
  [key: string]: any;
}

export interface SyncRecord {
  id: string;
  clientOrderId?: string;
  storeId: string;
  order: Order;
  payment?: Payment;
  clientTimestamp: string;
}

export interface SyncPayload {
  storeId: string;
  records: SyncRecord[];
}

export interface SyncResult {
  syncedOrderIds: string[];
  failedOrderIds: { id: string; reason: string }[];
  serverTimestamp: string;
}

