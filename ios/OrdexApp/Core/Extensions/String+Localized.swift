import Foundation

extension String {
    static func ordex(_ key: String) -> String {
        NSLocalizedString(key, bundle: .main, comment: "")
    }
}
