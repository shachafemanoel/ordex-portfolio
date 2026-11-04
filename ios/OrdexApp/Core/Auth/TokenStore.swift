import Foundation

private let keychainKey = "ordex.jwt"

final class TokenStore {
    static let shared = TokenStore()
    private init() {}

    var token: String? {
        KeychainService.load(forKey: keychainKey)
    }

    func save(_ token: String) {
        KeychainService.save(token, forKey: keychainKey)
    }

    func clear() {
        KeychainService.delete(forKey: keychainKey)
    }

    var isTokenValid: Bool {
        guard let token else { return false }
        return !isExpired(token)
    }

    private func isExpired(_ token: String) -> Bool {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return true }
        var base64 = String(parts[1])
        // Pad to multiple of 4
        let remainder = base64.count % 4
        if remainder != 0 { base64 += String(repeating: "=", count: 4 - remainder) }
        guard let data = Data(base64Encoded: base64),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let exp = payload["exp"] as? TimeInterval
        else { return true }
        return Date(timeIntervalSince1970: exp) < Date().addingTimeInterval(60)
    }
}
