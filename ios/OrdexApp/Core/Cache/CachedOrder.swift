import SwiftData
import Foundation

@Model
final class CachedOrder {
    @Attribute(.unique) var id: String
    var number: String
    var status: String
    var customerName: String?
    var city: String?
    var totalCents: Int
    var paymentStatus: String
    var priority: String
    var scheduledAt: Date?
    var updatedAt: Date
    var cachedAt: Date

    init(id: String, number: String, status: String, customerName: String?,
         city: String?, totalCents: Int, paymentStatus: String, priority: String,
         scheduledAt: Date?, updatedAt: Date) {
        self.id = id
        self.number = number
        self.status = status
        self.customerName = customerName
        self.city = city
        self.totalCents = totalCents
        self.paymentStatus = paymentStatus
        self.priority = priority
        self.scheduledAt = scheduledAt
        self.updatedAt = updatedAt
        self.cachedAt = Date()
    }
}
