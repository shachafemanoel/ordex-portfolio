import SwiftUI

struct OrderPinView: View {
    let order: GeoOrder

    private var shortNumber: String {
        let digits = order.number.filter(\.isNumber)
        return String(digits.suffix(4))
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(statusColor)
                .frame(width: 40, height: 40)
                .overlay(
                    Circle()
                        .stroke(Color.white, lineWidth: 2)
                )
                .shadow(color: .black.opacity(0.3), radius: 4, x: 0, y: 2)
            
            Text(shortNumber)
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(.white)
        }
    }
    
    private var statusColor: Color {
        // Map domain status to theme colors
        switch order.status {
        case .toDo, .callBack, .pendingApproval: return OrdexTheme.Color.warning
        case .processing, .confirmed, .poCreated, .awaitingStock, .partiallySupplied: return OrdexTheme.Color.accent
        case .ready, .readyForInstall, .installScheduling, .awaitingInstall, .scheduled: return OrdexTheme.Color.accent
        case .supplied, .installed, .completed, .invoiced: return OrdexTheme.Color.success
        case .cancelled, .refunded, .onHold: return OrdexTheme.Color.error
        default: return OrdexTheme.Color.accent
        }
    }
}

