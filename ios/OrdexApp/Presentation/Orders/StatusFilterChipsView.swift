import SwiftUI

struct StatusFilterChipsView: View {
    let selectedStatuses: Set<OrderStatus>
    let onToggle: (OrderStatus) -> Void
    let onClear: () -> Void
    @Environment(\.colorScheme) private var colorScheme

    private let displayStatuses: [OrderStatus] = [
        .received, .processing, .ready, .awaitingStock, .partiallySupplied,
        .readyForInstall, .installScheduling, .scheduled, .inTransit,
        .installation, .onHold, .callBack, .completed, .cancelled
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // "All" chip
                Button {
                    onClear()
                } label: {
                    Text("הכל")
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .frame(minHeight: 44)
                        .background(selectedStatuses.isEmpty ? OrdexTheme.Color.textPrimary : OrdexTheme.Color.surfaceTint)
                        .foregroundStyle(selectedStatuses.isEmpty ? OrdexTheme.Color.surface : OrdexTheme.Color.textPrimary)
                        .clipShape(Capsule())
                }

                ForEach(displayStatuses, id: \.self) { status in
                    Button {
                        onToggle(status)
                    } label: {
                        Text(status.hebrewLabel)
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .frame(minHeight: 44)
                            .background(selectedStatuses.contains(status) ? chipFill(for: status) : OrdexTheme.Color.surfaceTint)
                            .foregroundStyle(selectedStatuses.contains(status) ? chipText : OrdexTheme.Color.textPrimary)
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }

    private var chipText: Color {
        colorScheme == .dark ? Color(hex: "#0B1220") : .white
    }

    private func chipFill(for status: OrderStatus) -> Color {
        switch status.group {
        case .open:
            return colorScheme == .dark ? Color(hex: "#CBD5E1") : Color(hex: "#475569")
        case .active:
            return colorScheme == .dark ? Color(hex: "#93C5FD") : Color(hex: "#1D4ED8")
        case .completed:
            return colorScheme == .dark ? Color(hex: "#6EE7B7") : Color(hex: "#047857")
        case .cancelled:
            return colorScheme == .dark ? Color(hex: "#FCA5A5") : Color(hex: "#B91C1C")
        }
    }
}
