import Foundation
import Observation

@MainActor
@Observable
final class CustomersViewModel {
    var state: Resource<[Customer]> = .idle
    var query = CustomersQuery()
    var isSearching = false

    private let repository: any CustomerRepository

    init(repository: any CustomerRepository = RemoteCustomerRepository(client: .shared)) {
        self.repository = repository
    }

    func load() async {
        let staleData: [Customer]? = if case .success(let data) = state { data } else { nil }
        state = .loading(staleData: staleData)

        do {
            let response = try await repository.listCustomers(query: query)
            state = .success(response.items)
        } catch {
            state = .error(error, staleData: staleData)
        }
    }

    func search(text: String) {
        query.query = text
        Task { await load() }
    }
}
