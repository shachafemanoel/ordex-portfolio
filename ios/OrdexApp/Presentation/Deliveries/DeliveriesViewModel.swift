import Foundation
import Observation

@MainActor
@Observable
final class DeliveriesViewModel {
    var state: Resource<[Order]> = .idle
    var selectedDate = Date()
    var isUpdating = false
    
    private let repository: any OrderRepository

    init(repository: any OrderRepository = RemoteOrderRepository(client: .shared)) {
        self.repository = repository
    }

    func load() async {
        let staleData: [Order]? = if case .success(let data) = state { data } else { nil }
        state = .loading(staleData: staleData)

        let deliveryStatuses: [OrderStatus] = [
            .confirmed,
            .poCreated,
            .awaitingStock,
            .partiallySupplied,
            .ready,
            .readyForInstall,
            .installScheduling,
            .awaitingInstall,
            .scheduled,
            .inTransit,
            .installation
        ]

        let query = OrdersQuery(
            page: 1,
            limit: 100,
            statuses: deliveryStatuses.map(\.rawValue)
        )

        do {
            let response = try await repository.listOrders(query: query)
            // Sort by scheduled time, then by proximity (if we had location)
            let sorted = response.items.sorted { (a, b) in
                if let da = a.scheduledAt, let db = b.scheduledAt {
                    return da < db
                }
                return false
            }
            state = .success(sorted)
        } catch {
            state = .error(error, staleData: staleData)
        }
    }

    func collectOrder(_ order: Order) async {
        isUpdating = true
        do {
            _ = try await repository.updateStatus(id: order.id, status: .ready, reason: "איסוף מהיר מהנייד")
            await load()
        } catch {
            // Handle error
        }
        isUpdating = false
    }

    func performAction(_ order: Order, action: OrderAction, payload: OrderActionPayload?) async {
        isUpdating = true
        do {
            _ = try await repository.performAction(id: order.id, action: action.type, payload: payload)
            await load()
        } catch {
            // Handle error
        }
        isUpdating = false
    }
}
