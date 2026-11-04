import SwiftUI

struct OrderPinCallout: View {
    let order: GeoOrder
    let onOpen: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("#\(order.number)")
                    .font(.headline)
                    .foregroundColor(OrdexTheme.Color.textPrimary)
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(OrdexTheme.Color.textSecondary)
                }
            }

            if let name = order.customerName {
                Text(name)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(OrdexTheme.Color.textPrimary)
            }

            if let city = order.city {
                Label(city, systemImage: "mappin.and.ellipse")
                    .font(.caption)
                    .foregroundColor(OrdexTheme.Color.textSecondary)
            }

            HStack {
                StatusBadge(status: order.status)
                Spacer()
                Button("פתח הזמנה", action: onOpen)
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(OrdexTheme.Color.accent)
                    .foregroundColor(.white)
                    .cornerRadius(8)
            }
        }
        .padding(16)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(OrdexTheme.Color.border, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 5)
    }
}

