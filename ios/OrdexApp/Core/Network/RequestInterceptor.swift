import Foundation

// Token injection is handled directly in APIClient.
// This file is a placeholder for future interceptor logic (e.g., retry, logging).
enum RequestInterceptor {
    static func attach(token: String, to request: inout URLRequest) {
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
}
