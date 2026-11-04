import Foundation

final class RemoteDashboardRepository: DashboardRepository {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func getOverview() async throws -> DashboardData {
        try await client.request(endpoint: .dashboardOverview)
    }

    func getHome() async throws -> DashboardHomeData {
        try await client.request(endpoint: .dashboardHome)
    }

    func getStats() async throws -> DashboardStats {
        // stats returns direct JSON in app/api/dashboard/stats/route.ts
        try await client.request(endpoint: .dashboardStats)
    }

    func getActionable() async throws -> DashboardActionableData {
        try await client.request(endpoint: .dashboardActionable)
    }
}
