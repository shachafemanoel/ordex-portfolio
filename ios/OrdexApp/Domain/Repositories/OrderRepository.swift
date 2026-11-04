import Foundation

protocol OrderRepository {
    func listOrders(query: OrdersQuery) async throws -> PaginatedResponse<Order>
    func getOrder(id: String) async throws -> Order
    func getTimeline(id: String) async throws -> OpsActivityTimeline
    func updateStatus(id: String, status: OrderStatus, reason: String?) async throws -> Order
    func advanceStatus(id: String, targetStatus: OrderStatus?, reason: String?) async throws -> Order
    func updateChecklist(id: String, itemId: String, isChecked: Bool) async throws -> Order
    func addNote(id: String, content: String) async throws -> OrderNote
    func getGeoOrders() async throws -> [GeoOrder]
    func getAvailableActions(id: String) async throws -> [OrderAction]
    func performAction(id: String, action: OrderActionType, payload: OrderActionPayload?) async throws -> Order
}


// MARK: - Environment key
import SwiftUI

struct OrderRepositoryKey: EnvironmentKey {
    static let defaultValue: any OrderRepository = RemoteOrderRepository(client: .shared)
}

extension EnvironmentValues {
    var orderRepository: any OrderRepository {
        get { self[OrderRepositoryKey.self] }
        set { self[OrderRepositoryKey.self] = newValue }
    }
}
