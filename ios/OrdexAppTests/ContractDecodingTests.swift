import XCTest
@testable import OrdexApp

final class AppConfigTests: XCTestCase {
    func testEnvironmentAPIBaseURLWinsOverInfoPlistValue() {
        let resolved = AppConfig.resolveBaseURL(
            environment: ["API_BASE_URL": "http://localhost:3000"],
            infoDictionary: ["OrdexAPIBaseURL": "https://api.ordex.invalid"]
        )

        XCTAssertEqual(resolved, "http://localhost:3000")
    }

    func testInfoPlistAPIBaseURLIsUsedWhenEnvironmentIsMissing() {
        let resolved = AppConfig.resolveBaseURL(
            environment: [:],
            infoDictionary: ["OrdexAPIBaseURL": "https://api.ordex.invalid"]
        )

        XCTAssertEqual(resolved, "https://api.ordex.invalid")
    }

    func testFallbackAPIBaseURLIsUsedWhenConfigurationIsMissing() {
        let resolved = AppConfig.resolveBaseURL(
            environment: [:],
            infoDictionary: nil
        )

        XCTAssertEqual(resolved, "https://api.ordex.invalid")
    }

    func testInvalidAndEmptyAPIBaseURLValuesFallBackSafely() {
        let emptyResolved = AppConfig.resolveBaseURL(
            environment: ["API_BASE_URL": "   "],
            infoDictionary: ["OrdexAPIBaseURL": ""]
        )
        let invalidResolved = AppConfig.resolveBaseURL(
            environment: ["API_BASE_URL": "not a url"],
            infoDictionary: ["OrdexAPIBaseURL": "ftp://api.ordex.invalid"]
        )

        XCTAssertEqual(emptyResolved, "https://api.ordex.invalid")
        XCTAssertEqual(invalidResolved, "https://api.ordex.invalid")
    }
}

final class ContractDecodingTests: XCTestCase {
    private struct TestPayload: Decodable, Equatable {
        let id: String
        let name: String
    }

    func testLegacySuccessEnvelopeDecodesData() throws {
        let data = Data("""
        {
          "success": true,
          "data": { "id": "p1", "name": "בדיקה" }
        }
        """.utf8)

        let envelope = try JSONDecoder.ordex.decode(ApiSuccessResponse<TestPayload>.self, from: data)

        XCTAssertEqual(envelope.data, TestPayload(id: "p1", name: "בדיקה"))
    }

    func testCanonicalPaginatedEnvelopeMapsPaginationFields() throws {
        let data = Data("""
        {
          "data": [
            { "id": "a", "number": "101", "name": "ראשון" },
            { "id": "b", "number": "102", "name": "שני" }
          ],
          "pagination": {
            "total": 5,
            "page": 1,
            "perPage": 2,
            "totalPages": 3,
            "hasNext": true,
            "hasPrev": false
          }
        }
        """.utf8)

        let response = try JSONDecoder.ordex.decode(PaginatedResponse<TestOrder>.self, from: data)

        XCTAssertEqual(response.items.count, 2)
        XCTAssertEqual(response.meta.limit, 2)
        XCTAssertTrue(response.meta.hasMore)
        XCTAssertEqual(response.meta.totalPages, 3)
    }

    private struct TestOrder: Decodable, Equatable {
        let id: String
        let number: String
        let name: String
    }

    func testOrdersRawArrayResponse() throws {
        let data = Data("""
        [
          { "id": "c", "number": "103", "name": "שלישי" }
        ]
        """.utf8)
        let response = try JSONDecoder.ordex.decode(PaginatedResponse<TestOrder>.self, from: data)
        XCTAssertEqual(response.items.count, 1)
        XCTAssertEqual(response.meta.total, 1)
        XCTAssertEqual(response.items[0].name, "שלישי")
    }

    func testOrdersEnvelopeArrayResponse() throws {
        let data = Data("""
        {
          "data": [
            { "id": "b", "number": "102", "name": "שני" }
          ]
        }
        """.utf8)
        let response = try JSONDecoder.ordex.decode(PaginatedResponse<TestOrder>.self, from: data)
        XCTAssertEqual(response.items.count, 1)
        XCTAssertEqual(response.meta.total, 1)
        XCTAssertEqual(response.items[0].number, "102")
    }

    func testOrderActionDecoding() throws {
        let data = Data("""
        {
          "id": "call-1",
          "type": "CALL_CUSTOMER",
          "title": "התקשר",
          "subtitle": "יצירת קשר",
          "isPrimary": true,
          "requiresConfirmation": false,
          "targetStatus": null
        }
        """.utf8)
        let action = try JSONDecoder.ordex.decode(OrderAction.self, from: data)
        XCTAssertEqual(action.type, .callCustomer)
        XCTAssertTrue(action.isPrimary)
    }

