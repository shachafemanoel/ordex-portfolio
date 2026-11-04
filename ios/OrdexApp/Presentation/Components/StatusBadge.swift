import SwiftUI

struct StatusBadge: View {
    let status: OrderStatus
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.colorSchemeContrast) private var contrast

    private var foregroundColor: Color {
        status.badgeForegroundColor(colorScheme: colorScheme)
    }

    private var backgroundOpacity: Double {
        contrast == .increased ? 0.24 : 0.14
    }

    var body: some View {
        Text(status.hebrewLabel)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(foregroundColor.opacity(backgroundOpacity))
            .foregroundStyle(foregroundColor)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(foregroundColor.opacity(0.45), lineWidth: 1))
            .accessibilityLabel("סטטוס")
            .accessibilityValue(status.hebrewLabel)
    }
}

private extension OrderStatus {
    func badgeForegroundColor(colorScheme: ColorScheme) -> Color {
        switch self {
        case .received, .draft, .toDo, .closed, .unknown:
            return colorScheme == .dark ? Color(hex: "#CBD5E1") : Color(hex: "#475569")
        case .processing, .inTransit, .installation, .callBack, .confirmed, .poCreated,
             .installScheduling, .scheduled:
            return colorScheme == .dark ? Color(hex: "#93C5FD") : Color(hex: "#1D4ED8")
        case .ready, .completed, .readyForInstall, .installed, .supplied, .invoiced:
            return colorScheme == .dark ? Color(hex: "#6EE7B7") : Color(hex: "#047857")
        case .pendingApproval, .awaitingStock, .partiallySupplied, .awaitingInstall, .onHold:
            return colorScheme == .dark ? Color(hex: "#FCD34D") : Color(hex: "#B45309")
        case .cancelled, .refunded:
            return colorScheme == .dark ? Color(hex: "#FCA5A5") : Color(hex: "#B91C1C")
        }
    }
}
