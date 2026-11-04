'use client';

import { WebPushOptIn } from '@/components/notifications/WebPushOptIn';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { normalizeToArray } from '@/lib/utils/collections';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type NotificationLog = import('@/lib/types').NotificationLog & {
  createdAt: string;
  sentAt?: string;
};

export default function NotificationsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await api.getNotificationLogs({
        dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (response.success && response.data) {
        const items = normalizeToArray<NotificationLog>(response.data);
        const normalized = items.map((log) => ({
          ...log,
          createdAt: new Date(log.createdAt).toISOString(),
          sentAt: log.sentAt ? new Date(log.sentAt).toISOString() : undefined,
        }));
        setLogs(normalized);
      }
    } catch (error) {
      console.error('Error loading notification logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-blue-100 text-blue-800',
      delivered: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: 'ממתין',
      sent: 'נשלח',
      delivered: 'הועבר',
      failed: 'נכשל',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      sms: 'SMS',
      whatsapp: 'WhatsApp',
      email: 'אימייל',
    };
    return labels[type as keyof typeof labels] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">יומן התראות</h1>
          <p className="text-gray-600 mt-1">מעקב אחר הודעות שנשלחו ללקוחות</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {logs.filter((log) => log.status === 'delivered').length}
          </div>
          <div className="text-sm text-gray-600">הודעות שנמסרו</div>
        </Card>

        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {logs.filter((log) => log.status === 'pending').length}
          </div>
          <div className="text-sm text-gray-600">הודעות ממתינות</div>
        </Card>

        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">
            {logs.filter((log) => log.status === 'failed').length}
          </div>
          <div className="text-sm text-gray-600">הודעות שנכשלו</div>
        </Card>

        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{logs.length}</div>
          <div className="text-sm text-gray-600">סה&quot;כ (7 ימים)</div>
        </Card>
      </div>

      <WebPushOptIn />

      {/* Logs Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">יומן שליחות (7 ימים אחרונים)</h3>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">טוען יומן...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">אין רשומות שליחה</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-right py-3">תאריך ושעה</th>
                  <th className="text-right py-3">סוג</th>
                  <th className="text-right py-3">נמען</th>
                  <th className="text-right py-3">תוכן</th>
                  <th className="text-right py-3">סטטוס</th>
                  <th className="text-right py-3">הזמנה</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-gray-50">
                    <td className="py-3">
                      <div>{formatDateTime(log.createdAt)}</div>
                      {log.sentAt && (
                        <div className="text-xs text-gray-500">
                          נשלח: {formatDateTime(log.sentAt)}
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      <Badge variant="secondary">{getTypeLabel(log.type)}</Badge>
                    </td>
                    <td className="py-3">{log.recipient}</td>
                    <td className="py-3 max-w-xs">
                      <div className="truncate" title={log.content}>
                        {log.content}
                      </div>
                    </td>
                    <td className="py-3">
                      <Badge className={getStatusColor(log.status)}>
                        {getStatusLabel(log.status)}
                      </Badge>
                      {log.errorMessage && (
                        <div className="text-xs text-red-500 mt-1">{log.errorMessage}</div>
                      )}
                    </td>
                    <td className="py-3">
                      {log.orderId && (
                        <Link
                          href={`/orders/${log.orderId}`}
                          className="text-blue-600 hover:underline"
                        >
                          #{log.orderId}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
