import Foundation

enum OrderActionType: String, Codable, Hashable {
    case callCustomer = "CALL_CUSTOMER"
    case whatsappCustomer = "WHATSAPP_CUSTOMER"
    case openNavigation = "OPEN_NAVIGATION"
    case confirmDetails = "CONFIRM_DETAILS"
    case confirmPayment = "CONFIRM_PAYMENT"
    case checkStock = "CHECK_STOCK"
    case createPurchaseOrder = "CREATE_PURCHASE_ORDER"
    case receiveItems = "RECEIVE_ITEMS"
    case scheduleInstallation = "SCHEDULE_INSTALLATION"
    case markSupplied = "MARK_SUPPLIED"
    case prepareShipment = "PREPARE_SHIPMENT"
    case reportIssue = "REPORT_ISSUE"
    case updateStatus = "UPDATE_STATUS"
    case partialInstall = "PARTIAL_INSTALL"
    case unknown = "UNKNOWN"

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self)
        self = OrderActionType(rawValue: raw) ?? .unknown
    }
}

struct OrderAction: Codable, Identifiable, Hashable {
    let id: String
    let type: OrderActionType
    let title: String
    let subtitle: String?
    let isPrimary: Bool
    let requiresConfirmation: Bool
    let targetStatus: OrderStatus?

    enum CodingKeys: String, CodingKey {
        case id, type, title, subtitle, isPrimary, requiresConfirmation, targetStatus
    }

    init(
        id: String,
        type: OrderActionType,
        title: String,
        subtitle: String? = nil,
        isPrimary: Bool = false,
        requiresConfirmation: Bool = false,
        targetStatus: OrderStatus? = nil
    ) {
        self.id = id
        self.type = type
        self.title = title
        self.subtitle = subtitle
        self.isPrimary = isPrimary
        self.requiresConfirmation = requiresConfirmation
        self.targetStatus = targetStatus
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        type = try container.decode(OrderActionType.self, forKey: .type)
        title = try container.decode(String.self, forKey: .title)
        subtitle = try container.decodeIfPresent(String.self, forKey: .subtitle)
        isPrimary = try container.decodeIfPresent(Bool.self, forKey: .isPrimary) ?? false
        requiresConfirmation = try container.decodeIfPresent(Bool.self, forKey: .requiresConfirmation) ?? false
        // Decode targetStatus safely; unknown value becomes nil
        if let rawStatus = try container.decodeIfPresent(String.self, forKey: .targetStatus) {
            targetStatus = OrderStatus(rawValue: rawStatus)
        } else {
            targetStatus = nil
        }
    }
}
