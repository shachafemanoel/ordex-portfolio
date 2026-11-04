import Foundation

struct ReceivedItemPayload: Encodable, Hashable, Identifiable {
    var id: String { itemId }
    let itemId: String
    var receivedQuantity: Int
    var isReceived: Bool
}

struct InstalledItemPayload: Encodable, Hashable, Identifiable {
    var id: String { itemId }
    let itemId: String
    var installedQuantity: Int
    var isInstalled: Bool
}

struct OrderActionPayload: Encodable, Hashable {
    var reason: String? = nil
    var note: String? = nil
    var targetStatus: OrderStatus? = nil
    var receivedItems: [ReceivedItemPayload]? = nil
    var installedItems: [InstalledItemPayload]? = nil
    var issueCategory: String? = nil
    var scheduledAt: Date? = nil
    var scheduledEnd: Date? = nil
    var confirmedAddress: Bool? = nil

    init(
        reason: String? = nil,
        note: String? = nil,
        targetStatus: OrderStatus? = nil,
        receivedItems: [ReceivedItemPayload]? = nil,
        installedItems: [InstalledItemPayload]? = nil,
        issueCategory: String? = nil,
        scheduledAt: Date? = nil,
        scheduledEnd: Date? = nil,
        confirmedAddress: Bool? = nil
    ) {
        self.reason = reason
        self.note = note
        self.targetStatus = targetStatus
        self.receivedItems = receivedItems
        self.installedItems = installedItems
        self.issueCategory = issueCategory
        self.scheduledAt = scheduledAt
        self.scheduledEnd = scheduledEnd
        self.confirmedAddress = confirmedAddress
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(reason, forKey: .reason)
        try container.encodeIfPresent(note, forKey: .note)
        try container.encodeIfPresent(targetStatus?.rawValue, forKey: .targetStatus)
        try container.encodeIfPresent(receivedItems, forKey: .receivedItems)
        try container.encodeIfPresent(installedItems, forKey: .installedItems)
        try container.encodeIfPresent(issueCategory, forKey: .issueCategory)
        if let scheduledAt {
            try container.encode(ISO8601DateFormatter.ordexEncoding.string(from: scheduledAt), forKey: .scheduledAt)
        }
        if let scheduledEnd {
            try container.encode(ISO8601DateFormatter.ordexEncoding.string(from: scheduledEnd), forKey: .scheduledEnd)
        }
        try container.encodeIfPresent(confirmedAddress, forKey: .confirmedAddress)
    }

    private enum CodingKeys: String, CodingKey {
        case reason, note, targetStatus, receivedItems, installedItems, issueCategory
        case scheduledAt, scheduledEnd, confirmedAddress
    }
}

private extension ISO8601DateFormatter {
    static let ordexEncoding: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}
