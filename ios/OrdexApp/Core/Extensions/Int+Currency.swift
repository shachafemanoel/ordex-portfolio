import Foundation

extension Int {
    private static let shekelFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "ILS"
        f.locale = Locale(identifier: "he_IL")
        f.maximumFractionDigits = 2
        return f
    }()

    var shekels: String {
        Int.shekelFormatter.string(from: NSNumber(value: Double(self) / 100.0)) ?? "₪\(Double(self) / 100.0)"
    }
}
