/**
 * Calendar appointment normalization utilities
 * Ensures consistent appointment/event data structure
 */

export function normalizeAppointment(appointment: any) {
  if (!appointment) return null;

  return {
    id: appointment.id,
    orderId: appointment.orderId || null,
    title: appointment.title,
    description: appointment.description || null,
    status: appointment.status || 'SCHEDULED',
    location: appointment.location || null,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    assignedTo: appointment.assignedTo || null,
    googleId: appointment.googleId || null,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
    order: appointment.order || null,
    assignedUser: appointment.assignedUser || null,
  };
}

export function normalizeAppointments(appointments: any[]) {
  if (!Array.isArray(appointments)) return [];
  return appointments.map(normalizeAppointment).filter(Boolean);
}
