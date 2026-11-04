import Foundation
import SwiftUI

protocol AuthRepository {
    func login(email: String, password: String, rememberMe: Bool) async throws -> (user: User, token: String)
    func logout() async throws
    func me() async throws -> User
    func register(name: String, email: String, password: String, role: String) async throws -> User
}

struct AuthRepositoryKey: EnvironmentKey {
    static let defaultValue: any AuthRepository = RemoteAuthRepository(client: .shared)
}

extension EnvironmentValues {
    var authRepository: any AuthRepository {
        get { self[AuthRepositoryKey.self] }
        set { self[AuthRepositoryKey.self] = newValue }
    }
}
