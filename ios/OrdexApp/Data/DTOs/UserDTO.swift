import Foundation

struct UserDTO: Decodable {
    let id: String
    let email: String
    let fullName: String?
    let phone: String?
    let isActive: Bool?
    let role: UserRoleDTO
    let permissions: [String]?
    let createdAt: String?

    struct UserRoleDTO: Decodable {
        let key: String
        let label: String
    }

    func toDomain() -> User {
        User(
            id: id,
            email: email,
            fullName: fullName,
            phone: phone,
            isActive: isActive ?? true,
            role: UserRole(key: role.key, label: role.label),
            permissions: permissions ?? [],
            createdAt: nil
        )
    }
}
