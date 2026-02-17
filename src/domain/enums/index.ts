// ─── Load ───────────────────────────────────────────────
export enum LoadStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  NEGOTIATING = 'NEGOTIATING',
  TAKEN = 'TAKEN',
  ON_BOARD = 'ON_BOARD',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELED = 'CANCELED',
  NOT_INTERESTED = 'NOT_INTERESTED',
}

export enum StopType {
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
}

export enum BodyType {
  CURTAINSIDER = 'CURTAINSIDER',
  BOX = 'BOX',
  REFRIGERATED = 'REFRIGERATED',
  FLATBED = 'FLATBED',
  MEGA = 'MEGA',
  JUMBO = 'JUMBO',
  TANKER = 'TANKER',
  CONTAINER = 'CONTAINER',
  LOW_LOADER = 'LOW_LOADER',
  OTHER = 'OTHER',
}

// ─── Payment ────────────────────────────────────────────
export enum PaymentStatus {
  PENDING = 'PENDING',
  INVOICED = 'INVOICED',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  DISPUTED = 'DISPUTED',
  WRITTEN_OFF = 'WRITTEN_OFF',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  FACTORING = 'FACTORING',
  CASH = 'CASH',
  OTHER = 'OTHER',
}

export enum Currency {
  EUR = 'EUR',
  PLN = 'PLN',
  CZK = 'CZK',
  GBP = 'GBP',
  CHF = 'CHF',
  USD = 'USD',
}

// ─── Broker ─────────────────────────────────────────────
export enum BrokerRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  UNRATED = 'UNRATED',
}

export enum ContactRole {
  DISPATCHER = 'DISPATCHER',
  MANAGER = 'MANAGER',
  ACCOUNTING = 'ACCOUNTING',
  DRIVER_COORDINATOR = 'DRIVER_COORDINATOR',
  OTHER = 'OTHER',
}

// ─── Route ──────────────────────────────────────────────
export enum RouteStatus {
  ACTIVE = 'ACTIVE',
  SIMULATION = 'SIMULATION',
  ARCHIVED = 'ARCHIVED',
  DRAFT = 'DRAFT',
}

export enum RouteStopStatus {
  PENDING = 'PENDING',
  EN_ROUTE = 'EN_ROUTE',
  ARRIVED = 'ARRIVED',
  LOADING = 'LOADING',
  UNLOADING = 'UNLOADING',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
}

// ─── Document ───────────────────────────────────────────
export enum DocumentType {
  CMR = 'CMR',
  INVOICE = 'INVOICE',
  POD = 'POD',
  INSURANCE = 'INSURANCE',
  LICENSE = 'LICENSE',
  FREIGHT_ORDER = 'FREIGHT_ORDER',
  CUSTOMS_DECLARATION = 'CUSTOMS_DECLARATION',
  ADR_CERTIFICATE = 'ADR_CERTIFICATE',
  OTHER = 'OTHER',
}

export enum DocumentCategory {
  LOAD = 'LOAD',
  BROKER = 'BROKER',
  DRIVER = 'DRIVER',
  VAN = 'VAN',
  COMPANY = 'COMPANY',
}

// ─── Van / Driver ───────────────────────────────────────
export enum VanStatus {
  AVAILABLE = 'AVAILABLE',
  ON_ROUTE = 'ON_ROUTE',
  MAINTENANCE = 'MAINTENANCE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

export enum DriverStatus {
  AVAILABLE = 'AVAILABLE',
  ON_ROUTE = 'ON_ROUTE',
  REST = 'REST',
  OFF_DUTY = 'OFF_DUTY',
  SICK = 'SICK',
}

// ─── Dispatch ───────────────────────────────────────────
export enum DispatchStatus {
  PLANNED = 'PLANNED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}
