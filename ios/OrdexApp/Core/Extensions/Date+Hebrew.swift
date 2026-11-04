import Foundation

extension Date {
    static let hebrewDateTime: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "he_IL")
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    static let hebrewDate: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "he_IL")
        f.dateStyle = .medium
        f.timeStyle = .none
        return f
    }()

    static let hebrewTime: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "he_IL")
        f.dateStyle = .none
        f.timeStyle = .short
        return f
    }()

    var hebrewFormatted: String { Date.hebrewDateTime.string(from: self) }
    var hebrewDateOnly: String { Date.hebrewDate.string(from: self) }
    var hebrewTimeOnly: String { Date.hebrewTime.string(from: self) }
}
