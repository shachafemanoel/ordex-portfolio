import SwiftUI

@main
struct OrdexApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    private let apiClient = APIClient.shared
    private let authSession = AuthSession.shared
    private let navigationRouter = NavigationRouter.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(authSession)
                .environment(navigationRouter)
                .environment(\.orderRepository, RemoteOrderRepository(client: apiClient))
                .environment(\.authRepository, RemoteAuthRepository(client: apiClient))
                .environment(\.dashboardRepository, RemoteDashboardRepository(client: apiClient))
                .environment(\.notificationRepository, RemoteNotificationRepository(client: apiClient))
                .environment(\.layoutDirection, .rightToLeft)
                .tint(OrdexTheme.Color.accent)
                .modelContainer(OrdexStore.shared)
        }
    }
}
