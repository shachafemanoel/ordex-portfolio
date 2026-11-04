import { GoogleIntegrationMissingError } from '@/lib/integrations/google/errors';
import { prisma } from '@/lib/db';
import { GoogleWorkspaceClient } from '@/lib/services/google-workspace/GoogleWorkspaceClient';
import { withGoogleRetries } from '@/lib/services/google-workspace/googleRetry';
import {
  CalendarEventKind,
  GoogleCalendarSyncStatus,
  GoogleWorkspaceIntegrationStatus,
} from '@prisma/client';

export const DEFAULT_WORKSPACE_STORE_ID = 'default';

export type InstallationCalendarPayload = {
  storeId?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  /** When creating a new local row */
  createdByUserId?: string | null;
};

export class InstallationGoogleCalendarService {
  constructor(private readonly workspace = new GoogleWorkspaceClient()) {}

  async syncInstallationEventForOrder(
    orderId: string,
    payload: InstallationCalendarPayload
  ): Promise<{ calendarEventId: string; googleSyncStatus: GoogleCalendarSyncStatus }> {
    const storeId = payload.storeId ?? DEFAULT_WORKSPACE_STORE_ID;

    let local = await prisma.calendarEvent.findFirst({
      where: { orderId, eventKind: CalendarEventKind.INSTALLATION },
      orderBy: { updatedAt: 'desc' },
    });

    if (!local) {
      local = await prisma.calendarEvent.create({
        data: {
          orderId,
          title: payload.title,
          description: payload.description ?? null,
          location: payload.location ?? null,
          startTime: payload.startTime,
          endTime: payload.endTime,
          status: 'SCHEDULED',
          eventKind: CalendarEventKind.INSTALLATION,
          googleSyncStatus: GoogleCalendarSyncStatus.PENDING,
          createdBy: payload.createdByUserId ?? undefined,
        },
      });
    } else {
      const reopenFromCancelled =
        local.googleSyncStatus === GoogleCalendarSyncStatus.CANCELLED;
      local = await prisma.calendarEvent.update({
        where: { id: local.id },
        data: {
          title: payload.title,
          description: payload.description ?? undefined,
          location: payload.location ?? undefined,
          startTime: payload.startTime,
          endTime: payload.endTime,
          googleSyncStatus: GoogleCalendarSyncStatus.PENDING,
          googleLastError: null,
          status: 'SCHEDULED',
          ...(reopenFromCancelled
            ? { googleId: null, googleHtmlLink: null, googleLastSyncedAt: null }
            : {}),
        },
      });
    }

    try {
      const integration = await prisma.workspaceGoogleIntegration.findUnique({
        where: { storeId },
      });
      if (
        !integration ||
        integration.status !== GoogleWorkspaceIntegrationStatus.ACTIVE
      ) {
        throw new GoogleIntegrationMissingError();
      }

      const { calendar } = await this.workspace.getGmailAndCalendar(storeId);
      const calendarId = 'primary';

      if (local.googleId) {
        const updated = await withGoogleRetries(() =>
          calendar.events.patch({
            calendarId,
            eventId: local!.googleId!,
            requestBody: {
              summary: payload.title,
              description: payload.description ?? undefined,
              location: payload.location ?? undefined,
              start: { dateTime: payload.startTime.toISOString() },
              end: { dateTime: payload.endTime.toISOString() },
            },
          })
        );

        const next = await prisma.calendarEvent.update({
          where: { id: local.id },
          data: {
            googleSyncStatus: GoogleCalendarSyncStatus.SYNCED,
            googleHtmlLink: updated.data.htmlLink ?? undefined,
            googleLastSyncedAt: new Date(),
            googleLastError: null,
          },
        });

        return { calendarEventId: next.id, googleSyncStatus: next.googleSyncStatus };
      }

      const created = await withGoogleRetries(() =>
        calendar.events.insert({
          calendarId,
          requestBody: {
            summary: payload.title,
            description: payload.description ?? undefined,
            location: payload.location ?? undefined,
            start: { dateTime: payload.startTime.toISOString() },
            end: { dateTime: payload.endTime.toISOString() },
          },
        })
      );

      const googleId = created.data.id;
      if (!googleId) {
        throw new Error('Calendar insert returned no event id');
      }

      const next = await prisma.calendarEvent.update({
        where: { id: local.id },
        data: {
          googleId,
          googleHtmlLink: created.data.htmlLink ?? undefined,
          googleSyncStatus: GoogleCalendarSyncStatus.SYNCED,
          googleLastSyncedAt: new Date(),
          googleLastError: null,
        },
      });

      return { calendarEventId: next.id, googleSyncStatus: next.googleSyncStatus };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.calendarEvent.update({
        where: { id: local.id },
        data: {
          googleSyncStatus: GoogleCalendarSyncStatus.ERROR,
          googleLastError: msg.slice(0, 4000),
        },
      });
      throw e;
    }
  }

  async markInstallationError(orderId: string, message: string) {
    const local = await prisma.calendarEvent.findFirst({
      where: { orderId, eventKind: CalendarEventKind.INSTALLATION },
      orderBy: { updatedAt: 'desc' },
    });
    if (!local) return;
    await prisma.calendarEvent.update({
      where: { id: local.id },
      data: {
        googleSyncStatus: GoogleCalendarSyncStatus.ERROR,
        googleLastError: message.slice(0, 4000),
      },
    });
  }

  async cancelInstallationEvent(
    orderId: string,
    storeId: string = DEFAULT_WORKSPACE_STORE_ID
  ): Promise<void> {
    const local = await prisma.calendarEvent.findFirst({
      where: { orderId, eventKind: CalendarEventKind.INSTALLATION },
      orderBy: { updatedAt: 'desc' },
    });
    if (!local || local.googleSyncStatus === GoogleCalendarSyncStatus.CANCELLED) return;

    const integration = await prisma.workspaceGoogleIntegration.findUnique({
      where: { storeId },
    });
    if (
      local.googleId &&
      integration?.status === GoogleWorkspaceIntegrationStatus.ACTIVE
    ) {
      try {
        const { calendar } = await this.workspace.getGmailAndCalendar(storeId);
        await withGoogleRetries(() =>
          calendar.events.patch({
            calendarId: 'primary',
            eventId: local.googleId!,
            requestBody: { status: 'cancelled' },
          })
        );
      } catch {
        /* still mark local cancelled */
      }
    }

    await prisma.calendarEvent.update({
      where: { id: local.id },
      data: {
        googleSyncStatus: GoogleCalendarSyncStatus.CANCELLED,
        status: 'CANCELLED',
      },
    });
  }
}
