import Foundation
import Observation

@MainActor
@Observable
final class SettingsViewModel {
    var state: Resource<StoreSettings> = .idle
    
    private let repository: any StoreRepository

    init(repository: any StoreRepository = RemoteStoreRepository(client: .shared)) {
        self.repository = repository
    }

    func load() async {
        let staleData: StoreSettings? = if case .success(let data) = state { data } else { nil }
        state = .loading(staleData: staleData)

        do {
            let settings = try await repository.getSettings()
            state = .success(settings)
        } catch {
            state = .error(error, staleData: staleData)
        }
    }
}
