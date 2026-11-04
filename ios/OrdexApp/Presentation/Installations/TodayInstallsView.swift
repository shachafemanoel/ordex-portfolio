import SwiftUI

struct TodayInstallsView: View {
    @Environment(\.orderRepository) private var repository
    @AccessibilityFocusState private var actionFocus: DailyOpsActionFocus?
    @State private var viewModel: TodayInstallsViewModel?
    @State private var activeOrderAction: ActiveOrderAction? = nil

    var body: some View {
        ZStack {
            OrdexTheme.Color.background.ignoresSafeArea()

            if let viewModel {
                VStack(spacing: 0) {
                    TodayDateStrip(selectedDate: viewModel.selectedDate) { date in
                        OrdexTheme.Haptics.selection()
                        viewModel.selectedDate = date
                        Task { await viewModel.load() }
                    }

                    ResourceView(
                        resource: viewModel.state,
                        onRetry: { Task { await viewModel.load() } }
                    ) { sections in
                        if sections.allSatisfy(\.orders.isEmpty) {
                            DailyOpsEmptyState(selectedDate: viewModel.selectedDate)
                        } else {
                            dailyOpsContent(sections, selectedDate: viewModel.selectedDate, vm: viewModel)
                        }
                    }
                }
            } else {
                ProgressView().tint(OrdexTheme.Color.accent)
            }
        }
        .navigationTitle("תפעול יומי")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(OrdexTheme.Color.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task {
            if viewModel == nil {
                viewModel = TodayInstallsViewModel(repository: repository)
                await viewModel?.load()
            }
        }
        .sheet(item: $activeOrderAction) { presentation in
            OrderActionSheet(order: presentation.order, action: presentation.action) { payload in
                activeOrderAction = nil
                handleActionConfirmation(presentation, payload: payload)
            } onCancel: {
                activeOrderAction = nil
            }
            .onDisappear {
                restoreFocus(to: presentation)
            }
        }
    }

    @ViewBuilder
    private func dailyOpsContent(
        _ sections: [DailyOpsSectionModel],
        selectedDate: Date,
        vm: TodayInstallsViewModel
    ) -> some View {
        List {
            DailyOpsHeader(sections: sections, selectedDate: selectedDate)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 8, trailing: 16))

            ForEach(sections) { section in
                DailyOpsSection(
                    section: section,
                    actionForOrder: action(for:in:),
                    onPresentAction: present(order:action:),
                    onCall: call(order:),
                    onWhatsApp: whatsapp(order:),
                    onNavigate: navigate(to:),
                    actionFocus: $actionFocus
                )
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable { await vm.refresh() }
    }

    private func action(for order: Order, in bucket: DailyOpsBucket) -> OrderAction? {
        switch bucket {
        case .needsAttention:
            return order.customerPhone == nil ? nil : callAction(for: order)
        case .prepareOrders:
            return OrderActionPresentation.prepareShipmentAction(for: order)
        case .waitingForGoods:
            return receiveItemsAction(for: order)
        case .readyToSchedule:
            return scheduleAction(for: order)
        case .installationsToday:
            return OrderActionPresentation.markInstalledAction(for: order)
        case .upcoming:
            return order.scheduledAt == nil ? scheduleAction(for: order) : nil
        }
    }

    private func present(order: Order, action: OrderAction) {
        actionFocus = .orderAction(order.id, action.id)
        activeOrderAction = ActiveOrderAction(order: order, action: action)
    }

    private func call(order: Order) {
        guard let phone = order.customerPhone, !phone.isEmpty else { return }
        ExternalAppLauncher.call(phone: phone)
    }

    private func whatsapp(order: Order) {
        guard let phone = order.customerPhone, !phone.isEmpty else { return }
        ExternalAppLauncher.whatsapp(phone: phone)
    }

    private func navigate(to order: Order) {
        let address = addressText(for: order)
        guard !address.isEmpty else { return }
        ExternalAppLauncher.navigate(to: address, preferWaze: true)
    }

    private func handleActionConfirmation(_ presentation: ActiveOrderAction, payload: OrderActionPayload?) {
        guard OrderActionPresentation.shouldExecuteRemote(action: presentation.action, payload: payload) else {
            return
        }
        Task {
            await viewModel?.performAction(
                order: presentation.order,
                action: presentation.action,
                payload: payload
            )
        }
    }

    private func restoreFocus(to presentation: ActiveOrderAction) {
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(100))
            actionFocus = .orderAction(presentation.order.id, presentation.action.id)
        }
    }

    private func callAction(for order: Order) -> OrderAction {
        OrderAction(
            id: "call-\(order.id)",
            type: .callCustomer,
            title: "התקשר",
            subtitle: "חזרה ללקוח",
            isPrimary: true
        )
    }

    private func receiveItemsAction(for order: Order) -> OrderAction {
        OrderAction(
            id: "receive-items-\(order.id)",
            type: .receiveItems,
            title: "קליטת סחורה",
            subtitle: "סמן פריטים שהתקבלו",
            isPrimary: true
        )
    }

    private func scheduleAction(for order: Order) -> OrderAction {
        OrderAction(
            id: "schedule-\(order.id)",
            type: .scheduleInstallation,
            title: "תאם התקנה",
            subtitle: "בחר מועד התקנה",
            isPrimary: true
        )
    }

    private func addressText(for order: Order) -> String {
        [order.addressLine, order.city]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }
}