    func testOrderActionPayloadEncoding() throws {
        let payload = OrderActionPayload(note: "test note", confirmedAddress: true)
        let data = try JSONEncoder().encode(payload)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        
        XCTAssertEqual(json?["note"] as? String, "test note")
        XCTAssertEqual(json?["confirmedAddress"] as? Bool, true)
    }

    func testDashboardEnvelopeResponse() throws {
        // Simulating the behavior of APIClient wrapping/unwrapping
        // We will just decode the raw type since APIClient tries that first
        let data = Data("""
        {
          "data": {
            "id": "100",
            "name": "dashboard"
          }
        }
        """.utf8)
        // DashboardData is not available here easily without mocking, let's just use TestPayload
        let envelope = try JSONDecoder.ordex.decode(ApiSuccessResponse<TestPayload>.self, from: data)
        XCTAssertEqual(envelope.data.id, "100") 
        XCTAssertEqual(envelope.data.name, "dashboard")
    }

    func testNotificationWithoutCreatedAt() throws {
        let data = Data("""
        {
          "id": "n1",
          "title": "Test",
          "updatedAt": "2026-04-28T09:00:00.000Z"
        }
        """.utf8)
        let notification = try JSONDecoder.ordex.decode(OrdexNotification.self, from: data)
        XCTAssertEqual(notification.id, "n1")
        XCTAssertEqual(notification.createdAt, try! ISO8601DateFormatter().date(from: "2026-04-28T09:00:00Z"))
    }

    func testNotificationWithoutAnyDate() throws {
        let data = Data("""
        {
          "id": "n2",
          "title": "Test"
        }
        """.utf8)
        let notification = try JSONDecoder.ordex.decode(OrdexNotification.self, from: data)
        // Check that it's close to now (within 1 second)
        XCTAssertTrue(abs(notification.createdAt.timeIntervalSinceNow) < 1.0)
    }

    func testNotificationWithCreatedAt() throws {
        let data = Data("""
        {
          "id": "n3",
          "title": "Test",
          "createdAt": "2026-04-28T10:00:00.000Z"
        }
        """.utf8)
        let notification = try JSONDecoder.ordex.decode(OrdexNotification.self, from: data)
        XCTAssertEqual(notification.createdAt, try! ISO8601DateFormatter().date(from: "2026-04-28T10:00:00Z"))
    }

    func testUpdateStatusBodyEncodingMatchesBackend() throws {
        let body = UpdateStatusBody(status: OrderStatus.processing.rawValue, reason: "בדיקה")
        let data = try JSONEncoder().encode(body)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: String])

        XCTAssertEqual(object["status"], "PROCESSING")
        XCTAssertEqual(object["reason"], "בדיקה")
    }
}

@MainActor
final class AuthSessionRestorationTests: XCTestCase {
    func testRestoreLoadsCurrentUserBeforeMarkingLoggedIn() async {
        let user = User(
            id: "u1",
            email: "ops@example.com",
            fullName: "Ops User",
            phone: nil,
            isActive: true,
            role: UserRole(key: "OPERATIONS", label: "תפעול"),
            permissions: ["orders:read"],
            createdAt: nil
        )
        let repository = MockAuthRepository(user: user)

        AuthSession.shared.signOut()
        TokenStore.shared.save(Self.validJWT())

        await AuthSession.shared.restore(using: repository)

        XCTAssertTrue(AuthSession.shared.isLoggedIn)
        XCTAssertFalse(AuthSession.shared.isRestoring)
        XCTAssertEqual(AuthSession.shared.currentUser?.id, "u1")
        AuthSession.shared.signOut()
    }

    private static func validJWT() -> String {
        let header = base64URL(#"{"alg":"none","typ":"JWT"}"#)
        let expiry = Int(Date().addingTimeInterval(3600).timeIntervalSince1970)
        let payload = base64URL(#"{"exp":\#(expiry)}"#)
        return "\(header).\(payload).signature"
    }

    private static func base64URL(_ value: String) -> String {
        Data(value.utf8)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

private final class MockAuthRepository: AuthRepository {
    let user: User

    init(user: User) {
        self.user = user
    }

    func login(email: String, password: String, rememberMe: Bool) async throws -> (user: User, token: String) {
        (user, "token")
    }

    func logout() async throws {}

    func me() async throws -> User {
        user
    }
    
    func register(name: String, email: String, password: String, role: String) async throws -> User {
        user
    }
}
