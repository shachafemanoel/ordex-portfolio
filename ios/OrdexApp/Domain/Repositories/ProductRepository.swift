import Foundation
import SwiftUI

protocol ProductRepository {
    func listProducts(query: ProductListQuery) async throws -> PaginatedResponse<Product>
    func getProduct(id: String) async throws -> Product
}

struct ProductRepositoryKey: EnvironmentKey {
    static let defaultValue: any ProductRepository = RemoteProductRepository(client: .shared)
}

extension EnvironmentValues {
    var productRepository: any ProductRepository {
        get { self[ProductRepositoryKey.self] }
        set { self[ProductRepositoryKey.self] = newValue }
    }
}
