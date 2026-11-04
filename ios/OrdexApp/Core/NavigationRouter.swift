import Foundation
import Observation

enum DeepLink: Equatable {
    case orderDetail(id: String)
}

@Observable
final class NavigationRouter {
    static let shared = NavigationRouter()
    var pendingNavigation: DeepLink? = nil

    private init() {}

    func navigate(to link: DeepLink) {
        pendingNavigation = link
    }

    func clearPendingNavigation() {
        pendingNavigation = nil
    }
}
