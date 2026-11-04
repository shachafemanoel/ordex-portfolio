import SwiftUI

struct OrderTimelineSection: View {
    let timeline: OpsActivityTimeline?

    var body: some View {
        if let events = timeline?.events, !events.isEmpty {
            List(events) { event in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: iconName(for: event.type))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(width: 20)
                        .padding(.top, 2)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(event.title)
                            .font(.subheadline.weight(.medium))
                        if let desc = event.description {
                            Text(desc)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        HStack {
                            if let actor = event.actorName {
                                Text(actor)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(event.createdAt.hebrewFormatted)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(.vertical, 4)
            }
            .listStyle(.plain)
        } else {
            EmptyStateView(icon: "clock", title: "אין היסטוריה", message: "לא נמצאו אירועים בציר הזמן")
        }
    }

    private func iconName(for type: TimelineEventType) -> String {
        switch type {
        case .statusChange: return "arrow.triangle.2.circlepath"
        case .purchaseOrder: return "cart"
        case .task: return "checkmark.circle"
        case .allocation: return "shippingbox"
        case .schedule: return "calendar"
        case .system: return "gear"
        }
    }
}
