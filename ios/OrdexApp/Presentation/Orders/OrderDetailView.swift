import SwiftUI

struct OrderDetailView: View {
    let orderId: String

    @Environment(\.orderRepository) private var repository
    @AccessibilityFocusState private var actionFocus: OrderDetailActionFocus?
    @State private var viewModel: OrderDetailViewModel?
    @State private var showStatusSheet = false
    @State private var activeOrderAction: ActiveOrderAction? = nil

    var body: some View {
        ZStack {
            OrdexTheme.Color.background.ignoresSafeArea()

            if let viewModel {
                ResourceView(resource: viewModel.state, onRetry: { Task { await viewModel.load() } }) { details in
                    orderContent(details, vm: viewModel)
                }
            } else {
                LoadingView()
            }
        }
        .navigationTitle(viewModel?.state.data.map { "#\($0.order.number)" } ?? "הזמנה")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if viewModel?.isPerformingAction == true {
                    ProgressView().tint(OrdexTheme.Color.accent)
                }
            }
        }
        .task {
            if viewModel == nil {
                viewModel = OrderDetailViewModel(orderId: orderId, repository: repository)
                await viewModel?.load()
            }
        }
        .sheet(isPresented: $showStatusSheet) {
            if let details = viewModel?.state.data {
                StatusUpdateSheet(
                    currentStatus: details.order.status,
                    isPresented: $showStatusSheet
                ) { newStatus, reason in
                    OrdexTheme.Haptics.impact(.medium)
                    await viewModel?.updateStatus(to: newStatus, reason: reason)
                }
                .onDisappear {
                    restoreFocus(to: .statusUpdate)
                }
            }
        }
        .sheet(item: $activeOrderAction) { presentation in
            OrderActionSheet(order: presentation.order, action: presentation.action) { payload in
                activeOrderAction = nil
                handleAction(presentation, payload: payload)
            } onCancel: {
                activeOrderAction = nil
            }
            .onDisappear {
                restoreFocus(to: .action(presentation.action.id))
            }
        }
    }

    @ViewBuilder
    private func orderContent(_ details: OrderDetails, vm: OrderDetailViewModel) -> some View {
        ScrollView {
            VStack(spacing: OrdexTheme.Spacing.m) {
                OrderDetailHeaderSection(
                    order: details.order,
                    suggestedAction: suggestedAction(from: details.availableActions),
                    onAction: present(action:)
                )

                OrderCustomerSection(
                    order: details.order,
                    onCall: call(order:),
                    onWhatsApp: whatsapp(order:),
                    onNavigate: navigate(to:)
                )

                OrderItemsWorkflowSection(items: details.order.items)

                OrderWorkflowSection(
                    order: details.order,
                    actions: details.availableActions,
                    isLoading: vm.isPerformingAction,
                    onAction: present(action:),
                    onGenericStatusUpdate: presentStatusUpdate,
                    actionFocus: $actionFocus
                )

                OrderDetailActivitySection(
                    timeline: details.timeline,
                    notes: details.order.orderNotes ?? [],
                    noteText: Bindable(vm).noteText,
                    isSubmitting: vm.isSubmittingNote,
                    onAddNote: { Task { await vm.addNote() } }
                )
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .padding(.bottom, 96)
        }
        .safeAreaInset(edge: .bottom) {
            OrderActionsFooter(
                order: details.order,
                actions: details.availableActions,
                isLoading: vm.isPerformingAction,
                onAction: present(action:),
                onGenericStatusUpdate: presentStatusUpdate,
                actionFocus: $actionFocus
            )
        }
    }

    private func suggestedAction(from actions: [OrderAction]) -> OrderAction? {
        actions.first(where: \.isPrimary) ?? actions.first
    }

    private func present(action: OrderAction) {
        guard let order = viewModel?.state.data?.order else { return }
        OrdexTheme.Haptics.impact(.light)
        actionFocus = .action(action.id)
        activeOrderAction = ActiveOrderAction(order: order, action: action)
    }

    private func presentStatusUpdate() {
        actionFocus = .statusUpdate
        showStatusSheet = true
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

    private func handleAction(_ presentation: ActiveOrderAction, payload: OrderActionPayload?) {
        OrdexTheme.Haptics.impact(.medium)
        if OrderActionPresentation.shouldOpenStatusSheet(action: presentation.action, payload: payload) {
            showStatusSheet = true
            return
        }
        guard OrderActionPresentation.shouldExecuteRemote(action: presentation.action, payload: payload) else {
            return
        }
        Task {
            await viewModel?.performAction(presentation.action, payload: payload)
        }
    }

    private func addressText(for order: Order) -> String {
        [order.addressLine, order.city]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }

    private func restoreFocus(to focus: OrderDetailActionFocus) {
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(100))
            actionFocus = focus
        }
    }
}

private enum OrderDetailActionFocus: Hashable {
    case action(String)
    case statusUpdate
}

// MARK: - Header

