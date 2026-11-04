import Foundation
import Observation

@MainActor
@Observable
final class CatalogViewModel {
    var state: Resource<[Product]> = .idle
    var query = ProductListQuery()
    var isSearching = false
    var searchText = "" {
        didSet {
            searchTask?.cancel()
            searchTask = Task {
                try? await Task.sleep(nanoseconds: 500_000_000) // 0.5s debounce
                if Task.isCancelled { return }
                query.search = searchText
                await load()
            }
        }
    }

    private var searchTask: Task<Void, Never>?
    private let repository: any ProductRepository

    init(repository: any ProductRepository = RemoteProductRepository(client: .shared)) {
        self.repository = repository
    }

    func load() async {
        let staleData: [Product]? = if case .success(let data) = state { data } else { nil }
        state = .loading(staleData: staleData)

        do {
            let response = try await repository.listProducts(query: query)
            state = .success(response.items)
        } catch {
            state = .error(error, staleData: staleData)
        }
    }

    func search(text: String) {
        searchText = text
    }
}
