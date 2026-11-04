import Foundation
import Observation

@Observable
final class NotificationsFeedViewModel {
    var state: Resource<[OrdexNotification]> = .idle
    
    var unreadCount: Int { 
        if case .success(let notifications) = state {
            return notifications.filter { !$0.isRead }.count
        }
        return 0
    }

    private let repository: any NotificationRepository

    init(repository: any NotificationRepository = RemoteNotificationRepository(client: .shared)) {
        self.repository = repository
    }

    func load() async {
        let staleData: [OrdexNotification]? = if case .success(let data) = state { data } else { nil }
        state = .loading(staleData: staleData)
        
        do {
            let notifications = try await repository.getFeed()
            state = .success(notifications)
        } catch {
            state = .error(error, staleData: staleData)
        }
    }

    func markAllRead() async {
        guard case .success(let notifications) = state else { return }
        let unreadIds = notifications.filter { !$0.isRead }.map(\.id)
        guard !unreadIds.isEmpty else { return }
        
        do {
            try await repository.markRead(ids: unreadIds)
            await load()
        } catch {
            // Silently fail or log for background actions
        }
    }
}

