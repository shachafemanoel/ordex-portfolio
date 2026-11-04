import Foundation

struct Customer: Codable, Identifiable {
    let id: String
    let name: String
    let email: String?
    let phone: String?
    let creditLimitCents: Int?
    let paymentTermsDays: Int?
    let accountNotes: String?
    let billingAddress: Address?
    let shippingAddress: Address?
    let createdAt: Date?
    let updatedAt: Date?

    struct Address: Codable {
        let city: String
        let street: String
        let number: String
        let floor: String?
        let apartment: String?
        let notes: String?
        let lat: Double?
        let lng: Double?
    }
}
