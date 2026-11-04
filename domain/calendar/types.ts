/**
 * Calendar/Installation Domain Type Header
 *
 * This file serves as the central type definition hub for calendar and installation domain.
 * All calendar-related types should be imported from this file.
 */

// Re-export all calendar-related types
export type {
  AppointmentDTO,
  AppointmentOrderSummary,
  AppointmentUserSummary,
} from './appointmentDTO';

// Re-export normalization utilities
export { normalizeAppointment } from '@/domain/calendar/normalizeAppointment';
