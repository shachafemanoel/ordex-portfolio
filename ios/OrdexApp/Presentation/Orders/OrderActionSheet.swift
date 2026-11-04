import SwiftUI

// MARK: - Sheet router
/// Sheet that routes to the correct sub-view based on action type.
struct OrderActionSheet: View {
    let order: Order
    let action: OrderAction
    let onConfirm: (OrderActionPayload?) -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationStack {
            Group {
                switch action.type {
                case .callCustomer:
                    CallCustomerView(order: order, onConfirm: onConfirm, onCancel: onCancel)
                case .whatsappCustomer:
                    WhatsappCustomerView(order: order, onConfirm: onConfirm, onCancel: onCancel)
                case .openNavigation:
                    NavigationActionView(order: order, onConfirm: onConfirm, onCancel: onCancel)
                case .receiveItems, .prepareShipment:
                    ItemsChecklistActionView(order: order, action: action, onConfirm: onConfirm, onCancel: onCancel)
                case .scheduleInstallation:
                    ScheduleInstallationView(order: order, onConfirm: onConfirm, onCancel: onCancel)
                case .reportIssue:
                    ReportIssueView(action: action, onConfirm: onConfirm, onCancel: onCancel)
                case .partialInstall:
                    PartialInstallSheet(order: order, action: action, onConfirm: onConfirm, onCancel: onCancel)
                case .confirmDetails, .confirmPayment:
                    ConfirmActionView(action: action, order: order, onConfirm: onConfirm, onCancel: onCancel)
                case .markSupplied:
                    MarkSuppliedView(action: action, onConfirm: onConfirm, onCancel: onCancel)
                case .updateStatus, .checkStock, .createPurchaseOrder, .unknown:
                    GenericActionView(action: action, onConfirm: onConfirm, onCancel: onCancel)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

// MARK: - Call
private struct CallCustomerView: View {
    let order: Order
    let onConfirm: (OrderActionPayload?) -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "phone.fill")
                .font(.system(size: 48))
                .foregroundColor(.green)
            Text("התקשר ללקוח")
                .font(.title2.bold())
            if let name = order.customerName {
                Text(name).foregroundColor(.secondary)
            }
            if let phone = order.customerPhone {
                Text(phone).font(.title3)
            }
            Spacer()
            Button("חייג עכשיו") {
                if let phone = order.customerPhone {
                    ExternalAppLauncher.call(phone: phone)
                }
                onConfirm(nil)
            }
            .buttonStyle(PrimaryActionButtonStyle(color: .green))
            .disabled(order.customerPhone == nil)
            Button("ביטול", role: .cancel, action: onCancel)
                .foregroundColor(.secondary)
        }
        .padding(24)
        .navigationTitle("התקשר ללקוח")
    }
}

// MARK: - WhatsApp
private struct WhatsappCustomerView: View {
    let order: Order
    let onConfirm: (OrderActionPayload?) -> Void
    let onCancel: () -> Void
    @State private var message = ""

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "message.fill")
                .font(.system(size: 48))
                .foregroundColor(Color(red: 0.18, green: 0.8, blue: 0.44))
            Text("WhatsApp ללקוח")
                .font(.title2.bold())
            if let name = order.customerName {
                Text(name).foregroundColor(.secondary)
            }
            TextField("הודעה (אופציונלי)", text: $message, axis: .vertical)
                .lineLimit(3, reservesSpace: true)
                .padding(10)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            Spacer()
            Button("פתח WhatsApp") {
                if let phone = order.customerPhone {
                    ExternalAppLauncher.whatsapp(phone: phone, message: message)
                }
                onConfirm(OrderActionPayload(note: message.isEmpty ? nil : message))
            }
            .buttonStyle(PrimaryActionButtonStyle(color: Color(red: 0.18, green: 0.8, blue: 0.44)))
            .disabled(order.customerPhone == nil)
            Button("ביטול", role: .cancel, action: onCancel)
                .foregroundColor(.secondary)
        }
        .padding(24)
        .navigationTitle("WhatsApp")
    }
}