private enum DailyOpsActionFocus: Hashable {
    case orderAction(String, String)
}

private extension DailyOpsBucket {
    var tintColor: Color {
        switch self {
        case .needsAttention: return .orange
        case .prepareOrders: return .blue
        case .waitingForGoods: return OrdexTheme.Color.warning
        case .readyToSchedule: return .indigo
        case .installationsToday: return OrdexTheme.Color.success
        case .upcoming: return OrdexTheme.Color.accent
        }
    }
}

// MARK: - Sections

private struct DailyOpsHeader: View {
    let sections: [DailyOpsSectionModel]
    let selectedDate: Date

    private var orders: [Order] { sections.flatMap(\.orders) }
    private var installsToday: Int {
        sections.first(where: { $0.bucket == .installationsToday })?.orders.count ?? 0
    }
    private var needsAttention: Int {
        sections.first(where: { $0.bucket == .needsAttention })?.orders.count ?? 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(selectedDate.formatted(.dateTime.weekday(.wide).day().month()))
                        .font(.headline.weight(.bold))
                        .foregroundStyle(OrdexTheme.Color.textPrimary)
                    Text("מה צריך לעשות עכשיו")
                        .font(.caption)
                        .foregroundStyle(OrdexTheme.Color.textSecondary)
                }
                Spacer()
                Label("\(orders.count)", systemImage: "list.bullet.clipboard.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(OrdexTheme.Color.accent)
            }

            HStack(spacing: 8) {
                DailyMetricTile(title: "לטיפול", value: "\(needsAttention)", icon: "exclamationmark.triangle.fill", color: .orange)
                DailyMetricTile(title: "היום", value: "\(installsToday)", icon: "wrench.and.screwdriver.fill", color: OrdexTheme.Color.accent)
                DailyMetricTile(title: "סה\"כ", value: "\(orders.count)", icon: "shippingbox.fill", color: OrdexTheme.Color.success)
            }
        }
        .padding(14)
        .ordexGlassSurface(cornerRadius: 12, tint: OrdexTheme.Color.surfaceTint)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(OrdexTheme.Color.border.opacity(0.55), lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("סיכום תפעול יומי")
        .accessibilityValue("\(orders.count) הזמנות, \(needsAttention) דורשות טיפול, \(installsToday) התקנות היום")
    }
}

