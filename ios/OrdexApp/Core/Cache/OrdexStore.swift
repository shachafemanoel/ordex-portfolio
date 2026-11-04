import SwiftData

enum OrdexStore {
    static let shared: ModelContainer = {
        let schema = Schema([CachedOrder.self, CachedDashboard.self])
        let config = ModelConfiguration("OrdexCache", schema: schema, isStoredInMemoryOnly: false)
        return try! ModelContainer(for: schema, configurations: [config])
    }()
}
