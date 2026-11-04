import Foundation

enum OrderPriority: String, Codable {
    case low = "LOW"
    case medium = "MEDIUM"
    case high = "HIGH"
    case urgent = "URGENT"

    var hebrewLabel: String {
        switch self {
        case .low: return "נמוכה"
        case .medium: return "בינונית"
        case .high: return "גבוהה"
        case .urgent: return "דחוף"
        }
    }

    var hexColor: String {
        switch self {
        case .low: return "#94a3b8"
        case .medium: return "#3b82f6"
        case .high: return "#f97316"
        case .urgent: return "#ef4444"
        }
    }
}

enum PaymentStatus: String, Codable {
    case pending = "PENDING"
    case authorized = "AUTHORIZED"
    case paid = "PAID"
    case partial = "PARTIAL"
    case failed = "FAILED"
    case refunded = "REFUNDED"

    var hebrewLabel: String {
        switch self {
        case .pending: return "ממתין לתשלום"
        case .authorized: return "מאושר"
        case .paid: return "שולם"
        case .partial: return "שולם חלקית"
        case .failed: return "נכשל"
        case .refunded: return "הוחזר"
        }
    }
}

struct Order: Codable, Identifiable, Hashable {
    let id: String
    let number: String
    var status: OrderStatus
    let priority: OrderPriority
    let customerName: String?
    let customerEmail: String?
    let customerPhone: String?
    let city: String?
    let addressLine: String?
    let lat: Double?
    let lng: Double?
    let totalCents: Int
    let paidAmountCents: Int
    let paymentStatus: PaymentStatus
    let scheduledAt: Date?
    let scheduledEnd: Date?
    let assignedUserId: String?
    let assignedUserName: String?
    let installerName: String?
    let notes: String?
    let notesInternal: String?
    let createdAt: Date
    let updatedAt: Date
    let items: [OrderItem]
    let orderNotes: [OrderNote]?

    var outstandingBalanceCents: Int { max(0, totalCents - paidAmountCents) }
    var displayTotal: String { totalCents.shekels }
    var displayPaid: String { paidAmountCents.shekels }
    var displayOutstanding: String { outstandingBalanceCents.shekels }

    static func == (lhs: Order, rhs: Order) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    enum CodingKeys: String, CodingKey {
        case id, number, status, priority
        case customerName, customerEmail, customerPhone
        case city, addressLine, lat, lng
        case totalCents, paidAmountCents, paymentStatus
        case scheduledAt, scheduledEnd
        case assignedUserId, assignedUserName, installerName
        case notes, notesInternal, createdAt, updatedAt
        case items, orderNotes
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        id = try container.decode(String.self, forKey: .id)
        number = try container.decodeIfPresent(String.self, forKey: .number) ?? "#000"
        status = try container.decodeIfPresent(OrderStatus.self, forKey: .status) ?? .unknown
        priority = try container.decodeIfPresent(OrderPriority.self, forKey: .priority) ?? .medium
        
        customerName = try container.decodeIfPresent(String.self, forKey: .customerName)
        customerEmail = try container.decodeIfPresent(String.self, forKey: .customerEmail)
        customerPhone = try container.decodeIfPresent(String.self, forKey: .customerPhone)
        
        city = try container.decodeIfPresent(String.self, forKey: .city)
        addressLine = try container.decodeIfPresent(String.self, forKey: .addressLine)
        lat = try container.decodeIfPresent(Double.self, forKey: .lat)
        lng = try container.decodeIfPresent(Double.self, forKey: .lng)
        
        totalCents = try container.decodeIfPresent(Int.self, forKey: .totalCents) ?? 0
        paidAmountCents = try container.decodeIfPresent(Int.self, forKey: .paidAmountCents) ?? 0
        paymentStatus = try container.decodeIfPresent(PaymentStatus.self, forKey: .paymentStatus) ?? .pending
        
        scheduledAt = (try? container.decodeIfPresent(Date.self, forKey: .scheduledAt)) ?? nil
        scheduledEnd = (try? container.decodeIfPresent(Date.self, forKey: .scheduledEnd)) ?? nil
        
        assignedUserId = try container.decodeIfPresent(String.self, forKey: .assignedUserId)
        assignedUserName = try container.decodeIfPresent(String.self, forKey: .assignedUserName)
        installerName = try container.decodeIfPresent(String.self, forKey: .installerName)
        
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        notesInternal = try container.decodeIfPresent(String.self, forKey: .notesInternal)
        
        createdAt = (try? container.decodeIfPresent(Date.self, forKey: .createdAt)) ?? Date()
        updatedAt = (try? container.decodeIfPresent(Date.self, forKey: .updatedAt)) ?? Date()
        
        items = try container.decodeIfPresent([OrderItem].self, forKey: .items) ?? []
        orderNotes = try container.decodeIfPresent([OrderNote].self, forKey: .orderNotes)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(number, forKey: .number)
        try container.encode(status, forKey: .status)
        try container.encode(priority, forKey: .priority)
        try container.encode(customerName, forKey: .customerName)
        try container.encode(customerEmail, forKey: .customerEmail)
        try container.encode(customerPhone, forKey: .customerPhone)
        try container.encode(city, forKey: .city)
        try container.encode(addressLine, forKey: .addressLine)
        try container.encode(lat, forKey: .lat)
        try container.encode(lng, forKey: .lng)
        try container.encode(totalCents, forKey: .totalCents)
        try container.encode(paidAmountCents, forKey: .paidAmountCents)
        try container.encode(paymentStatus, forKey: .paymentStatus)
        try container.encode(scheduledAt, forKey: .scheduledAt)
        try container.encode(scheduledEnd, forKey: .scheduledEnd)
        try container.encode(assignedUserId, forKey: .assignedUserId)
        try container.encode(assignedUserName, forKey: .assignedUserName)
        try container.encode(installerName, forKey: .installerName)
        try container.encode(notes, forKey: .notes)
        try container.encode(notesInternal, forKey: .notesInternal)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
        try container.encode(items, forKey: .items)
        try container.encode(orderNotes, forKey: .orderNotes)
    }
}
