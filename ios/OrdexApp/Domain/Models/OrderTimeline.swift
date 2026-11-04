import Foundation

enum TimelineEventType: String, Codable {
    case statusChange = "STATUS_CHANGE"
    case purchaseOrder = "PURCHASE_ORDER"
    case task = "TASK"
    case allocation = "ALLOCATION"
    case schedule = "SCHEDULE"
    case system = "SYSTEM"

    var hebrewLabel: String {
        switch self {
        case .statusChange: return "שינוי סטטוס"
        case .purchaseOrder: return "הזמנת רכש"
        case .task: return "משימה"
        case .allocation: return "הקצאה"
        case .schedule: return "תזמון"
        case .system: return "מערכת"
        }
    }
}

struct OpsTimelineEvent: Codable, Identifiable {
    let id: String
    let title: String
    let type: TimelineEventType
    let description: String?
    let actorName: String?
    let createdAt: Date
    let stage: String?
    let metadata: [String: AnyCodable]?

    enum CodingKeys: String, CodingKey {
        case id, title, type, description, actorName, stage, metadata
        case at
        case createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        type = try container.decode(TimelineEventType.self, forKey: .type)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        actorName = try container.decodeIfPresent(String.self, forKey: .actorName)
        stage = try container.decodeIfPresent(String.self, forKey: .stage)
        metadata = try container.decodeIfPresent([String: AnyCodable].self, forKey: .metadata)
        
        // Handle 'at' vs 'createdAt'
        if let date = try container.decodeIfPresent(Date.self, forKey: .at) {
            self.createdAt = date
        } else if let date = try container.decodeIfPresent(Date.self, forKey: .createdAt) {
            self.createdAt = date
        } else {
            self.createdAt = Date() // Fallback
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(type, forKey: .type)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encodeIfPresent(actorName, forKey: .actorName)
        try container.encodeIfPresent(stage, forKey: .stage)
        try container.encodeIfPresent(metadata, forKey: .metadata)
        // Prefer encoding to 'createdAt' when writing out
        try container.encode(createdAt, forKey: .createdAt)
    }
}

struct OpsTimelineStageSummary: Codable {
    let key: String
    let label: String
    let state: String
    let startedAt: Date?
    let completedAt: Date?
    let latestEventAt: Date?
    let totalEvents: Int
    let nextAction: String?
}

struct OpsActivityTimeline: Codable {
    let orderId: String
    let orderNumber: String?
    let orderStatus: String?
    let version: String?
    let currentStage: String?
    let stages: [OpsTimelineStageSummary]?
    let events: [OpsTimelineEvent]
}

// Helper for dynamic metadata
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) { value = string }
        else if let int = try? container.decode(Int.self) { value = int }
        else if let double = try? container.decode(Double.self) { value = double }
        else if let bool = try? container.decode(Bool.self) { value = bool }
        else if let dict = try? container.decode([String: AnyCodable].self) { value = dict.mapValues { $0.value } }
        else if let array = try? container.decode([AnyCodable].self) { value = array.map { $0.value } }
        else { value = NSNull() }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let string = value as? String { try container.encode(string) }
        else if let int = value as? Int { try container.encode(int) }
        else if let double = value as? Double { try container.encode(double) }
        else if let bool = value as? Bool { try container.encode(bool) }
        else if let dict = value as? [String: Any] { try container.encode(dict.mapValues { AnyCodable($0) }) }
        else if let array = value as? [Any] { try container.encode(array.map { AnyCodable($0) }) }
        else { try container.encodeNil() }
    }
}
