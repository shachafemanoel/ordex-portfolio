import SwiftUI

struct DeliveryOpsRow: View {
    let order: Order
    let onCollect: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header: Customer & Time
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(order.customerName ?? "לקוח מזדמן")
                        .font(.headline)
                    
                    if let time = order.scheduledAt?.hebrewTimeOnly {
                        Text(time)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                
                Spacer()
                
                StatusBadge(status: order.status)
            }
            
            // Address line
            let fullAddress = [order.city, order.addressLine].compactMap({ $0 }).joined(separator: ", ")
            if !fullAddress.isEmpty {
                Label(fullAddress, systemImage: "mappin.and.ellipse")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            // Action Grid
            HStack(spacing: 8) {
                // 1. Collect (Internal Ops)
                if order.status != .ready {
                    OpsButton(
                        title: "אסוף",
                        icon: "shippingbox.fill",
                        color: .orange
                    ) {
                        onCollect()
                    }
                }
                
                // 2. Drive (Waze)
                OpsButton(
                    title: "ניווט",
                    icon: "waze", // We'll use a custom image or a generic arrow if waze icon not in SF symbols
                    isWaze: true,
                    color: .blue
                ) {
                    let address = [order.addressLine, order.city].compactMap { $0 }.joined(separator: ", ")
                    ExternalAppLauncher.navigate(to: address, preferWaze: true)
                }
                
                // 3. Call
                OpsButton(
                    title: "התקשר",
                    icon: "phone.fill",
                    color: .green
                ) {
                    if let phone = order.customerPhone {
                        ExternalAppLauncher.call(phone: phone)
                    }
                }
            }
        }
        .padding()
        .background(OrdexTheme.Color.surface)
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(OrdexTheme.Color.border.opacity(0.5), lineWidth: 1)
        )
    }
}

private struct OpsButton: View {
    let title: String
    let icon: String
    var isWaze: Bool = false
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                if isWaze {
                    // Placeholder for Waze icon if SF symbols doesn't have it
                    Image(systemName: "location.fill")
                        .font(.system(size: 20))
                } else {
                    Image(systemName: icon)
                        .font(.system(size: 20))
                }
                Text(title)
                    .font(.caption.bold())
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(color.opacity(0.1))
            .foregroundStyle(color)
            .cornerRadius(12)
        }
    }
}
