import Foundation
import Observation

@MainActor
@Observable
final class ProductDetailViewModel {
    var state: Resource<Product> = .idle
    private let productId: String
    private let repository: any ProductRepository

    init(productId: String, repository: any ProductRepository = RemoteProductRepository(client: .shared)) {
        self.productId = productId
        self.repository = repository
    }

    func load() async {
        state = .loading(staleData: state.data)
        do {
            let product = try await repository.getProduct(id: productId)
            state = .success(product)
        } catch {
            state = .error(error, staleData: state.data)
        }
    }
}
