import Foundation

struct MarkReadBody: Encodable {
    let notificationId: String?
    let all: Bool?
}

struct PushRegistrationBody: Encodable {
    let token: String
    let platform: String = "ios"
}

final class RemoteNotificationRepository: NotificationRepository {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func getFeed() async throws -> [OrdexNotification] {
        try await client.request(endpoint: .notificationsFeed)
    }

    func markRead(ids: [String]) async throws {
        let body: MarkReadBody
        if ids.count == 1 {
            body = MarkReadBody(notificationId: ids[0], all: nil)
        } else {
            body = MarkReadBody(notificationId: nil, all: true)
        }
        let _: EmptyResponse = try await client.request(endpoint: .markNotificationsRead, body: body)
    }

    func registerPushToken(_ token: String) async throws {
        let body = PushRegistrationBody(token: token)
        let _: EmptyResponse = try await client.request(endpoint: .registerPushToken, body: body)
    }
}
