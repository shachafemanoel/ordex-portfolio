import SwiftData
import Foundation

@Model
final class CachedDashboard {
    var id: String = "dashboard"
    var kpisJSON: Data
    var cachedAt: Date

    init(kpisJSON: Data) {
        self.kpisJSON = kpisJSON
        self.cachedAt = Date()
    }

    var isStale: Bool {
        Date().timeIntervalSince(cachedAt) > 300
    }
}
