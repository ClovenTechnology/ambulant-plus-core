export type ActorType = "PATIENT" | "CLINICIAN" | "PHARMACY" | "RIDER" | "ADMIN" | "SYSTEM";

export type CarePortOrderStatus =
  | "CREATED"
  | "BROADCASTING"
  | "OFFERS_OPEN"
  | "PHARMACY_SELECTED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "DISPATCHING"
  | "RIDER_ASSIGNED"
  | "EN_ROUTE_TO_PICKUP"
  | "AT_PHARMACY"
  | "PICKED_UP"
  | "EN_ROUTE_TO_CUSTOMER"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

const TRANSITIONS: Record<CarePortOrderStatus, CarePortOrderStatus[]> = {
  CREATED: ["BROADCASTING", "CANCELLED"],
  BROADCASTING: ["OFFERS_OPEN", "CANCELLED", "EXPIRED"],
  OFFERS_OPEN: ["PHARMACY_SELECTED", "CANCELLED", "EXPIRED"],
  PHARMACY_SELECTED: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "CANCELLED"],
  PAID: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["DISPATCHING", "COMPLETED", "CANCELLED"],
  DISPATCHING: ["RIDER_ASSIGNED", "CANCELLED"],
  RIDER_ASSIGNED: ["EN_ROUTE_TO_PICKUP", "CANCELLED"],
  EN_ROUTE_TO_PICKUP: ["AT_PHARMACY", "CANCELLED"],
  AT_PHARMACY: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["EN_ROUTE_TO_CUSTOMER", "CANCELLED"],
  EN_ROUTE_TO_CUSTOMER: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: []
};

const ROLE_GATES: Partial<Record<CarePortOrderStatus, ActorType[]>> = {
  BROADCASTING: ["SYSTEM", "ADMIN"],
  PHARMACY_SELECTED: ["PATIENT"],
  PAYMENT_PENDING: ["PATIENT"],
  PAID: ["SYSTEM", "PATIENT", "ADMIN"],
  PREPARING: ["PHARMACY", "ADMIN"],
  READY_FOR_PICKUP: ["PHARMACY", "ADMIN"],
  DISPATCHING: ["SYSTEM", "ADMIN"],
  RIDER_ASSIGNED: ["SYSTEM", "ADMIN"],
  EN_ROUTE_TO_PICKUP: ["RIDER", "ADMIN"],
  AT_PHARMACY: ["RIDER", "ADMIN"],
  PICKED_UP: ["RIDER", "ADMIN"],
  EN_ROUTE_TO_CUSTOMER: ["RIDER", "ADMIN"],
  DELIVERED: ["RIDER", "ADMIN"],
  COMPLETED: ["PATIENT", "ADMIN", "SYSTEM"],
  CANCELLED: ["PATIENT", "CLINICIAN", "PHARMACY", "ADMIN", "SYSTEM"]
};

export function canTransition(from: CarePortOrderStatus, to: CarePortOrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(params: {
  from: CarePortOrderStatus;
  to: CarePortOrderStatus;
  actor: ActorType;
}): void {
  const { from, to, actor } = params;
  if (!canTransition(from, to)) {
    throw new Error(`Invalid transition ${from} -> ${to}`);
  }
  const allowed = ROLE_GATES[to];
  if (allowed && !allowed.includes(actor)) {
    throw new Error(`Actor ${actor} not allowed to set status ${to}`);
  }
}

