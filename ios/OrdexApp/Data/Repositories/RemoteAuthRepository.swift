import Foundation

struct LoginBody: Encodable {
    let email: String
    let password: String
    let rememberMe: Bool
}

struct RegisterBody: Encodable {
    let name: String
    let email: String
    let password: String
    let role: String
}

struct RegisterResponseData: Decodable {
    let user: UserDTO
}

struct LogoutBody: Encodable {}

final class RemoteAuthRepository: AuthRepository {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func login(email: String, password: String, rememberMe: Bool) async throws -> (user: User, token: String) {
        let body = LoginBody(email: email, password: password, rememberMe: rememberMe)
        let response: LoginResponseDTO = try await client.request(endpoint: .login, body: body)
        return (user: response.user.toDomain(), token: response.token)
    }

    func logout() async throws {
        let _: EmptyResponse = try await client.request(endpoint: .logout, body: LogoutBody())
    }

    func me() async throws -> User {
        let dto: UserDTO = try await client.request(endpoint: .me)
        return dto.toDomain()
    }

    func register(name: String, email: String, password: String, role: String) async throws -> User {
        let body = RegisterBody(name: name, email: email, password: password, role: role)
        let response: ApiSuccessResponse<RegisterResponseData> = try await client.request(endpoint: .register, body: body)
        return response.data.user.toDomain()
    }
}
