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
export type StoreType = 'TEA_STALL' | 'BREAKFAST' | 'FOOD_STALL' | 'JUICE' | 'BAKERY' | 'GROCERY' | 'VEGETABLE' | 'SPECIALTY_VENDOR' | 'LAUNDRY' | 'SALON' | 'OTHER';
export type StoreStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED_TEMPORARILY';
export interface Store {
    id: string;
    merchantId: string;
    name: string;
    slug: string;
    storeType: StoreType;
    address?: string;
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
    sortOrder: number;
    isActive: boolean;
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
export interface Product {
    id: string;
    storeId: string;
    categoryId: string;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    isAvailable: boolean;
    sortOrder: number;
    station: ProductStation;
    modifiers?: ProductModifier[];
    inventory?: ProductInventorySummary;
    createdAt: string;
    updatedAt: string;
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
export type OrderStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'UPI' | 'CASH' | 'OTHER';
export interface OrderItemModifierSnapshot {
    name: string;
    priceDelta: number;
}
export interface OrderItem {
    id: string;
    orderId: string;
    productId: string;
    productNameSnapshot: string;
    unitPriceSnapshot: number;
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
export type VoiceLanguage = 'en-IN' | 'hi-IN' | 'mr-IN';
export type VoiceVerbosity = 'BRIEF' | 'DETAILED';
export interface StoreSettings {
    id: string;
    storeId: string;
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
export type RealtimeEventType = 'CONNECTED' | 'ORDER_CREATED' | 'ORDER_UPDATED' | 'ORDER_CANCELLED' | 'QUEUE_UPDATED' | 'PAYMENT_UPDATED' | 'STOCK_ALERT';
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
    failedOrderIds: {
        id: string;
        reason: string;
    }[];
    serverTimestamp: string;
}
//# sourceMappingURL=index.d.ts.map