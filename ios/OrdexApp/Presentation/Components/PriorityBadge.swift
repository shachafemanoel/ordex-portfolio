import SwiftUI

struct PriorityBadge: View {
    let priority: OrderPriority

    var body: some View {
        Text(priority.hebrewLabel)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color(hex: priority.hexColor).opacity(0.12))
            .foregroundStyle(Color(hex: priority.hexColor))
            .clipShape(Capsule())
    }
}
