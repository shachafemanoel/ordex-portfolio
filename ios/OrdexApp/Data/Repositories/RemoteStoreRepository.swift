import Foundation

final class RemoteStoreRepository: StoreRepository {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func getSettings() async throws -> StoreSettings {
        struct DataWrapper: Decodable { let data: StoreSettings }
        let wrapper: DataWrapper = try await client.request(endpoint: .storeSettings)
        return wrapper.data
    }
}
