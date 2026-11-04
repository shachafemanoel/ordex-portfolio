export class ExternalCalendarSyncService {
  constructor(private _prismaClient?: unknown) {}

  async enableSyncForItem(itemKey: string) {
    return {
      success: false,
      itemKey,
      message: 'External calendar sync is not configured in this build',
    };
  }
}
