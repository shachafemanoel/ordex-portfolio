import Foundation

struct UpdateStatusBody: Encodable {
    let status: String
    let reason: String?
}

struct AdvanceStatusBody: Encodable {
    let targetStatus: String?
    let reason: String?
}

struct ChecklistUpdateBody: Encodable {
    let itemId: String
    let isChecked: Bool
}

struct AddNoteBody: Encodable {
    let content: String
}

final class RemoteOrderRepository: OrderRepository {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func listOrders(query: OrdersQuery) async throws -> PaginatedResponse<Order> {
        try await client.request(endpoint: .orders(query: query))
    }

    func getOrder(id: String) async throws -> Order {
        try await client.request(endpoint: .orderDetail(id: id))
    }

    func getTimeline(id: String) async throws -> OpsActivityTimeline {
        try await client.request(endpoint: .orderTimeline(id: id))
    }

    func updateStatus(id: String, status: OrderStatus, reason: String?) async throws -> Order {
        let body = UpdateStatusBody(status: status.rawValue, reason: reason)
        return try await client.request(endpoint: .updateOrderStatus(id: id), body: body)
    }

    func advanceStatus(id: String, targetStatus: OrderStatus?, reason: String?) async throws -> Order {
        let body = AdvanceStatusBody(targetStatus: targetStatus?.rawValue, reason: reason)
        return try await client.request(endpoint: .advanceOrderStatus(id: id), body: body)
    }

    func updateChecklist(id: String, itemId: String, isChecked: Bool) async throws -> Order {
        let body = ChecklistUpdateBody(itemId: itemId, isChecked: isChecked)
        // Checklist route uses createDataResponse, which wraps in { data: T }
        struct DataWrapper: Decodable { let data: Order }
        let wrapper: DataWrapper = try await client.request(endpoint: .orderChecklist(id: id), body: body)
        return wrapper.data
    }

    func addNote(id: String, content: String) async throws -> OrderNote {
        let body = AddNoteBody(content: content)
        return try await client.request(endpoint: .addOrderNote(id: id), body: body)
    }

    func getGeoOrders() async throws -> [GeoOrder] {
        try await client.request(endpoint: .ordersGeo)
    }

    func getAvailableActions(id: String) async throws -> [OrderAction] {
        try await client.request(endpoint: .orderActions(id: id))
    }

    func performAction(id: String, action: OrderActionType, payload: OrderActionPayload?) async throws -> Order {
        struct ActionBody: Encodable {
            let action: String
            let payload: OrderActionPayload?
        }
        let body = ActionBody(action: action.rawValue, payload: payload)
        return try await client.request(endpoint: .performOrderAction(id: id), body: body)
    }
}
