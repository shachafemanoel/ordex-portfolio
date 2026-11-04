import Foundation

struct ApiSuccessResponse<T: Decodable>: Decodable {
    let success: Bool?
    let data: T
}

struct EmptyResponse: Decodable {}

struct ApiErrorResponse: Decodable {
    let success: Bool?
    let error: APIErrorPayload?
    let message: String?

    var resolvedMessage: String? {
        error?.message ?? error?.code ?? message
    }
}

enum APIErrorPayload: Decodable {
    case text(String)
    case object(code: String?, message: String?)

    var code: String? {
        switch self {
        case .text: return nil
        case .object(let code, _): return code
        }
    }

    var message: String? {
        switch self {
        case .text(let value): return value
        case .object(_, let message): return message
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let text = try? container.decode(String.self) {
            self = .text(text)
            return
        }

        let object = try decoder.container(keyedBy: CodingKeys.self)
        self = .object(
            code: try object.decodeIfPresent(String.self, forKey: .code),
            message: try object.decodeIfPresent(String.self, forKey: .message)
        )
    }

    private enum CodingKeys: String, CodingKey {
        case code
        case message
    }
}
