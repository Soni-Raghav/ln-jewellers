// Shared TypeScript types for LN Jewellers

export interface Category {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  image?: string | null;
  order: number;
  active: boolean;
  productCount?: number;
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  story?: string | null;
  image?: string | null;
  featured: boolean;
  active: boolean;
  productCount?: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  size?: string | null;
  color?: string | null;
  priceDelta: number;
  stock: number;
  active: boolean;
}

export interface Review {
  id: string;
  productId: string;
  name: string;
  rating: number;
  title?: string | null;
  comment: string;
  approved: boolean;
  helpfulCount?: number;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  shortDescription?: string | null;
  description: string;
  price: number;
  discountPercent: number;
  categoryId: string;
  category?: Category;
  collectionId?: string | null;
  collection?: Collection;
  images: string[]; // parsed from JSON
  model3dUrl?: string | null;
  material: string;
  purity?: string | null;
  color?: string | null;
  weightGrams?: number | null;
  dimensions?: string | null;
  stock: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  featured: boolean;
  bestSeller: boolean;
  trending: boolean;
  handmade: boolean;
  readyToShip: boolean;
  craftsmanship?: string | null;
  careInstructions?: string | null;
  status: "PUBLISHED" | "DRAFT" | "ARCHIVED";
  tags: string[];
  variants: ProductVariant[];
  reviews?: Review[];
  rating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type EngravingFont = "SERIF" | "SCRIPT" | "SANS";

export interface CartItem {
  productId: string;
  variantId?: string | null;
  slug: string;
  name: string;
  sku: string;
  image: string;
  unitPrice: number; // base + variant delta, net of nothing
  discountPercent: number;
  quantity: number;
  variantName?: string | null;
  maxStock: number;
  engravingText?: string | null; // per-piece inscription set on the product page
  engravingFont?: EngravingFont | null; // lettering style for the inscription (null/undefined = classic serif)
}

export interface OrderItemDTO {
  id: string;
  productId: string;
  name: string;
  sku: string;
  variantName?: string | null;
  image?: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  engravingText?: string | null;
  engravingFont?: string | null;
}

export interface OrderDTO {
  id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes?: string | null;
  items: OrderItemDTO[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  couponCode?: string | null;
  couponDiscount?: number;
  giftWrap?: boolean;
  giftWrapFee?: number;
  giftMessage?: string | null;
  engravingText?: string | null;
  engravingFee?: number;
  cancelRequested?: boolean;
  cancelReason?: string | null;
  cancelRequestedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreSettingsDTO {
  brandName: string;
  tagline: string;
  whatsappNumber: string;
  email: string;
  phone: string;
  address: string;
  businessHours: string;
  instagramUrl: string;
  facebookUrl: string;
  pinterestUrl: string;
  youtubeUrl: string;
  shippingFee: number;
  freeShippingAbove: number;
  taxRatePercent: number;
  giftWrapFee: number;
  engravingEnabled: boolean;
  engravingFee: number;
  engravingFeeScript: number;
  engravingFeeSans: number;
  appointmentVisitCapacity: number;
  appointmentVideoCapacity: number;
  aboutStory: string;
  missionVision: string;
  shippingPolicy: string;
  returnsPolicy: string;
  privacyPolicy: string;
  termsPolicy: string;
  faq: { q: string; a: string }[];
  instagramGallery: string[];
  testimonials: { name: string; location: string; text: string; rating: number }[];
  razorpayEnabled: boolean;
  updatedAt: string;
}

export interface DashboardStats {
  totalProducts: number;
  publishedProducts: number;
  totalInventoryUnits: number;
  lowStock: { id: string; name: string; sku: string; stock: number; lowStockThreshold: number }[];
  outOfStock: { id: string; name: string; sku: string }[];
  totalOrders: number;
  pendingOrders: number;
  revenue: number;
  newInquiries: number;
  subscribers: number;
  pendingReviews: number;
  activeCoupons: number;
  couponRedemptions: number;
  couponSavings: number;
  pendingQuestions: number;
  pendingAppointments: number;
  todaysAppointments: number;
  stockAlerts: number;
  engravingOrders: number;
  giftWrapOrders: number;
  eligibleOrders: number;
  engravingAttach: number;
  giftWrapAttach: number;
  salesSeries: { date: string; label: string; orders: number; revenue: number }[];
  recentOrders: OrderDTO[];
  recentInquiries: { id: string; name: string; email: string; subject: string; status: string; createdAt: string }[];
  topProducts: { id: string; name: string; sold: number }[];
}

export interface AppointmentDTO {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: string; // STORE_VISIT | VIDEO_CALL
  date: string; // YYYY-MM-DD
  timeSlot: string;
  notes: string | null;
  status: string; // PENDING | CONFIRMED | DECLINED | COMPLETED
  createdAt: string;
  updatedAt: string;
}

export interface ProductQuestionDTO {
  id: string;
  name: string;
  question: string;
  answer: string;
  createdAt: string;
  answeredAt: string | null;
}

export interface StockAlertDTO {
  id: string;
  email: string;
  phone: string | null;
  notified: boolean;
  notifiedAt: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    slug: string;
    image: string;
    stock: number;
    trackInventory: boolean;
  };
}

export interface PublicCouponDTO {
  code: string;
  type: "PERCENT" | "FLAT";
  value: number;
  minSubtotal: number;
  description: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type ViewName =
  | "home"
  | "shop"
  | "product"
  | "cart"
  | "checkout"
  | "wishlist"
  | "about"
  | "contact"
  | "faq"
  | "policy"
  | "track"
  | "invoice"
  | "account"
  | "admin-login"
  | "admin"
  | "collection"
  | "404";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "CUSTOMER";
}

export interface ViewParams {
  slug?: string;
  collection?: string;
  category?: string;
  policy?: "shipping" | "returns" | "privacy" | "terms";
  q?: string;
  orderNumber?: string; // invoice view — LN-… order number
  orderEmail?: string; // invoice view — billing email (verification for the order API)
}
