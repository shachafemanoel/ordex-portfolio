import Foundation
import Observation

@MainActor
@Observable
final class AuthSession {
    static let shared = AuthSession()

    var currentUser: User? = nil
    var isLoggedIn: Bool = false
    var isRestoring: Bool = false

    private init() {
        if TokenStore.shared.isTokenValid {
            isRestoring = true
        }
    }

    func signIn(user: User) {
        currentUser = user
        isLoggedIn = true
        isRestoring = false
    }

    func signOut() {
        TokenStore.shared.clear()
        currentUser = nil
        isLoggedIn = false
        isRestoring = false
    }

    func restore(using repository: any AuthRepository) async {
        guard TokenStore.shared.isTokenValid else {
            signOut()
            return
        }

        isRestoring = true
        do {
            let user = try await repository.me()
            signIn(user: user)
        } catch {
            signOut()
        }
    }
}
