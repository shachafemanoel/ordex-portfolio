import Foundation
import SwiftUI

protocol NotificationRepository {
    func getFeed() async throws -> [OrdexNotification]
    func markRead(ids: [String]) async throws
    func registerPushToken(_ token: String) async throws
}

struct NotificationRepositoryKey: EnvironmentKey {
    static let defaultValue: any NotificationRepository = RemoteNotificationRepository(client: .shared)
}

extension EnvironmentValues {
    var notificationRepository: any NotificationRepository {
        get { self[NotificationRepositoryKey.self] }
        set { self[NotificationRepositoryKey.self] = newValue }
    }
}