private struct OrderDetailHeaderSection: View {
    let order: Order
    let suggestedAction: OrderAction?
    let onAction: (OrderAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("#\(order.number)")
                        .font(.title3.monospacedDigit().weight(.bold))
                        .foregroundStyle(OrdexTheme.Color.textPrimary)
                    Text(order.customerName ?? "לקוח מזדמן")
                        .font(.headline)
                        .foregroundStyle(OrdexTheme.Color.textPrimary)
                }
                Spacer()
                StatusBadge(status: order.status)
            }

            if let suggestedAction {
                HStack(spacing: 10) {
                    Label(suggestedAction.title, systemImage: icon(for: suggestedAction.type))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(OrdexTheme.Color.accent)
                    Spacer()
                    Button("בצע") {
                        onAction(suggestedAction)
                    }
                    .font(.caption.weight(.bold))
                    .buttonStyle(.borderedProminent)
                    .tint(OrdexTheme.Color.accent)
                }
            } else {
                Text("אין פעולה מומלצת כרגע")
                    .font(.subheadline)
                    .foregroundStyle(OrdexTheme.Color.textSecondary)
            }
        }
        .padding(16)
        .ordexGlassSurface(cornerRadius: 12, tint: OrdexTheme.Color.surfaceTint)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(OrdexTheme.Color.border.opacity(0.55), lineWidth: 1)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("פרטי הזמנה \(order.number)")
        .accessibilityValue("\(order.customerName ?? "לקוח מזדמן"), סטטוס \(order.status.hebrewLabel)")
    }

    private func icon(for type: OrderActionType) -> String {
        switch type {
        case .callCustomer: return "phone.fill"
        case .whatsappCustomer: return "message.fill"
        case .openNavigation: return "location.fill"
        case .receiveItems: return "arrow.down.circle.fill"
        case .scheduleInstallation: return "calendar.badge.plus"
        case .partialInstall: return "wrench.and.screwdriver.fill"
        case .reportIssue: return "exclamationmark.triangle.fill"
        default: return "arrow.forward.circle.fill"
        }
    }
}

// MARK: - Customer

private struct OrderCustomerSection: View {
    let order: Order
    let onCall: (Order) -> Void
    let onWhatsApp: (Order) -> Void
    let onNavigate: (Order) -> Void

    private var addressText: String {
        [order.addressLine, order.city]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }

    var body: some View {
        DetailSectionContainer(title: "לקוח", icon: "person.fill") {
            VStack(alignment: .leading, spacing: 12) {
                if let phone = order.customerPhone, !phone.isEmpty {
                    LabeledContent("טלפון", value: phone)
                }
                if !addressText.isEmpty {
                    LabeledContent("כתובת", value: addressText)
                }
                if order.customerPhone == nil && addressText.isEmpty {
                    Text("חסרים פרטי קשר או כתובת")
                        .font(.subheadline)
                        .foregroundStyle(OrdexTheme.Color.textSecondary)
                }

                HStack(spacing: 8) {
                    DetailQuickButton(title: "שיחה", icon: "phone.fill", color: .green, isDisabled: order.customerPhone == nil) {
                        onCall(order)
                    }
                    DetailQuickButton(title: "וואטסאפ", icon: "message.fill", color: .ordexEmerald, isDisabled: order.customerPhone == nil) {
                        onWhatsApp(order)
                    }
                    DetailQuickButton(title: "ניווט", icon: "location.fill", color: .blue, isDisabled: addressText.isEmpty) {
                        onNavigate(order)
                    }
                }
            }
        }
    }
}

private struct DetailQuickButton: View {
    let title: String
    let icon: String
    let color: Color
    let isDisabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.caption.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 44)
                .ordexGlassSurface(cornerRadius: 9, tint: color.opacity(isDisabled ? 0.04 : 0.12), isInteractive: !isDisabled)
                .foregroundStyle(isDisabled ? OrdexTheme.Color.textSecondary.opacity(0.7) : color)
                .clipShape(RoundedRectangle(cornerRadius: 9))
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .contentShape(Rectangle())
        .accessibilityLabel(title)
    }
}

// MARK: - Items

private struct OrderItemsWorkflowSection: View {
    let items: [OrderItem]

    var body: some View {
        DetailSectionContainer(title: "פריטים", icon: "shippingbox.fill") {
            OrderItemsSection(items: items)
        }
    }
}

// MARK: - Workflow

private struct OrderWorkflowSection: View {
    let order: Order
    let actions: [OrderAction]
    let isLoading: Bool
    let onAction: (OrderAction) -> Void
    let onGenericStatusUpdate: () -> Void
    var actionFocus: AccessibilityFocusState<OrderDetailActionFocus?>.Binding

