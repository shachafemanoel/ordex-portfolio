import SwiftUI

enum OrderStatus: String, Codable, CaseIterable, Hashable {
    case received = "RECEIVED"
    case processing = "PROCESSING"
    case ready = "READY"
    case inTransit = "IN_TRANSIT"
    case installation = "INSTALLATION"
    case completed = "COMPLETED"
    case draft = "DRAFT"
    case toDo = "TO_DO"
    case callBack = "CALL_BACK"
    case pendingApproval = "PENDING_APPROVAL"
    case confirmed = "CONFIRMED"
    case poCreated = "PO_CREATED"
    case awaitingStock = "AWAITING_STOCK"
    case partiallySupplied = "PARTIALLY_SUPPLIED"
    case readyForInstall = "READY_FOR_INSTALL"
    case installScheduling = "INSTALL_SCHEDULING"
    case awaitingInstall = "AWAITING_INSTALL"
    case scheduled = "SCHEDULED"
    case installed = "INSTALLED"
    case supplied = "SUPPLIED"
    case invoiced = "INVOICED"
    case closed = "CLOSED"
    case onHold = "ON_HOLD"
    case cancelled = "CANCELLED"
    case refunded = "REFUNDED"
    case unknown = "UNKNOWN"

    var hebrewLabel: String {
        switch self {
        case .received: return "התקבל"
        case .processing: return "בטיפול"
        case .ready: return "מוכן"
        case .inTransit: return "בדרך"
        case .installation: return "בהתקנה"
        case .completed: return "הושלם"
        case .draft: return "טיוטה"
        case .toDo: return "לטיפול"
        case .callBack: return "חזרה ללקוח"
        case .pendingApproval: return "ממתין לאישור"
        case .confirmed: return "אושר"
        case .poCreated: return "נוצרה הזמנת רכש"
        case .awaitingStock: return "ממתין למלאי"
        case .partiallySupplied: return "סופק חלקית"
        case .readyForInstall: return "מוכן להתקנה"
        case .installScheduling: return "תיאום התקנה"
        case .awaitingInstall: return "ממתין להתקנה"
        case .scheduled: return "מתוזמן"
        case .installed: return "הותקן"
        case .supplied: return "סופק"
        case .invoiced: return "חשבונית"
        case .closed: return "נסגר"
        case .onHold: return "מושהה"
        case .cancelled: return "בוטל"
        case .refunded: return "הוחזר"
        case .unknown: return "לא ידוע"
        }
    }

    var hexColor: String {
        switch self {
        case .received, .draft, .toDo, .closed: return "#94a3b8"
        case .processing, .inTransit, .installation, .callBack, .confirmed, .poCreated,
             .installScheduling, .scheduled: return "#3b82f6"
        case .ready, .completed: return "#22c55e"
        case .readyForInstall, .installed, .supplied: return "#10b981"
        case .pendingApproval, .awaitingStock, .partiallySupplied, .awaitingInstall, .onHold: return "#f97316"
        case .cancelled, .refunded: return "#ef4444"
        case .invoiced: return "#22c55e"
        case .unknown: return "#94a3b8"
        }
    }

    var color: Color { Color(hex: hexColor) }

    var group: StatusGroup {
        switch self {
        case .draft, .received, .toDo, .pendingApproval:
            return .open
        case .processing, .callBack, .confirmed, .poCreated, .awaitingStock, .partiallySupplied,
             .readyForInstall, .installScheduling, .awaitingInstall, .scheduled, .ready,
             .inTransit, .installation, .onHold:
            return .active
        case .completed, .installed, .supplied, .invoiced:
            return .completed
        case .cancelled, .refunded, .closed, .unknown:
            return .cancelled
        }
    }

    var allowedTransitions: [OrderStatus] {
        switch self {
        case .received: return [.processing, .completed, .cancelled, .onHold]
        case .processing: return [.ready, .completed, .received, .cancelled, .onHold]
        case .ready: return [.inTransit, .installation, .completed, .processing, .cancelled, .onHold]
        case .inTransit: return [.installation, .completed, .ready, .cancelled]
        case .installation: return [.completed, .ready, .cancelled]
        case .completed: return [.processing]
        case .onHold: return [.received, .processing, .ready, .cancelled]
        case .cancelled: return [.received]
        case .refunded: return []
        case .draft: return [.received, .cancelled]
        case .toDo: return [.received, .processing, .cancelled]
        case .callBack: return [.processing, .received, .cancelled]
        case .pendingApproval: return [.received, .confirmed, .cancelled]
        case .confirmed: return [.received, .processing, .cancelled]
        case .poCreated: return [.processing, .awaitingStock, .cancelled]
        case .awaitingStock: return [.processing, .partiallySupplied, .cancelled]
        case .partiallySupplied: return [.processing, .ready, .cancelled]
        case .readyForInstall: return [.ready, .installation, .scheduled, .cancelled]
        case .installScheduling: return [.ready, .scheduled, .cancelled]
        case .awaitingInstall: return [.installation, .completed, .cancelled]
        case .scheduled: return [.inTransit, .installation, .cancelled]
        case .installed: return [.completed]
        case .supplied: return [.completed]
        case .invoiced: return [.completed]
        case .closed: return [.completed]
        case .unknown: return []
        }
    }

    var isTerminal: Bool {
        switch self {
        case .completed, .supplied, .installed, .closed, .cancelled, .refunded: return true
        default: return false
        }
    }
}

enum StatusGroup: String {
    case open, active, completed, cancelled
}