private struct DailyOpsSection: View {
    let section: DailyOpsSectionModel
    let actionForOrder: (Order, DailyOpsBucket) -> OrderAction?
    let onPresentAction: (Order, OrderAction) -> Void
    let onCall: (Order) -> Void
    let onWhatsApp: (Order) -> Void
    let onNavigate: (Order) -> Void
    var actionFocus: AccessibilityFocusState<DailyOpsActionFocus?>.Binding

    var body: some View {
        Section {
            if section.orders.isEmpty {
                Text(section.bucket.emptyMessage)
                    .font(.caption)
                    .foregroundStyle(OrdexTheme.Color.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 8)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            } else {
                ForEach(section.orders) { order in
                    DailyOpsOrderRow(
                        order: order,
                        bucket: section.bucket,
                        primaryAction: actionForOrder(order, section.bucket),
                        onPresentAction: onPresentAction,
                        onCall: onCall,
                        onWhatsApp: onWhatsApp,
                        onNavigate: onNavigate,
                        actionFocus: actionFocus
                    )
                    .padding(.vertical, 4)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    .swipeActions(edge: .leading, allowsFullSwipe: false) {
                        if section.bucket == .installationsToday {
                            Button {
                                onPresentAction(order, OrderActionPresentation.markInstalledAction(for: order))
                            } label: {
                                Label("הותקן", systemImage: "checkmark.seal.fill")
                            }
                            .tint(OrdexTheme.Color.success)
                        }
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        if section.bucket == .installationsToday {
                            Button {
                                onPresentAction(order, OrderActionPresentation.reportIssueAction(for: order))
                            } label: {
                                Label("בעיה", systemImage: "exclamationmark.triangle.fill")
                            }
                            .tint(.orange)

                            Button {
                                onPresentAction(order, OrderActionPresentation.partialInstallAction(for: order))
                            } label: {
                                Label("חלקית", systemImage: "wrench.and.screwdriver.fill")
                            }
                            .tint(.ordexEmerald)
                        }
                    }
                }
            }
        } header: {
            DailyOpsSectionHeader(bucket: section.bucket, count: section.orders.count)
        }
    }
}

private struct DailyOpsSectionHeader: View {
    let bucket: DailyOpsBucket
    let count: Int

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: bucket.icon)
                .font(.caption.bold())
                .foregroundStyle(OrdexTheme.Color.accent)
            Text(bucket.title)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(OrdexTheme.Color.textPrimary)
            Spacer()
            Text("\(count)")
                .font(.caption.monospacedDigit().weight(.semibold))
                .foregroundStyle(OrdexTheme.Color.textSecondary)
        }
        .padding(.vertical, 4)
        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
        .accessibilityLabel("\(bucket.title), \(count) הזמנות")
    }
}

// MARK: - Rows

private struct DailyOpsOrderRow: View {
    let order: Order
    let bucket: DailyOpsBucket
    let primaryAction: OrderAction?
    let onPresentAction: (Order, OrderAction) -> Void
    let onCall: (Order) -> Void
    let onWhatsApp: (Order) -> Void
    let onNavigate: (Order) -> Void
    var actionFocus: AccessibilityFocusState<DailyOpsActionFocus?>.Binding

    private var addressText: String {
        [order.city, order.addressLine]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }

    private var itemSummary: String {
        let units = order.items.reduce(0) { $0 + $1.qty }
        if units > 0 {
            return "\(units) יחידות"
        }
        return "\(order.items.count) פריטים"
    }

