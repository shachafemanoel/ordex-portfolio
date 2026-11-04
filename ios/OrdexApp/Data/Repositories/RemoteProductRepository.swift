import Foundation

final class RemoteProductRepository: ProductRepository {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func listProducts(query: ProductListQuery) async throws -> PaginatedResponse<Product> {
        try await client.request(endpoint: .products(query: query))
    }

    func getProduct(id: String) async throws -> Product {
        struct DataWrapper: Decodable { let data: Product }
        let wrapper: DataWrapper = try await client.request(endpoint: .productDetail(id: id))
        return wrapper.data
    }
}
