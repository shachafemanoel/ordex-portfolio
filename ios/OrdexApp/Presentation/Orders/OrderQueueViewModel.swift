import Foundation
import Observation

@MainActor
@Observable
final class OrderQueueViewModel {
    var state: Resource<[Order]> = .idle
    var currentPage = 1
    var hasMore = true
    var totalCount = 0
    var selectedStatuses: Set<OrderStatus> = []
    var searchText = ""

    private var currentQuery: OrdersQuery {
        OrdersQuery(
            page: currentPage,
            limit: 20,
            statuses: selectedStatuses.map(\.rawValue),
            search: searchText
        )
    }

    private let repository: any OrderRepository

    init(repository: any OrderRepository = RemoteOrderRepository(client: .shared)) {
        self.repository = repository
    }

    func loadOrders(reset: Bool = false) async {
        if reset {
            currentPage = 1
            hasMore = true
        }
        
        guard hasMore || reset else { return }
        
        let existingOrders = reset ? nil : state.data
        state = .loading(staleData: existingOrders)
        
        do {
            let response = try await repository.listOrders(query: currentQuery)
            let newOrders = reset ? response.items : (existingOrders ?? []) + response.items
            
            state = .success(newOrders)
            hasMore = response.meta.hasMore
            totalCount = response.meta.total
        } catch {
            state = .error(error, staleData: existingOrders)
        }
    }

    func loadMore() async {
        guard hasMore && !state.isLoading else { return }
        currentPage += 1
        await loadOrders()
    }

    func refresh() async {
        await loadOrders(reset: true)
    }

    func setStatusFilter(_ status: OrderStatus) {
        if selectedStatuses.contains(status) {
            selectedStatuses.remove(status)
        } else {
            selectedStatuses.insert(status)
        }
        Task { await loadOrders(reset: true) }
    }

    func clearFilters() {
        selectedStatuses.removeAll()
        Task { await loadOrders(reset: true) }
    }
}
