import Foundation
import SwiftUI

protocol StoreRepository {
    func getSettings() async throws -> StoreSettings
}

struct StoreRepositoryKey: EnvironmentKey {
    static let defaultValue: any StoreRepository = RemoteStoreRepository(client: .shared)
}

extension EnvironmentValues {
    var storeRepository: any StoreRepository {
        get { self[StoreRepositoryKey.self] }
        set { self[StoreRepositoryKey.self] = newValue }
    }
}