// MARK: - Navigation
private struct NavigationActionView: View {
    let order: Order
    let onConfirm: (OrderActionPayload?) -> Void
    let onCancel: () -> Void

    private var address: String {
        [order.addressLine, order.city].compactMap { $0 }.joined(separator: ", ")
    }

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "map.fill")
                .font(.system(size: 48))
                .foregroundColor(.teal)
            Text("פתח ניווט")
                .font(.title2.bold())
            if !address.isEmpty {
                Text(address)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            Spacer()
            Button("נווט") {
                ExternalAppLauncher.navigate(to: address)
                onConfirm(OrderActionPayload(confirmedAddress: true))
            }
            .buttonStyle(PrimaryActionButtonStyle(color: .teal))
            .disabled(address.isEmpty)
            Button("ביטול", role: .cancel, action: onCancel)
                .foregroundColor(.secondary)
        }
        .padding(24)
        .navigationTitle("ניווט")
    }
}

// MARK: - Items checklist (Receive / Prepare)
struct ItemsChecklistActionView: View {
    let order: Order
    let action: OrderAction
    let onConfirm: (OrderActionPayload?) -> Void
    let onCancel: () -> Void

    @State private var receivedItems: [ReceivedItemPayload]

    init(order: Order, action: OrderAction, onConfirm: @escaping (OrderActionPayload?) -> Void, onCancel: @escaping () -> Void) {
        self.order = order
        self.action = action
        self.onConfirm = onConfirm
        self.onCancel = onCancel
        let items = order.items.map { item in
            ReceivedItemPayload(
                itemId: item.id,
                receivedQuantity: item.receivedQuantity ?? 0,
                isReceived: (item.receivedQuantity ?? 0) >= item.qty && item.qty > 0
            )
        }
        _receivedItems = State(initialValue: items)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if receivedItems.isEmpty {
                ContentUnavailableView("אין פריטים", systemImage: "shippingbox")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    Section {
                        Button(action.type == .prepareShipment ? "סמן את הכל כהועמס" : "סמן את הכל כהתקבל") {
                            for i in receivedItems.indices {
                                receivedItems[i].isReceived = true
                                let orderItem = order.items.first(where: { $0.id == receivedItems[i].itemId })
                                receivedItems[i].receivedQuantity = orderItem?.qty ?? 0
                            }
                        }
                        .font(.subheadline)
                    }

                    Section(header: Text(action.type == .prepareShipment ? "סמן פריטים שהועמסו" : "סמן פריטים שהתקבלו")) {
                        ForEach($receivedItems) { $item in
                            let orderItem = order.items.first(where: { $0.id == item.itemId })
                            HStack(spacing: 12) {
                                Toggle("", isOn: $item.isReceived)
                                    .labelsHidden()
                                    .tint(action.type == .prepareShipment ? .blue : .orange)
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(orderItem?.name ?? item.itemId)
                                        .font(.subheadline.weight(.medium))
                                    Text("SKU: \(orderItem?.sku ?? "N/A")")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                
                                Spacer()
                                
                                VStack(alignment: .trailing, spacing: 4) {
                                    Text("\(item.receivedQuantity) / \(orderItem?.qty ?? 0)")
                                        .font(.caption.monospacedDigit())
                                    
                                    Stepper("", value: $item.receivedQuantity, in: 0...(orderItem?.qty ?? 999))
                                        .labelsHidden()
                                        .fixedSize()
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }

            VStack(spacing: 12) {
                Button(action.title) {
                    onConfirm(OrderActionPayload(
                        targetStatus: action.targetStatus,
                        receivedItems: receivedItems
                    ))
                }
                .buttonStyle(PrimaryActionButtonStyle(color: action.type == .prepareShipment ? .blue : .orange))
                
                Button("ביטול", role: .cancel, action: onCancel)
                    .foregroundColor(.secondary)
            }
            .padding(16)
        }
        .navigationTitle(action.title)
    }
}

// MARK: - Schedule installation
private struct ScheduleInstallationView: View {
    let order: Order
    let onConfirm: (OrderActionPayload?) -> Void
    let onCancel: () -> Void

    @State private var scheduledAt: Date = Calendar.current.date(byAdding: .day, value: 1, to: .now) ?? .now
    @State private var duration: Int = 2

    private var scheduledEnd: Date {
        Calendar.current.date(byAdding: .hour, value: duration, to: scheduledAt) ?? scheduledAt
    }

    var body: some View {
        Form {
            Section("תאריך ושעת התחלה") {
                DatePicker("", selection: $scheduledAt, displayedComponents: [.date, .hourAndMinute])
                    .datePickerStyle(.graphical)
                    .labelsHidden()
                    .environment(\.layoutDirection, .rightToLeft)
            }
            Section("משך (שעות)") {
                Stepper("\(duration) שעות", value: $duration, in: 1...12)
            }
            Section {
                LabeledContent("סיום משוער", value: scheduledEnd.formatted(date: .abbreviated, time: .shortened))
            }
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 10) {
                Button("תאם התקנה") {
                    onConfirm(OrderActionPayload(scheduledAt: scheduledAt, scheduledEnd: scheduledEnd))
                }
                .buttonStyle(PrimaryActionButtonStyle(color: .indigo))
                Button("ביטול", role: .cancel, action: onCancel)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
            .background(.ultraThinMaterial)
        }
        .navigationTitle("תאם התקנה")
    }
}

// MARK: - Report issue
private struct ReportIssueView: View {
    let action: OrderAction
    let onConfirm: (OrderActionPayload?) -> Void
    let onCancel: () -> Void
    @State private var issueCategory = "אחר"
    @State private var reason = ""

    let categories = ["עיכוב", "גישה", "חוסר ציוד", "אחר"]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("בחר סוג בעיה:")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            Picker("סוג", selection: $issueCategory) {
                ForEach(categories, id: \.self) { cat in
                    Text(cat).tag(cat)
                }
            }
            .pickerStyle(.segmented)
            .environment(\.layoutDirection, .rightToLeft)
            
            Text("תאר את הבעיה (אופציונלי):")
                .font(.subheadline)
                .foregroundColor(.secondary)
            TextField("תיאור הבעיה...", text: $reason, axis: .vertical)
                .lineLimit(5, reservesSpace: true)
                .padding(12)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            Spacer()
            Button("שלח דיווח") {
                onConfirm(OrderActionPayload(reason: reason.isEmpty ? nil : reason, issueCategory: issueCategory))
            }
            .buttonStyle(PrimaryActionButtonStyle(color: .orange))
            Button("ביטול", role: .cancel, action: onCancel)
                .foregroundColor(.secondary)
        }
        .padding(20)
        .navigationTitle("דווח בעיה")
    }
}

// MARK: - Partial install
private struct PartialInstallSheet: View {
    let order: Order
    let action: OrderAction
    let onConfirm: (OrderActionPayload?) -> Void
    let onCancel: () -> Void

