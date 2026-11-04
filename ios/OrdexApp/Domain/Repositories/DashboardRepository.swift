import Foundation
import SwiftUI

protocol DashboardRepository {
    func getOverview() async throws -> DashboardData
    func getHome() async throws -> DashboardHomeData
    func getStats() async throws -> DashboardStats
    func getActionable() async throws -> DashboardActionableData
}

struct DashboardRepositoryKey: EnvironmentKey {
    static let defaultValue: any DashboardRepository = RemoteDashboardRepository(client: .shared)
}

extension EnvironmentValues {
    var dashboardRepository: any DashboardRepository {
        get { self[DashboardRepositoryKey.self] }
        set { self[DashboardRepositoryKey.self] = newValue }
    }
}
