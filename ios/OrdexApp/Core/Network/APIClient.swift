import Foundation
import os

actor APIClient {
    static let shared = APIClient(baseURL: AppConfig.baseAPIURL)

    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let logger = Logger(subsystem: "il.ordex.app", category: "APIClient")

    init(baseURL: URL) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        self.session = URLSession(configuration: config)
        self.decoder = JSONDecoder.ordex
    }

    func request<T: Decodable>(endpoint: APIEndpoint, body: Encodable? = nil) async throws -> T {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.path = endpoint.path
        if let items = endpoint.queryItems { components.queryItems = items }

        var request = URLRequest(url: components.url!)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = TokenStore.shared.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        logRequest(request)
        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.unknown
        }
        logResponse(httpResponse, byteCount: data.count)

        if httpResponse.statusCode == 401 {
            await MainActor.run {
                AuthSession.shared.signOut()
            }
            throw APIError.unauthorized
        }

        if httpResponse.statusCode == 404 {
            throw APIError.notFound
        }

        if !(200..<300).contains(httpResponse.statusCode) {
            if let errorResponse = try? decoder.decode(ApiErrorResponse.self, from: data) {
                throw APIError.serverError(code: errorResponse.error?.code, message: errorResponse.resolvedMessage ?? "שגיאת שרת")
            }
            throw APIError.serverError(code: "\(httpResponse.statusCode)", message: "שגיאת שרת")
        }

        do {
            // 1. Try decoding as a standard envelope { data: T, ... } or { success: true, data: T }
            // We check this first because most OrdeX APIs use a canonical envelope
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            if let json = json, let nestedData = json["data"] {
                do {
                    let nestedDataBlob = try JSONSerialization.data(withJSONObject: nestedData)
                    return try decoder.decode(T.self, from: nestedDataBlob)
                } catch {
                    // If T is PaginatedResponse, it might actually match the FULL payload (Shape A),
                    // not just the nested 'data' array. If decoding from 'data' fails, we fall through.
                    logger.debug("Nested 'data' decoding failed for \(endpoint.path): \(String(describing: error))")
                }
            }
            
            // 2. Try decoding T directly from the full payload
            // This handles PaginatedResponse (which expects 'data' and 'pagination' keys)
            // and raw models (when the backend doesn't use an envelope)
            return try decoder.decode(T.self, from: data)
        } catch {
            #if DEBUG
            let errorMessage = String(describing: error)
            logger.error("Decode failure for \(endpoint.path, privacy: .public): \(errorMessage, privacy: .public)")
            
            if let string = String(data: data, encoding: .utf8) {
                // Log a snippet of the raw JSON to help identify the shape mismatch
                let snippet = String(string.prefix(500))
                logger.debug("Raw JSON snippet: \(snippet, privacy: .public)")
            }
            
            if let decodingError = error as? DecodingError {
                switch decodingError {
                case .keyNotFound(let key, let context):
                    logger.error("Key '\(key.stringValue, privacy: .public)' not found. Path: \(context.codingPath.map(\.stringValue).joined(separator: "."), privacy: .public)")
                case .typeMismatch(let type, let context):
                    logger.error("Type mismatch for \(String(describing: type), privacy: .public). Path: \(context.codingPath.map(\.stringValue).joined(separator: "."), privacy: .public)")
                case .valueNotFound(let type, let context):
                    logger.error("Value of type \(String(describing: type), privacy: .public) not found. Path: \(context.codingPath.map(\.stringValue).joined(separator: "."), privacy: .public)")
                case .dataCorrupted(let context):
                    logger.error("Data corrupted. Path: \(context.codingPath.map(\.stringValue).joined(separator: "."), privacy: .public), Description: \(context.debugDescription, privacy: .public)")
                @unknown default:
                    break
                }
            }
            #endif
            throw APIError.decodingFailure(error)
        }
    }

    func requestRaw(endpoint: APIEndpoint, body: Encodable? = nil) async throws -> Data {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.path = endpoint.path
        if let items = endpoint.queryItems { components.queryItems = items }

        var request = URLRequest(url: components.url!)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = TokenStore.shared.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        let (data, _) = try await session.data(for: request)
        return data
    }

    private func logRequest(_ request: URLRequest) {
        #if DEBUG
        logger.debug("Request \(request.httpMethod ?? "GET", privacy: .public) \(request.url?.absoluteString ?? "<missing-url>", privacy: .public)")
        #endif
    }

    private func logResponse(_ response: HTTPURLResponse, byteCount: Int) {
        #if DEBUG
        logger.debug("Response \(response.statusCode, privacy: .public) \(response.url?.absoluteString ?? "<missing-url>", privacy: .public) bytes=\(byteCount, privacy: .public)")
        #endif
    }

    private func logDecodingFailure(_ error: Error, endpoint: APIEndpoint) {
        #if DEBUG
        logger.error("Decode failure for \(endpoint.path, privacy: .public): \(String(describing: error), privacy: .public)")
        #endif
    }
}

extension JSONDecoder {
    static var ordex: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            if let date = ISO8601DateFormatter.ordexFractional.date(from: value)
                ?? ISO8601DateFormatter.ordex.date(from: value) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO-8601 date: \(value)")
        }
        return decoder
    }
}

private extension ISO8601DateFormatter {
    static let ordex: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static let ordexFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
