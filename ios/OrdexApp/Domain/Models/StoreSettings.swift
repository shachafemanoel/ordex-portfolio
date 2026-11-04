import Foundation

struct StoreSettings: Codable {
    let name: String
    let logoUrl: String?
    let primaryColor: String?
    let currency: String
    let timezone: String
}

struct WorkforceMember: Codable, Identifiable {
    let id: String
    let name: String
    let role: String
    let phone: String?
    let isActive: Bool
}