    var body: some View {
        DetailSectionContainer(title: "פעולות", icon: "bolt.fill") {
            VStack(spacing: 8) {
                if actions.isEmpty {
                    HStack(spacing: 10) {
                        StatusBadge(status: order.status)
                        Spacer()
                        Button("עדכן סטטוס", action: onGenericStatusUpdate)
                            .font(.subheadline.weight(.bold))
                            .buttonStyle(.borderedProminent)
                            .tint(OrdexTheme.Color.accent)
                            .accessibilityFocused(actionFocus, equals: .statusUpdate)
                    }
                } else {
                    ForEach(actions) { action in
                        Button {
                            onAction(action)
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: icon(for: action.type))
                                    .frame(width: 24)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(action.title)
                                        .font(.subheadline.weight(.semibold))
                                    if let subtitle = action.subtitle {
                                        Text(subtitle)
                                            .font(.caption)
                                            .foregroundStyle(OrdexTheme.Color.textSecondary)
                                    }
                                }
                                Spacer()
                                if action.isPrimary {
                                    Text("מומלץ")
                                        .font(.caption2.weight(.bold))
                                        .padding(.horizontal, 7)
                                        .padding(.vertical, 3)
                                        .background(OrdexTheme.Color.accent.opacity(0.12))
                                        .foregroundStyle(OrdexTheme.Color.accent)
                                        .clipShape(Capsule())
                                }
                            }
                            .padding(10)
                            .frame(minHeight: 44)
                            .ordexGlassSurface(cornerRadius: 9, tint: OrdexTheme.Color.surfaceTint)
                            .clipShape(RoundedRectangle(cornerRadius: 9))
                        }
                        .buttonStyle(.plain)
                        .disabled(isLoading)
                        .contentShape(Rectangle())
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel(action.title)
                        .accessibilityValue(action.subtitle ?? "")
                        .accessibilityHint(action.isPrimary ? "פעולה מומלצת להזמנה" : "פעולה זמינה להזמנה")
                        .accessibilityFocused(actionFocus, equals: .action(action.id))
                    }
                }
            }
        }
    }

    private func icon(for type: OrderActionType) -> String {
        switch type {
        case .callCustomer: return "phone.fill"
        case .whatsappCustomer: return "message.fill"
        case .openNavigation: return "map.fill"
        case .receiveItems: return "arrow.down.circle.fill"
        case .scheduleInstallation: return "calendar.badge.plus"
        case .reportIssue: return "exclamationmark.triangle.fill"
        case .partialInstall: return "wrench.and.screwdriver.fill"
        case .prepareShipment: return "truck.box.fill"
        case .updateStatus: return "arrow.triangle.2.circlepath"
        default: return "ellipsis.circle.fill"
        }
    }
}

private struct OrderActionsFooter: View {
    let order: Order
    let actions: [OrderAction]
    let isLoading: Bool
    let onAction: (OrderAction) -> Void
    let onGenericStatusUpdate: () -> Void
    var actionFocus: AccessibilityFocusState<OrderDetailActionFocus?>.Binding

    private var primaryAction: OrderAction? {
        actions.first(where: \.isPrimary) ?? actions.first
    }

    var body: some View {
        VStack(spacing: 0) {
            Divider().background(OrdexTheme.Color.border.opacity(0.5))
            HStack(spacing: 10) {
                StatusBadge(status: order.status)
                if let primaryAction {
                    Button {
                        onAction(primaryAction)
                    } label: {
                        HStack(spacing: 8) {
                            if isLoading {
                                ProgressView()
                                    .tint(.white)
                                    .scaleEffect(0.85)
                            }
                            Text(primaryAction.title)
                                .font(.subheadline.weight(.bold))
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(OrdexTheme.Color.accent)
                    .disabled(isLoading)
                    .accessibilityFocused(actionFocus, equals: .action(primaryAction.id))
                } else {
                    Button("עדכן סטטוס", action: onGenericStatusUpdate)
                        .font(.subheadline.weight(.bold))
                        .buttonStyle(.borderedProminent)
                        .tint(OrdexTheme.Color.accent)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .accessibilityFocused(actionFocus, equals: .statusUpdate)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .ordexGlassSurface(cornerRadius: 0, tint: OrdexTheme.Color.surfaceTint)
    }
}

// MARK: - Timeline / Notes

private struct OrderDetailActivitySection: View {
    let timeline: OpsActivityTimeline?
    let notes: [OrderNote]
    @Binding var noteText: String
    let isSubmitting: Bool
    let onAddNote: () -> Void

    var body: some View {
        DetailSectionContainer(title: "עדכונים", icon: "clock.fill") {
            VStack(alignment: .leading, spacing: 14) {
                OrderTimelineSection(timeline: timeline)

                Divider().opacity(0.35)

                OrderNotesSection(
                    notes: notes,
                    noteText: $noteText,
                    isSubmitting: isSubmitting,
                    onSubmit: onAddNote
                )
            }
        }
    }
}

// MARK: - Shared

private struct DetailSectionContainer<Content: View>: View {
    let title: String
    let icon: String
    let content: Content

    init(title: String, icon: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(title, systemImage: icon)
                .font(.headline.weight(.bold))
                .foregroundStyle(OrdexTheme.Color.textPrimary)
                .accessibilityAddTraits(.isHeader)
            content
        }
        .padding(16)
        .ordexGlassSurface(cornerRadius: 12, tint: OrdexTheme.Color.surfaceTint)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(OrdexTheme.Color.border.opacity(0.55), lineWidth: 1)
        }
    }
}