    private var scheduledText: String? {
        guard let scheduledAt = order.scheduledAt else { return nil }
        if Calendar.current.isDateInToday(scheduledAt) {
            return scheduledAt.formatted(.dateTime.hour().minute())
        }
        return scheduledAt.formatted(.dateTime.day().month().hour().minute())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            NavigationLink(value: order.id) {
                summary
            }
            .buttonStyle(.plain)

            HStack(spacing: 8) {
                if let primaryAction {
                    DailyOpsActionButton(title: primaryAction.title, icon: icon(for: primaryAction.type), color: primaryColor(for: primaryAction)) {
                        if primaryAction.type == .callCustomer {
                            onCall(order)
                        } else {
                            onPresentAction(order, primaryAction)
                        }
                    }
                    .accessibilityFocused(actionFocus, equals: .orderAction(order.id, primaryAction.id))
                }

                if bucket == .installationsToday {
                    DailyOpsActionButton(title: "ניווט", icon: "location.fill", color: .blue) {
                        onNavigate(order)
                    }
                    DailyOpsActionButton(title: "בעיה", icon: "exclamationmark.triangle.fill", color: .orange) {
                        onPresentAction(order, OrderActionPresentation.reportIssueAction(for: order))
                    }
                } else {
                    DailyOpsIconButton(label: "התקשר ללקוח", icon: "phone.fill", color: .green, isDisabled: order.customerPhone == nil) {
                        onCall(order)
                    }
                    DailyOpsIconButton(label: "פתח וואטסאפ ללקוח", icon: "message.fill", color: .ordexEmerald, isDisabled: order.customerPhone == nil) {
                        onWhatsApp(order)
                    }
                    DailyOpsIconButton(label: "פתח ניווט", icon: "location.fill", color: .blue, isDisabled: addressText.isEmpty) {
                        onNavigate(order)
                    }
                }
            }
        }
        .padding(OrdexTheme.Spacing.m)
        .ordexGlassSurface(cornerRadius: 12, tint: bucket.tintColor.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(OrdexTheme.Color.border.opacity(0.5), lineWidth: 1)
        }
        .accessibilityElement(children: .contain)
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                StatusBadge(status: order.status)
                Text("#\(order.number) · \(order.customerName ?? "לקוח מזדמן")")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(OrdexTheme.Color.textPrimary)
                    .lineLimit(1)
                Spacer(minLength: 8)
                if let scheduledText {
                    Text(scheduledText)
                        .font(.caption.monospacedDigit().weight(.semibold))
                        .foregroundStyle(OrdexTheme.Color.accent)
                }
            }

            if !addressText.isEmpty {
                Text(addressText)
                    .font(.caption)
                    .foregroundStyle(OrdexTheme.Color.textSecondary)
                    .lineLimit(1)
            }

            HStack(spacing: 6) {
                Text(itemSummary)
                Text("·")
                Text(nextActionText)
            }
            .font(.caption)
            .foregroundStyle(OrdexTheme.Color.textSecondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilitySummary)
        .accessibilityHint("פתח פרטי הזמנה")
    }

    private var accessibilitySummary: String {
        [
            "הזמנה \(order.number)",
            order.customerName ?? "לקוח מזדמן",
            "סטטוס \(order.status.hebrewLabel)",
            addressText.isEmpty ? nil : addressText,
            scheduledText.map { "שעה \($0)" },
            itemSummary,
            "פעולה הבאה \(nextActionText)",
        ]
        .compactMap { $0 }
        .joined(separator: ", ")
    }

    private var nextActionText: String {
        if let primaryAction {
            return primaryAction.title
        }
        switch bucket {
        case .needsAttention: return "פתח הזמנה"
        case .upcoming: return "מתוזמן"
        default: return order.status.hebrewLabel
        }
    }

    private func icon(for type: OrderActionType) -> String {
        switch type {
        case .callCustomer: return "phone.fill"
        case .receiveItems: return "arrow.down.circle.fill"
        case .scheduleInstallation: return "calendar.badge.plus"
        case .prepareShipment: return "shippingbox.fill"
        case .updateStatus: return "checkmark.seal.fill"
        default: return "arrow.forward.circle.fill"
        }
    }

    private func primaryColor(for action: OrderAction) -> Color {
        switch action.type {
        case .callCustomer: return .green
        case .receiveItems: return .orange
        case .scheduleInstallation: return .indigo
        case .prepareShipment: return .blue
        case .updateStatus: return OrdexTheme.Color.success
        default: return OrdexTheme.Color.accent
        }
    }
}

