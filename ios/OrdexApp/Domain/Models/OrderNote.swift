import Foundation

struct OrderNote: Codable, Identifiable {
    let id: String
    let content: String
    let authorName: String?
    let authorId: String?
    let isInternal: Bool
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, content, authorName, authorId, isInternal, createdAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        content = try container.decodeIfPresent(String.self, forKey: .content) ?? ""
        authorName = try container.decodeIfPresent(String.self, forKey: .authorName)
        authorId = try container.decodeIfPresent(String.self, forKey: .authorId)
        isInternal = try container.decodeIfPresent(Bool.self, forKey: .isInternal) ?? false
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt) ?? Date()
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(content, forKey: .content)
        try container.encode(authorName, forKey: .authorName)
        try container.encode(authorId, forKey: .authorId)
        try container.encode(isInternal, forKey: .isInternal)
        try container.encode(createdAt, forKey: .createdAt)
    }
}
