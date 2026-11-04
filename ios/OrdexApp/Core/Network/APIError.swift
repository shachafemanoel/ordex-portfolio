import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case notFound
    case serverError(code: String?, message: String)
    case networkUnavailable
    case decodingFailure(Error)
    case validationError([String: String])
    case unknown

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "אין הרשאה. אנא התחבר מחדש."
        case .notFound:
            return "המשאב לא נמצא."
        case .serverError(_, let message):
            return message
        case .networkUnavailable:
            return "אין חיבור לאינטרנט."
        case .decodingFailure:
            return "שגיאה בעיבוד הנתונים."
        case .validationError(let fields):
            return fields.values.joined(separator: ", ")
        case .unknown:
            return "שגיאה לא ידועה."
        }
    }
}
