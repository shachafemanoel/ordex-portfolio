import Foundation

enum AppConfig {
    // No hosted backend. `.invalid` never resolves (RFC 2606); set API_BASE_URL or OrdexAPIBaseURL.
    private static let fallbackBaseURL = "https://api.ordex.invalid"

    static var baseURL: String {
        resolveBaseURL(
            environment: ProcessInfo.processInfo.environment,
            infoDictionary: Bundle.main.infoDictionary
        )
    }

    static var baseAPIURL: URL {
        URL(string: baseURL)!
    }

    static func resolveBaseURL(
        environment: [String: String],
        infoDictionary: [String: Any]?
    ) -> String {
        if let environmentURL = validURLString(environment["API_BASE_URL"]) {
            return environmentURL
        }

        if let plistURL = validURLString(infoDictionary?["OrdexAPIBaseURL"] as? String) {
            return plistURL
        }

        return fallbackBaseURL
    }

    private static func validURLString(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty,
              let components = URLComponents(string: value),
              let scheme = components.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              components.host != nil
        else {
            return nil
        }

        return value
    }
}
