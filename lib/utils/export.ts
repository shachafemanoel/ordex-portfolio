import { Order, PurchaseOrder } from '@/lib/types';

export interface ExportOptions {
  filename?: string;
  format: 'csv' | 'json';
  includeHeaders?: boolean;
}

export class ExportService {
  static downloadCSV(data: any[], filename: string, headers?: string[]) {
    if (data.length === 0) return;

    const csvHeaders = headers || Object.keys(data[0]);
    const csvContent = [
      csvHeaders.join(','),
      ...data.map((row) =>
        csvHeaders
          .map((header) => {
            const value = row[header];
            // Handle nested objects and arrays
            if (typeof value === 'object' && value !== null) {
              return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }
            // Escape quotes and wrap in quotes if contains comma
            const stringValue = String(value || '');
            if (
              stringValue.includes(',') ||
              stringValue.includes('"') ||
              stringValue.includes('\n')
            ) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(',')
      ),
    ].join('\n');

    this.downloadFile(csvContent, filename, 'text/csv');
  }

  static downloadJSON(data: any[], filename: string) {
    const jsonContent = JSON.stringify(data, null, 2);
    this.downloadFile(jsonContent, filename, 'application/json');
  }

  private static downloadFile(content: string, filename: string, mimeType: string) {
    // Add BOM for Excel support if it's a CSV
    const finalContent = mimeType.includes('csv') ? '\uFEFF' + content : content;
    const blob = new Blob([finalContent], { type: `${mimeType};charset=utf-8;` });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // Export Orders
  static exportOrders(orders: Order[], options: ExportOptions = { format: 'csv' }) {
    const exportData = orders.map((order) => ({
      'מספר הזמנה': order.number,
      'שם לקוח': order.customerName,
      אימייל: order.customerEmail || '',
      טלפון: order.customerPhone || '',
      כתובת: order.address,
      עיר: order.city || '',
      'סכום כולל': order.totalAmount,
      סטטוס: order.status,
      'תאריך יצירה': new Date(order.createdAt).toLocaleDateString('he-IL'),
      'תאריך התקנה': order.installAt ? new Date(order.installAt).toLocaleDateString('he-IL') : '',
      הערות: order.note || '',
    }));

    const filename = options.filename || `orders_${new Date().toISOString().split('T')[0]}.csv`;

    if (options.format === 'csv') {
      this.downloadCSV(exportData, filename);
    } else {
      this.downloadJSON(exportData, filename.replace('.csv', '.json'));
    }
  }

  // Export Purchase Orders
  static exportPurchaseOrders(
    purchaseOrders: PurchaseOrder[],
    options: ExportOptions = { format: 'csv' }
  ) {
    const exportData = purchaseOrders.map((po) => ({
      מזהה: po.id,
      ספק: po.supplier?.name || '',
      'אימייל ספק': po.supplier?.email || '',
      'טלפון ספק': po.supplier?.phone || '',
      'כתובת ספק': po.supplier?.address || '',
      סטטוס: po.status,
      'תאריך יצירה': new Date(po.createdAt).toLocaleDateString('he-IL'),
      'מספר הזמנות קשורות': po.links?.length || 0,
      'הזמנות קשורות': po.links?.map((link) => `#${link.order?.number}`).join(', ') || '',
    }));

    const filename =
      options.filename || `purchase_orders_${new Date().toISOString().split('T')[0]}.csv`;

    if (options.format === 'csv') {
      this.downloadCSV(exportData, filename);
    } else {
      this.downloadJSON(exportData, filename.replace('.csv', '.json'));
    }
  }

  // Export Purchase Order Details (for individual PO with items)
  static exportPurchaseOrderDetails(
    purchaseOrder: PurchaseOrder,
    options: ExportOptions = { format: 'csv' }
  ) {
    if (!purchaseOrder.links) return;

    // Create items map for aggregation
    const itemsMap = new Map<
      string,
      {
        sku: any;
        totalQty: number;
        receivedQty: number;
        orders: string[];
      }
    >();

    purchaseOrder.links.forEach((link) => {
      link.order?.items?.forEach((item) => {
        if (item.sku) {
          const skuId = item.product?.id || item.sku;
          if (!itemsMap.has(skuId)) {
            itemsMap.set(skuId, {
              sku: {
                id: skuId,
                code: item.sku,
                name: item.name,
              },
              totalQty: 0,
              receivedQty: 0,
              orders: [],
            });
          }

          const itemGroup = itemsMap.get(skuId)!;
          itemGroup.totalQty += item.quantity ?? 0;
          if (item.received) {
            itemGroup.receivedQty += item.quantity ?? 0;
          }
          if (!itemGroup.orders.includes(`#${link.order!.number}`)) {
            itemGroup.orders.push(`#${link.order!.number}`);
          }
        }
      });
    });

    const exportData = Array.from(itemsMap.values()).map((item) => ({
      'הזמנת רכש': `${purchaseOrder.supplier?.name} - ${new Date(purchaseOrder.createdAt).toLocaleDateString('he-IL')}`,
      'קוד מוצר': item.sku.code,
      'שם מוצר': item.sku.name,
      'כמות מוזמנת': item.totalQty,
      'כמות שהתקבלה': item.receivedQty,
      סטטוס: item.receivedQty === item.totalQty ? 'הושלם' : item.receivedQty > 0 ? 'חלקי' : 'ממתין',
      'הזמנות קשורות': item.orders.join(', '),
      ספק: purchaseOrder.supplier?.name || '',
      'אימייל ספק': purchaseOrder.supplier?.email || '',
      'טלפון ספק': purchaseOrder.supplier?.phone || '',
    }));

    const filename =
      options.filename ||
      `purchase_order_${purchaseOrder.supplier?.name?.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

    if (options.format === 'csv') {
      this.downloadCSV(exportData, filename);
    } else {
      this.downloadJSON(exportData, filename.replace('.csv', '.json'));
    }
  }

  // Export Report Data
  static exportReportData(
    data: any[],
    reportTitle: string,
    options: ExportOptions = { format: 'csv' }
  ) {
    if (data.length === 0) return;

    const filename =
      options.filename ||
      `${reportTitle.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

    if (options.format === 'csv') {
      this.downloadCSV(data, filename);
    } else {
      this.downloadJSON(data, filename.replace('.csv', '.json'));
    }
  }

  // Generate PDF content (basic HTML for printing)
  static generatePDFContent(purchaseOrder: PurchaseOrder): string {
    const items = new Map<
      string,
      {
        sku: any;
        totalQty: number;
        orders: string[];
      }
    >();

    purchaseOrder.links?.forEach((link) => {
      link.order?.items?.forEach((item) => {
        if (item.sku) {
          const skuId = item.product?.id || item.sku;
          if (!items.has(skuId)) {
            items.set(skuId, {
              sku: {
                code: item.sku,
                name: item.name,
              },
              totalQty: 0,
              orders: [],
            });
          }

          const itemGroup = items.get(skuId)!;
          itemGroup.totalQty += item.quantity ?? 0;
          if (!itemGroup.orders.includes(`#${link.order!.number}`)) {
            itemGroup.orders.push(`#${link.order!.number}`);
          }
        }
      });
    });

    const itemsArray = Array.from(items.values());

    return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>הזמנת רכש - ${purchaseOrder.supplier?.name}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            direction: rtl; 
            margin: 20px;
            font-size: 14px;
        }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
        }
        .company-info, .supplier-info { 
            margin-bottom: 20px; 
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 15px;
        }
        th, td { 
            border: 1px solid #ddd; 
            padding: 8px; 
            text-align: right;
        }
        th { 
            background-color: #f2f2f2; 
            font-weight: bold;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #666;
        }
        @media print {
            body { margin: 0; }
            .header { page-break-after: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>הזמנת רכש</h1>
        <p>תאריך: ${new Date(purchaseOrder.createdAt).toLocaleDateString('he-IL')}</p>
        <p>מספר הזמנה: ${purchaseOrder.id}</p>
    </div>

    <div class="info-grid">
        <div class="company-info">
            <h3>פרטי החברה</h3>
            <p><strong>שם החברה:</strong> Ordex</p>
            <p><strong>כתובת:</strong> [כתובת החברה]</p>
            <p><strong>טלפון:</strong> [טלפון החברה]</p>
            <p><strong>אימייל:</strong> [אימייל החברה]</p>
        </div>

        <div class="supplier-info">
            <h3>פרטי ספק</h3>
            <p><strong>שם ספק:</strong> ${purchaseOrder.supplier?.name || ''}</p>
            <p><strong>אימייל:</strong> ${purchaseOrder.supplier?.email || 'לא צוין'}</p>
            <p><strong>טלפון:</strong> ${purchaseOrder.supplier?.phone || 'לא צוין'}</p>
            <p><strong>כתובת:</strong> ${purchaseOrder.supplier?.address || 'לא צוינה'}</p>
        </div>
    </div>

    <h3>פרטי ההזמנה</h3>
    <table>
        <thead>
            <tr>
                <th>קוד מוצר</th>
                <th>שם מוצר</th>
                <th>כמות</th>
                <th>הזמנות קשורות</th>
                <th>הערות</th>
            </tr>
        </thead>
        <tbody>
            ${itemsArray
              .map(
                (item) => `
                <tr>
                    <td>${item.sku.code}</td>
                    <td>${item.sku.name}</td>
                    <td><strong>${item.totalQty}</strong></td>
                    <td>${item.orders.join(', ')}</td>
                    <td></td>
                </tr>
            `
              )
              .join('')}
        </tbody>
    </table>

    <div class="footer">
        <p>הזמנת רכש זו נוצרה אוטומטית על ידי מערכת רצף</p>
        <p>תאריך הדפסה: ${new Date().toLocaleDateString('he-IL')}</p>
    </div>
</body>
</html>
    `;
  }

  static printPurchaseOrder(purchaseOrder: PurchaseOrder) {
    const htmlContent = this.generatePDFContent(purchaseOrder);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();

      // Wait for content to load then print
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  }

  // Export Calendar Events as ICS
  static exportICS(events: any[], filename?: string) {
    const icsContent = this.generateICSContent(events);
    const exportFilename = filename || `calendar_${new Date().toISOString().split('T')[0]}.ics`;
    this.downloadFile(icsContent, exportFilename, 'text/calendar');
  }

  private static generateICSContent(events: any[]): string {
    const icsEvents = events
      .map((event) => {
        const startDate = new Date(event.startTime);
        const endDate = new Date(event.endTime);

        // Format dates for ICS (YYYYMMDDTHHMMSSZ)
        const formatICSDate = (date: Date) => {
          return date
            .toISOString()
            .replace(/[-:]/g, '')
            .replace(/\.\d{3}Z$/, 'Z');
        };

        const escapeText = (text: string) => {
          return text.replace(/[\\;,\n]/g, (match) => {
            switch (match) {
              case '\\':
                return '\\\\';
              case ';':
                return '\\;';
              case ',':
                return '\\,';
              case '\n':
                return '\\n';
              default:
                return match;
            }
          });
        };

        return [
          'BEGIN:VEVENT',
          `DTSTART:${formatICSDate(startDate)}`,
          `DTEND:${formatICSDate(endDate)}`,
          `SUMMARY:${escapeText(event.title || '')}`,
          `DESCRIPTION:${escapeText(event.description || '')}`,
          `LOCATION:${escapeText(event.location || '')}`,
          `UID:${event.id}@ordex.app`,
          `DTSTAMP:${formatICSDate(new Date())}`,
          'STATUS:CONFIRMED',
          'END:VEVENT',
        ].join('\r\n');
      })
      .join('\r\n');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ordex//Calendar Events//HE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      icsEvents,
      'END:VCALENDAR',
    ].join('\r\n');
  }

  // Export single event as ICS
  static exportSingleEventICS(event: any) {
    this.exportICS([event], `event_${event.title?.replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, '_')}.ics`);
  }
}
