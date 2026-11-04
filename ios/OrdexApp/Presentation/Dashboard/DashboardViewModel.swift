import Foundation
import Observation
import SwiftData

@Observable
final class DashboardViewModel {
    var state: Resource<DashboardData> = .idle
    
    private let repository: any DashboardRepository
    
    init(repository: any DashboardRepository = RemoteDashboardRepository(client: .shared)) {
        self.repository = repository
    }
    
    @MainActor
    func load(modelContext: ModelContext) async {
        // 1. Initial State: Try to load from Cache
        let descriptor = FetchDescriptor<CachedDashboard>()
        let cached = try? modelContext.fetch(descriptor).first
        
        var staleData: DashboardData? = nil
        if let cachedData = cached?.kpisJSON {
            staleData = try? JSONDecoder.ordex.decode(DashboardData.self, from: cachedData)
        }
        
        // Update state to loading with stale data
        state = .loading(staleData: staleData)
        
        do {
            // 2. Fetch fresh data
            let fresh = try await repository.getOverview()
            state = .success(fresh)
            
            // 3. Update Cache
            if let encoded = try? JSONEncoder().encode(fresh) {
                if let existing = cached {
                    existing.kpisJSON = encoded
                    existing.cachedAt = Date()
                } else {
                    modelContext.insert(CachedDashboard(kpisJSON: encoded))
                }
                try? modelContext.save()
            }
        } catch {
            state = .error(error, staleData: staleData)
        }
    }
}
