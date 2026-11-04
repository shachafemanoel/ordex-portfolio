/**
 * Canonical Appointment/Calendar Event DTO definition
 */

export interface AppointmentOrderSummary {
  id: string;
  number: string;
  customerName?: string | null;
}

export interface AppointmentUserSummary {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface AppointmentDTO {
  id: string;
  orderId?: string | null;
  title: string;
  description?: string | null;
  status: string;
  location?: string | null;
  startTime: string | Date;
  endTime: string | Date;
  assignedTo?: string | null;
  googleId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  order?: AppointmentOrderSummary | null;
  assignedUser?: AppointmentUserSummary | null;
  // Address fields for display purposes
  street?: string | null;
  houseNumber?: string | null;
  floor?: string | null;
  city?: string | null;
  // Additional fields used in UI
  technicianUserId?: string | null;
  startsAt?: string | Date;  // Used for filtering - falls back to startTime
  endsAt?: string | Date | null;
  notes?: string | null;
}
