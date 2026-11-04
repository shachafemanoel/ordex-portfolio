import SwiftUI

struct OrderInfoSection: View {
    let order: Order

    var body: some View {
        List {
            // Customer Card
            Section("פרטי לקוח") {
                if let name = order.customerName {
                    LabeledContent("שם", value: name)
                }
                if let email = order.customerEmail {
                    LabeledContent("אימייל", value: email)
                }
                if let phone = order.customerPhone {
                    LabeledContent("טלפון", value: phone)
                }
            }

            // Address
            if order.addressLine != nil || order.city != nil {
                Section("כתובת") {
                    if let line = order.addressLine {
                        Text(line)
                    }
                    if let city = order.city {
                        Text(city)
                    }
                }
            }

            // Payment
            Section("תשלום") {
                LabeledContent("סה\"כ", value: order.displayTotal)
                LabeledContent("שולם", value: order.displayPaid)
                if order.outstandingBalanceCents > 0 {
                    LabeledContent("יתרה לתשלום") {
                        Text(order.displayOutstanding)
                            .foregroundStyle(.red)
                            .fontWeight(.medium)
                    }
                }
                LabeledContent("סטטוס תשלום", value: order.paymentStatus.hebrewLabel)
            }

            // Schedule
            if let scheduledAt = order.scheduledAt {
                Section("תזמון") {
                    LabeledContent("תאריך", value: scheduledAt.hebrewFormatted)
                    if let end = order.scheduledEnd {
                        LabeledContent("סיום", value: end.hebrewTimeOnly)
                    }
                }
            }

            // Assignment
            if let name = order.assignedUserName ?? order.installerName {
                Section("שיוך") {
                    LabeledContent("נציג", value: name)
                }
            }

            // Meta
            Section("כללי") {
                LabeledContent("נוצר", value: order.createdAt.hebrewFormatted)
                LabeledContent("עודכן", value: order.updatedAt.hebrewFormatted)
                if let notes = order.notes, !notes.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("הערות").font(.caption).foregroundStyle(.secondary)
                        Text(notes)
                    }
                }
            }
        }
    }
}