    @State private var installedItems: [InstalledItemPayload]

    init(order: Order, action: OrderAction, onConfirm: @escaping (OrderActionPayload?) -> Void, onCancel: @escaping () -> Void) {
        self.order = order
        self.action = action
        self.onConfirm = onConfirm
        self.onCancel = onCancel
        let items = order.items.map { item in
            InstalledItemPayload(
                itemId: item.id,
                installedQuantity: item.installedQuantity ?? 0,
                isInstalled: (item.installedQuantity ?? 0) >= item.qty && item.qty > 0
            )
        }
        _installedItems = State(initialValue: items)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if installedItems.isEmpty {
                ContentUnavailableView("אין פריטים", systemImage: "wrench.and.screwdriver")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    Section {
                        Button("סמן את הכל כהותקן") {
                            for i in installedItems.indices {
                                installedItems[i].isInstalled = true
                                let orderItem = order.items.first(where: { $0.id == installedItems[i].itemId })
                                installedItems[i].installedQuantity = orderItem?.qty ?? 0
                            }
                        }
                        .font(.subheadline)
                    }

                    Section(header: Text("סמן פריטים שהותקנו")) {
                        ForEach($installedItems) { $item in
                            let orderItem = order.items.first(where: { $0.id == item.itemId })
                            HStack(spacing: 12) {
                                Toggle("", isOn: $item.isInstalled)
                                    .labelsHidden()
                                    .tint(.green)
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(orderItem?.name ?? item.itemId)
                                        .font(.subheadline.weight(.medium))
                                    Text("SKU: \(orderItem?.sku ?? "N/A")")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                
                                Spacer()
                                
                                VStack(alignment: .trailing, spacing: 4) {
                                    Text("\(item.installedQuantity) / \(orderItem?.qty ?? 0)")
                                        .font(.caption.monospacedDigit())
                                    
                                    Stepper("", value: $item.installedQuantity, in: 0...(orderItem?.qty ?? 999))
                                        .labelsHidden()
                                        .fixedSize()
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }

            VStack(spacing: 12) {
                Button("דווח התקנה חלקית") {
                    onConfirm(OrderActionPayload(
                        targetStatus: .installed,
                        installedItems: installedItems
                    ))
                }
                .buttonStyle(PrimaryActionButtonStyle(color: .green))
                
                Button("ביטול", role: .cancel, action: onCancel)
                    .foregroundColor(.secondary)
            }
            .padding(16)
        }
        .navigationTitle("התקנה חלקית")
    }
}

// MARK: - Confirm details / payment
private struct ConfirmActionView: View {
    let action: OrderAction
    let order: Order
    let onConfirm: (OrderActionPayload?) -> Void
    let onCancel: () -> Void
    @State private var note = ""

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: action.type == .confirmPayment ? "creditcard.fill" : "checkmark.seal.fill")
                .font(.system(size: 48))
                .foregroundColor(.blue)
            Text(action.title)
                .font(.title2.bold())
            if let subtitle = action.subtitle {
                Text(subtitle).foregroundColor(.secondary)
            }
            TextField("הערה (אופציונלי)", text: $note)
                .padding(10)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            Spacer()
            Button(action.title) {
                onConfirm(OrderActionPayload(note: note.isEmpty ? nil : note, targetStatus: action.targetStatus))
            }
            .buttonStyle(PrimaryActionButtonStyle(color: .blue))
            Button("ביטול", role: .cancel, action: onCancel)
                .foregroundColor(.secondary)
        }
        .padding(24)
        .navigationTitle(action.title)
    }
}

// MARK: - Mark supplied confirmation
private struct MarkSuppliedView: View {
    let action: OrderAction
    let onConfirm: (OrderActionPayload?) -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "flag.checkered")
                .font(.system(size: 56))
                .foregroundColor(.blue)
            Text("סמן כסופק?")
                .font(.title2.bold())
            Text("פעולה זו תעדכן את ההזמנה לסטטוס 'סופק' ותישלח הודעה ללקוח.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            Spacer()
            Button("אשר – סמן כסופק") {
                onConfirm(OrderActionPayload(targetStatus: .supplied))
            }
            .buttonStyle(PrimaryActionButtonStyle(color: .blue))
            Button("ביטול", role: .cancel, action: onCancel)
                .foregroundColor(.secondary)
        }
        .padding(24)
        .navigationTitle("סמן כסופק")
    }
}

// MARK: - Generic fallback
private struct GenericActionView: View {
    let action: OrderAction
    let onConfirm: (OrderActionPayload?) -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Text(action.title)
                .font(.title2.bold())
            if let subtitle = action.subtitle {
                Text(subtitle).foregroundColor(.secondary)
            }
            Spacer()
            Button("בצע") {
                onConfirm(OrderActionPayload(targetStatus: action.targetStatus))
            }
            .buttonStyle(PrimaryActionButtonStyle(color: .accentColor))
            Button("ביטול", role: .cancel, action: onCancel)
                .foregroundColor(.secondary)
        }
        .padding(24)
        .navigationTitle(action.title)
    }
}

// MARK: - Shared button style
struct PrimaryActionButtonStyle: ButtonStyle {
    let color: Color
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(color.opacity(configuration.isPressed ? 0.7 : 1))
            .foregroundColor(.white)
            .fontWeight(.semibold)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}
