import SwiftUI

struct OrderItemsSection: View {
    let items: [OrderItem]

    var body: some View {
        VStack(alignment: .leading, spacing: OrdexTheme.Spacing.m) {
            if items.isEmpty {
                EmptyStateView(icon: "cube.box", title: "אין פריטים", message: "לא נמצאו פריטים בהזמנה זו")
                    .padding(.vertical, 40)
            } else {
                ForEach(items) { item in
                    itemRow(item)
                }
            }
        }
    }

    @ViewBuilder
    private func itemRow(_ item: OrderItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header: Name and Status
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name)
                        .font(.headline)
                        .foregroundColor(OrdexTheme.Color.textPrimary)
                    
                    if let sku = item.sku, !sku.isEmpty {
                        Text("SKU: \(sku)")
                            .font(.caption)
                            .foregroundColor(OrdexTheme.Color.textSecondary)
                    }
                }
                
                Spacer()
                
                if let status = item.allocationStatus {
                    AllocationStatusBadge(status: status)
                }
            }

            // Progress Bars: Received and Installed
            VStack(alignment: .leading, spacing: 10) {
                if let received = item.receivedQuantity {
                    progressRow(
                        current: received,
                        total: item.qty,
                        label: received >= item.qty ? "התקבל" : "בתהליך קליטה",
                        icon: received >= item.qty ? "checkmark.circle.fill" : "shippingbox.and.arrow.backward.fill",
                        color: received >= item.qty ? .green : .orange
                    )
                }
                
                if let installed = item.installedQuantity {
                    progressRow(
                        current: installed,
                        total: item.qty,
                        label: installed >= item.qty ? "הותקן" : "בתהליך התקנה",
                        icon: installed >= item.qty ? "house.fill" : "hammer.fill",
                        color: installed >= item.qty ? .blue : .purple
                    )
                }
                
                if item.receivedQuantity == nil && item.installedQuantity == nil {
                    HStack {
                        Image(systemName: "cube.box")
                            .font(.caption)
                            .foregroundColor(OrdexTheme.Color.textSecondary)
                        Text("\(item.qty) יחידות")
                            .font(.subheadline.weight(.medium))
                            .foregroundColor(OrdexTheme.Color.textPrimary)
                    }
                }
            }
            .padding(.vertical, 4)

            // Footer: Supplier and Price
            HStack {
                if let supplier = item.supplierName {
                    Label(supplier, systemImage: "building.2")
                        .font(.caption)
                        .foregroundColor(OrdexTheme.Color.textSecondary)
                }
                
                Spacer()
                
                Text(item.displayTotal)
                    .font(.subheadline.bold())
                    .foregroundColor(OrdexTheme.Color.accent)
            }

            if let remarks = item.remarks, !remarks.isEmpty {
                Text(remarks)
                    .font(.caption.italic())
                    .foregroundColor(OrdexTheme.Color.textSecondary)
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(OrdexTheme.Color.background.opacity(0.5))
                    .cornerRadius(6)
            }
        }
        .padding(16)
        .background(OrdexTheme.Color.surface)
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(OrdexTheme.Color.border.opacity(0.1), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.03), radius: 5, x: 0, y: 2)
    }

    @ViewBuilder
    private func progressRow(current: Int, total: Int, label: String, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Label(label, systemImage: icon)
                    .font(.caption.bold())
                    .foregroundColor(color)
                
                Spacer()
                
                Text("\(current) / \(total)")
                    .font(.caption.monospacedDigit())
                    .foregroundColor(OrdexTheme.Color.textSecondary)
            }
            
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(OrdexTheme.Color.border.opacity(0.3))
                        .frame(height: 6)
                    
                    Capsule()
                        .fill(color)
                        .frame(width: geo.size.width * CGFloat(min(Double(current) / Double(max(1, total)), 1.0)), height: 6)
                }
            }
            .frame(height: 6)
        }
    }
}

private struct AllocationStatusBadge: View {
    let status: AllocationStatus

    var body: some View {
        Text(status.hebrewLabel)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color(hex: status.hexColor).opacity(0.15))
            .foregroundStyle(Color(hex: status.hexColor))
            .clipShape(Capsule())
    }
}
