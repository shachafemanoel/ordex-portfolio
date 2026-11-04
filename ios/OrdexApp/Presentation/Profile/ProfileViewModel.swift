import Foundation
import Observation

@MainActor
@Observable
final class ProfileViewModel {
    var state: Resource<User> = .idle
    var isLoggingOut = false

    private let authRepository: any AuthRepository

    init(authRepository: any AuthRepository = RemoteAuthRepository(client: .shared)) {
        self.authRepository = authRepository
        if let cached = AuthSession.shared.currentUser {
            self.state = .success(cached)
        }
    }

    func loadUser() async {
        let staleData = state.data ?? AuthSession.shared.currentUser
        state = .loading(staleData: staleData)
        
        do {
            let fresh = try await authRepository.me()
            AuthSession.shared.currentUser = fresh
            state = .success(fresh)
        } catch {
            state = .error(error, staleData: staleData)
        }
    }

    func logout() async {
        isLoggingOut = true
        try? await authRepository.logout()
        AuthSession.shared.signOut()
        isLoggingOut = false
    }
}
