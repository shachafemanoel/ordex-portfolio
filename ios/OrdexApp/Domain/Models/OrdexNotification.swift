import Foundation

struct OrdexNotification: Codable, Identifiable {
    let id: String
    let type: String?
    let title: String
    let body: String?
    let orderId: String?
    let readAt: Date?
    var createdAt: Date

    var isRead: Bool { readAt != nil }

    enum CodingKeys: String, CodingKey {
        case id, type, title, body, orderId, readAt
        case createdAt = "created_at"
        case createdAtCamel = "createdAt"
        case updatedAt = "updated_at"
        case updatedAtCamel = "updatedAt"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        type = try container.decodeIfPresent(String.self, forKey: .type)
        title = try container.decode(String.self, forKey: .title)
        body = try container.decodeIfPresent(String.self, forKey: .body)
        orderId = try container.decodeIfPresent(String.self, forKey: .orderId)
        readAt = try container.decodeIfPresent(Date.self, forKey: .readAt)
        
        // Try all possible date keys with correct try keywords
        createdAt = (try? container.decodeIfPresent(Date.self, forKey: .createdAt)) ??
                    (try? container.decodeIfPresent(Date.self, forKey: .createdAtCamel)) ??
                    (try? container.decodeIfPresent(Date.self, forKey: .updatedAt)) ??
                    (try? container.decodeIfPresent(Date.self, forKey: .updatedAtCamel)) ??
                    Date()
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(type, forKey: .type)
        try container.encode(title, forKey: .title)
        try container.encode(body, forKey: .body)
        try container.encode(orderId, forKey: .orderId)
        try container.encode(readAt, forKey: .readAt)
        try container.encode(createdAt, forKey: .createdAt)
    }
}
