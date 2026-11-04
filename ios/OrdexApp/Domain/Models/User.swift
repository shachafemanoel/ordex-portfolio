import Foundation

struct UserRole: Codable {
    let key: String
    let label: String

    var hebrewLabel: String {
        switch key {
        case "ADMIN": return "מנהל"
        case "OPERATIONS": return "תפעול"
        case "SALES": return "מכירות"
        case "PURCHASING": return "רכש"
        case "INSTALLER": return "מתקין"
        default: return label
        }
    }

    var isAdmin: Bool { key == "ADMIN" }
}

struct User: Codable, Identifiable {
    let id: String
    let email: String
    let fullName: String?
    let phone: String?
    let isActive: Bool
    let role: UserRole
    let permissions: [String]
    let createdAt: Date?

    var displayName: String { fullName ?? email }

    func hasPermission(_ permission: String) -> Bool {
        permissions.contains(permission)
    }
}
