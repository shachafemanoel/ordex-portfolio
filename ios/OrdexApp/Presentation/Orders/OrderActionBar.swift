import SwiftUI

struct ActiveOrderAction: Identifiable, Hashable {
    let order: Order
    let action: OrderAction

    var id: String { "\(order.id)-\(action.id)" }
}

enum OrderActionPresentation {
    static func markInstalledAction(for order: Order) -> OrderAction {
        OrderAction(
            id: "mark-installed-\(order.id)",
            type: .updateStatus,
            title: "סמן כהותקן",
            subtitle: "סיים התקנה",
            isPrimary: true,
            requiresConfirmation: true,
            targetStatus: .installed
        )
    }

    static func partialInstallAction(for order: Order) -> OrderAction {
        OrderAction(
            id: "partial-\(order.id)",
            type: .partialInstall,
            title: "התקנה חלקית",
            subtitle: "סמן פריטים שהותקנו",
            requiresConfirmation: true,
            targetStatus: .installed
        )
    }

    static func reportIssueAction(for order: Order) -> OrderAction {
        OrderAction(
            id: "report-\(order.id)",
            type: .reportIssue,
            title: "דווח בעיה",
            subtitle: "בעיה בשטח",
            requiresConfirmation: true
        )
    }

    static func prepareShipmentAction(for order: Order) -> OrderAction {
        OrderAction(
            id: "prepare-shipment-\(order.id)",
            type: .prepareShipment,
            title: "הכן למשלוח",
            subtitle: "סריקה והעמסה",
            isPrimary: true,
            targetStatus: .ready
        )
    }

    static func shouldOpenStatusSheet(action: OrderAction, payload: OrderActionPayload?) -> Bool {
        action.type == .updateStatus && payload?.targetStatus == nil
    }

    static func shouldExecuteRemote(action: OrderAction, payload: OrderActionPayload?) -> Bool {
        switch action.type {
        case .callCustomer, .whatsappCustomer, .openNavigation:
            return false
        case .updateStatus:
            return payload?.targetStatus != nil
        default:
            return true
        }
    }
}

/// Bottom bar that shows context-driven primary actions.
/// Secondary actions are displayed as a horizontal scroll row.
struct OrderActionBar: View {
    let order: Order
    let actions: [OrderAction]
    let isLoading: Bool
    let onAction: (OrderAction) -> Void

    private var primaryAction: OrderAction? { actions.first(where: { $0.isPrimary }) }
    private var secondaryActions: [OrderAction] { actions.filter { !$0.isPrimary } }

    var body: some View {
        VStack(spacing: 8) {
            // Secondary actions
            if !secondaryActions.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(secondaryActions) { action in
                            SecondaryActionButton(action: action, isLoading: isLoading) {
                                onAction(action)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }

            // Primary CTA
            if let primary = primaryAction {
                Button {
                    onAction(primary)
                } label: {
                    HStack(spacing: 8) {
                        if isLoading {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.85)
                        }
                        Text(primary.title)
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(primaryColor(for: primary))
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(isLoading)
                .padding(.horizontal, 16)
                .animation(.easeInOut(duration: 0.2), value: isLoading)
            }
        }
        .padding(.bottom, 8)
        .background(.ultraThinMaterial)
    }

    private func primaryColor(for action: OrderAction) -> Color {
        switch action.type {
        case .callCustomer: return Color.green
        case .markSupplied: return Color.blue
        case .receiveItems: return Color.orange
        case .scheduleInstallation: return Color.indigo
        case .openNavigation: return Color.teal
        default: return Color.accentColor
        }
    }
}

// MARK: - Secondary button
private struct SecondaryActionButton: View {
    let action: OrderAction
    let isLoading: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 4) {
                Image(systemName: iconName(for: action.type))
                    .font(.system(size: 18))
                Text(action.title)
                    .font(.caption2)
                    .lineLimit(1)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .disabled(isLoading)
        .foregroundColor(.primary)
    }

    private func iconName(for type: OrderActionType) -> String {
        switch type {
        case .callCustomer: return "phone.fill"
        case .whatsappCustomer: return "message.fill"
        case .openNavigation: return "map.fill"
        case .checkStock: return "shippingbox.fill"
        case .receiveItems: return "arrow.down.circle.fill"
        case .reportIssue: return "exclamationmark.triangle.fill"
        case .scheduleInstallation: return "calendar.badge.plus"
        case .confirmDetails: return "checkmark.seal.fill"
        case .confirmPayment: return "creditcard.fill"
        case .markSupplied: return "flag.checkered"
        case .prepareShipment: return "truck.box.fill"
        case .updateStatus: return "arrow.triangle.2.circlepath"
        case .partialInstall: return "wrench.adjustable.fill"
        case .createPurchaseOrder: return "cart.badge.plus"
        case .unknown: return "ellipsis.circle.fill"
        }
    }
}
