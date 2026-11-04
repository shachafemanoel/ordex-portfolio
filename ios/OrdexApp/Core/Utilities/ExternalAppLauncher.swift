import UIKit
import CoreLocation

enum ExternalAppLauncher {
    // MARK: - Phone
    static func call(phone: String) {
        let cleaned = phone.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
        guard !cleaned.isEmpty, let url = URL(string: "tel://\(cleaned)") else { return }
        open(url)
    }

    // MARK: - WhatsApp
    static func whatsapp(phone: String, message: String = "") {
        let cleaned = phone.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
        guard !cleaned.isEmpty else { return }
        let encoded = message.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        // Prefer native WhatsApp; fall back to web link if not installed
        if let native = URL(string: "whatsapp://send?phone=\(cleaned)&text=\(encoded)"),
           UIApplication.shared.canOpenURL(native) {
            open(native)
        } else if let web = URL(string: "https://wa.me/\(cleaned)?text=\(encoded)") {
            open(web)
        }
    }

    // MARK: - Maps navigation
    static func navigate(to address: String, preferWaze: Bool = true) {
        let encoded = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        
        if preferWaze, let wazeURL = URL(string: "waze://?q=\(encoded)&navigate=yes"),
           UIApplication.shared.canOpenURL(wazeURL) {
            open(wazeURL)
            return
        }
        
        // Prefer Apple Maps; fall back to web link
        if let url = URL(string: "maps://?daddr=\(encoded)"),
           UIApplication.shared.canOpenURL(url) {
            open(url)
        } else if let fallback = URL(string: "https://maps.apple.com/?daddr=\(encoded)") {
            open(fallback)
        }
    }

    // MARK: - Private
    private static func open(_ url: URL) {
        Task { @MainActor in
            UIApplication.shared.open(url, options: [:])
        }
    }
}
