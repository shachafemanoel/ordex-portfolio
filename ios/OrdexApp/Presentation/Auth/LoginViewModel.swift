import Foundation
import Observation

@MainActor
@Observable
final class LoginViewModel {
    var email = ""
    var password = ""
    var rememberMe = true
    var isLoading = false
    var errorMessage: String? = nil

    private let repository: any AuthRepository

    init(repository: any AuthRepository = RemoteAuthRepository(client: .shared)) {
        self.repository = repository
    }

    var isFormValid: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty && password.count >= 4
    }

    func login() async {
        guard isFormValid else {
            errorMessage = "יש להזין אימייל וסיסמה"
            return
        }
        isLoading = true
        errorMessage = nil
        do {
            let result = try await repository.login(
                email: email.trimmingCharacters(in: .whitespaces),
                password: password,
                rememberMe: rememberMe
            )
            TokenStore.shared.save(result.token)
            AuthSession.shared.signIn(user: result.user)
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = "שגיאה בהתחברות. נסה שנית."
        }
        isLoading = false
    }
}
