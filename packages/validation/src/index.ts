import { z } from 'zod';

export const StoreTypeEnum = z.enum([
  'TEA_STALL',
  'BREAKFAST',
  'FOOD_STALL',
  'JUICE',
  'BAKERY',
  'GROCERY',
  'VEGETABLE',
  'SPECIALTY_VENDOR',
  'LAUNDRY',
  'SALON',
  'OTHER',
]);

export const ProductStationEnum = z.enum([
  'BEVERAGE',
  'HOT_FOOD',
  'GRILL',
  'BAKERY',
  'PACKAGED',
  'GENERAL',
]);

export const OrderSourceEnum = z.enum([
  'STAFF_POS',
  'CUSTOMER_QR',
  'WHATSAPP',
  'DELIVERY',
  'API',
]);

export const OrderStatusEnum = z.enum([
  'NEW',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
]);

export const PaymentStatusEnum = z.enum([
  'PENDING',
  'SUCCESS',
  'FAILED',
  'REFUNDED',
]);

export const PaymentMethodEnum = z.enum(['UPI', 'CASH', 'OTHER']);

export const VoiceLanguageEnum = z.enum(['en-IN', 'hi-IN', 'mr-IN']);
export const VoiceVerbosityEnum = z.enum(['BRIEF', 'DETAILED']);

export const StaffRoleEnum = z.enum(['OWNER', 'MANAGER', 'STAFF']);
export const DeviceRoleEnum = z.enum(['VENDOR', 'KITCHEN', 'DISPLAY']);

// Order Item Input
export const OrderItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  modifiers: z
    .array(
      z.object({
        name: z.string(),
        priceDelta: z.number(),
      })
    )
    .optional(),
});

// Create Order Schema (Unified for STAFF_POS & CUSTOMER_QR)
export const CreateOrderSchema = z.object({
  id: z.string().optional(), // Client-generated UUID for offline-first support
  clientOrderId: z.string().optional(),
  storeId: z.string().min(1, 'Store ID is required'),
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  source: OrderSourceEnum.default('STAFF_POS'),
  items: z.array(OrderItemInputSchema).min(1, 'At least one item is required'),
  discount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
  paymentMethod: PaymentMethodEnum.optional(),
  immediatePayment: z.boolean().default(false),
  status: OrderStatusEnum.optional(),
});

export type CreateOrderInput = z.input<typeof CreateOrderSchema>;

// Update Order Status Schema
export const UpdateOrderStatusSchema = z.object({
  status: OrderStatusEnum,
  reason: z.string().optional(),
});

export type UpdateOrderStatusInput = z.input<typeof UpdateOrderStatusSchema>;

// Payment Schemas
export const CreatePaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  method: PaymentMethodEnum,
  amount: z.number().positive('Amount must be positive'),
  provider: z.string().default('FLOQ_MOCK_PAYMENT'),
  providerReference: z.string().optional(),
});

export type CreatePaymentInput = z.input<typeof CreatePaymentSchema>;

export const ConfirmPaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  providerReference: z.string().optional(),
  status: PaymentStatusEnum.default('SUCCESS'),
});

export type ConfirmPaymentInput = z.input<typeof ConfirmPaymentSchema>;

// Product Schemas
export const CreateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
  price: z.number().nonnegative('Price cannot be negative'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  station: ProductStationEnum.default('GENERAL'),
});

export type CreateProductInput = z.input<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.partial();
export type UpdateProductInput = z.input<typeof UpdateProductSchema>;

// Category Schemas
export const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type CreateCategoryInput = z.input<typeof CreateCategorySchema>;

// Store & Settings Schemas
export const CreateStoreSchema = z.object({
  merchantId: z.string().min(1, 'Merchant ID is required'),
  name: z.string().min(1, 'Store name is required'),
  slug: z.string().min(1, 'Store slug is required'),
  storeType: StoreTypeEnum.default('TEA_STALL'),
  address: z.string().optional(),
  phone: z.string().optional(),
  template: z.string().optional(),
});

export type CreateStoreInput = z.input<typeof CreateStoreSchema>;

export const UpdateStoreSettingsSchema = z.object({
  voiceEnabled: z.boolean().optional(),
  voiceLanguage: VoiceLanguageEnum.optional(),
  voiceVerbosity: VoiceVerbosityEnum.optional(),
  typicalPrepTimeMinutes: z.number().int().positive().optional(),
  ticketPrefix: z.string().optional(),
  autoAcceptQrOrders: z.boolean().optional(),
  upiId: z.string().optional(),
  upiName: z.string().optional(),
});

export type UpdateStoreSettingsInput = z.input<typeof UpdateStoreSettingsSchema>;

// Auth Schemas
export const AuthLoginSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
});
export type AuthLoginInput = z.input<typeof AuthLoginSchema>;

export const OTPVerifySchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  otp: z.string().min(4, 'OTP must be 4 to 6 digits'),
});
export type OTPVerifyInput = z.input<typeof OTPVerifySchema>;

// Offline Sync Schema
export const SyncRecordSchema = z.object({
  id: z.string(),
  clientOrderId: z.string().optional(),
  storeId: z.string(),
  order: z.any(),
  payment: z.any().optional(),
  clientTimestamp: z.string(),
});

export const SyncPayloadSchema = z.object({
  storeId: z.string(),
  records: z.array(SyncRecordSchema),
});

export type SyncPayloadInput = z.input<typeof SyncPayloadSchema>;

// Admin White-Glove Merchant Onboarding Schema
export const OnboardMerchantSchema = z.object({
  merchantName: z.string().min(1, 'Merchant/Admin name is required'),
  phone: z.string().min(10, '10-digit mobile number required'),
  email: z.string().email().optional().nullable(),
  storeName: z.string().min(1, 'Store name is required'),
  storeType: StoreTypeEnum.default('TEA_STALL'),
  address: z.string().optional(),
  upiId: z.string().optional(),
  upiName: z.string().optional(),
  initialCategoryName: z.string().default('General'),
});

export type OnboardMerchantInput = z.input<typeof OnboardMerchantSchema>;