private struct DailyOpsActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.caption.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 44)
                .ordexGlassSurface(cornerRadius: 9, tint: color.opacity(0.12), isInteractive: true)
                .foregroundStyle(color)
                .clipShape(RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
        .accessibilityLabel(title)
    }
}

private struct DailyOpsIconButton: View {
    let label: String
    let icon: String
    let color: Color
    let isDisabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .frame(minWidth: 44, minHeight: 44)
                .ordexGlassSurface(cornerRadius: 9, tint: color.opacity(isDisabled ? 0.04 : 0.12), isInteractive: !isDisabled)
                .foregroundStyle(isDisabled ? OrdexTheme.Color.textSecondary.opacity(0.7) : color)
                .clipShape(RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .contentShape(Rectangle())
        .accessibilityLabel(label)
    }
}

// MARK: - Supporting Views

private struct TodayDateStrip: View {
    let selectedDate: Date
    let onSelectDate: (Date) -> Void

    private var dates: [Date] {
        (-1...5).compactMap { Calendar.current.date(byAdding: .day, value: $0, to: .now) }
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                dateChips
            }
            Divider().opacity(0.4)
        }
        .ordexGlassSurface(cornerRadius: 0, tint: OrdexTheme.Color.surfaceTint)
        .accessibilityLabel("בחירת תאריך")
    }

    @ViewBuilder
    private var dateChips: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: 10) {
                chipsRow
            }
        } else {
            chipsRow
        }
    }

    private var chipsRow: some View {
        HStack(spacing: 8) {
            ForEach(dates, id: \.self) { date in
                DateChipButton(
                    date: date,
                    isSelected: Calendar.current.isDate(date, inSameDayAs: selectedDate),
                    action: { onSelectDate(date) }
                )
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}

private struct DailyMetricTile: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.caption.weight(.bold))
                .frame(width: 24, height: 24)
                .ordexGlassSurface(cornerRadius: 7, tint: color.opacity(0.12))
                .foregroundStyle(color)
                .clipShape(RoundedRectangle(cornerRadius: 7))
            VStack(alignment: .leading, spacing: 1) {
                Text(value)
                    .font(.subheadline.monospacedDigit().weight(.bold))
                    .foregroundStyle(OrdexTheme.Color.textPrimary)
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(OrdexTheme.Color.textSecondary)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .ordexGlassSurface(cornerRadius: 10, tint: color.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(title)
        .accessibilityValue(value)
    }
}

private struct DateChipButton: View {
    let date: Date
    let isSelected: Bool
    let action: () -> Void

    private var isToday: Bool { Calendar.current.isDateInToday(date) }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text(date.formatted(.dateTime.weekday(.abbreviated)))
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(isSelected ? OrdexTheme.Color.accent : OrdexTheme.Color.textSecondary)
                Text(date.formatted(.dateTime.day()))
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(isSelected ? OrdexTheme.Color.accent : OrdexTheme.Color.textPrimary)
            }
            .frame(width: 48, height: 52)
            .ordexGlassSurface(
                cornerRadius: 12,
                tint: isSelected ? OrdexTheme.Color.accent.opacity(0.18) : OrdexTheme.Color.surfaceTint.opacity(0.5),
                isInteractive: true
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay {
                if isToday && !isSelected {
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(OrdexTheme.Color.accent.opacity(0.5), lineWidth: 1.5)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var accessibilityLabel: String {
        let day = date.formatted(.dateTime.weekday(.wide).day().month())
        return isToday ? "היום, \(day)" : day
    }
}

private struct DailyOpsEmptyState: View {
    let selectedDate: Date

    var body: some View {
        ContentUnavailableView {
            Label("אין עבודה פתוחה", systemImage: "checkmark.circle")
        } description: {
            Text("לא נמצאו הזמנות פעילות ל-\(selectedDate.formatted(.dateTime.day().month().year()))")
        }
    }
}
