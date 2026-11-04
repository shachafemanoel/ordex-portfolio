import SwiftUI

struct RootView: View {
    @Environment(AuthSession.self) private var authSession
    @Environment(NavigationRouter.self) private var router
    @Environment(\.authRepository) private var authRepository

    var body: some View {
        Group {
            if authSession.isRestoring {
                LoadingView(message: "בודק חיבור...")
            } else if authSession.isLoggedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: authSession.isLoggedIn)
        .task {
            if authSession.isRestoring {
                await authSession.restore(using: authRepository)
            }
        }
    }
}
