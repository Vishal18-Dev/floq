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

export const VoiceLanguageEnum = z.enum(['en-IN', 'hi-IN', 'mr-IN', 'ta-IN']);
export const VoiceVerbosityEnum = z.enum(['BRIEF', 'DETAILED']);
export const SecondaryLanguageEnum = z.enum(['ta', 'hi', 'mr', 'none']);
export const StoreModeEnum = z.enum(['FOOD', 'RETAIL']);

export const StaffRoleEnum = z.enum(['OWNER', 'MANAGER', 'STAFF']);
export const DeviceRoleEnum = z.enum(['VENDOR', 'KITCHEN', 'DISPLAY']);

// Order Item Input. Either a catalogue productId, OR an ad-hoc line
// (name + unitPrice) used by the quick-charge amount pad.
export const OrderItemInputSchema = z
  .object({
    productId: z.string().optional(),
    name: z.string().optional(),
    unitPrice: z.number().nonnegative().optional(),
    quantity: z.number().int().positive('Quantity must be at least 1'),
    modifiers: z
      .array(
        z.object({
          name: z.string(),
          priceDelta: z.number(),
        })
      )
      .optional(),
  })
  .refine((v) => !!v.productId || (!!v.name && v.unitPrice !== undefined), {
    message: 'Item needs a productId or a name + unitPrice',
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
  nameLocal: z.string().optional(),
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
  nameLocal: z.string().optional(),
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
  secondaryLanguage: SecondaryLanguageEnum.optional(),
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

// Auth Schemas — phone + fixed PIN (no SMS OTP)
export const PinLoginSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  pin: z.string().min(4, 'PIN must be 4 to 6 digits').max(6, 'PIN must be 4 to 6 digits').regex(/^\d+$/, 'PIN must be digits only'),
});
export type PinLoginInput = z.input<typeof PinLoginSchema>;

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

// A single catalogue item supplied at onboarding time (bilingual).
export const OnboardItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  nameLocal: z.string().optional(),
  price: z.number().nonnegative('Price cannot be negative'),
  category: z.string().optional(),
  station: ProductStationEnum.optional(),
});
export type OnboardItemInput = z.input<typeof OnboardItemSchema>;

// Admin White-Glove Merchant Onboarding Schema
export const OnboardMerchantSchema = z.object({
  merchantName: z.string().min(1, 'Merchant/Admin name is required'),
  phone: z.string().min(10, '10-digit mobile number required'),
  pin: z.string().min(4, 'PIN must be 4 to 6 digits').max(6).regex(/^\d+$/, 'PIN must be digits only'),
  email: z.string().email().optional().nullable(),
  storeName: z.string().min(1, 'Store name is required'),
  storeNameLocal: z.string().optional(),
  storeType: StoreTypeEnum.default('TEA_STALL'),
  mode: StoreModeEnum.default('FOOD'),
  secondaryLanguage: SecondaryLanguageEnum.default('hi'),
  address: z.string().optional(),
  upiId: z.string().optional(),
  upiName: z.string().optional(),
  typicalPrepTimeMinutes: z.number().int().positive().optional(),
  initialCategoryName: z.string().default('General'),
  items: z.array(OnboardItemSchema).optional(),
});

export type OnboardMerchantInput = z.input<typeof OnboardMerchantSchema>;
