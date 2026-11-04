import SwiftUI

struct OrderRowView: View {
    let order: Order

    var body: some View {
        HStack(spacing: OrdexTheme.Spacing.m) {
            // Left Indicator / Number Circle
            Circle()
                .fill(OrdexTheme.Color.accent.opacity(0.1))
                .frame(width: 44, height: 44)
                .overlay {
                    Text(order.number.suffix(2))
                        .font(.system(.subheadline, design: .monospaced).bold())
                        .foregroundColor(OrdexTheme.Color.accent)
                }
            
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(order.customerName ?? "לקוח מזדמן")
                        .font(.headline)
                        .foregroundColor(OrdexTheme.Color.textPrimary)
                    
                    Spacer()
                    
                    PriorityBadge(priority: order.priority)
                }
                
                HStack {
                    Text("#\(order.number)")
                        .font(.caption.monospaced())
                        .foregroundColor(OrdexTheme.Color.textSecondary)
                    
                    if let city = order.city {
                        Text("•")
                            .foregroundColor(OrdexTheme.Color.border)
                        Text(city)
                            .font(.caption)
                            .foregroundColor(OrdexTheme.Color.textSecondary)
                    }
                }
                
                HStack {
                    if let scheduledAt = order.scheduledAt {
                        Label(scheduledAt.hebrewDateOnly, systemImage: "calendar")
                            .font(.caption2)
                            .foregroundColor(OrdexTheme.Color.textSecondary)
                    }
                    
                    Spacer()
                    
                    StatusBadge(status: order.status)
                }
                .padding(.top, 4)
            }
        }
        .padding(OrdexTheme.Spacing.m)
        .background(OrdexTheme.Color.surface.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .stroke(OrdexTheme.Color.border.opacity(0.5), lineWidth: 1)
        }
        .shadow(color: Color.black.opacity(0.1), radius: 4, x: 0, y: 2)
    }
}

