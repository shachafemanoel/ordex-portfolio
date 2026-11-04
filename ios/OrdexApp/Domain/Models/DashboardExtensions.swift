import Foundation

struct DashboardQuickAction: Codable, Identifiable {
    var id: String { href }
    let href: String
    let label: String
    let description: String
    let iconKey: String
}

struct DashboardActivityItem: Codable, Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let timeLabel: String
    let statusLabel: String?
    let dueLabel: String?
    let tone: String // "critical" | "warning" | "info"
    let href: String
}

struct DashboardHomeData: Codable {
    let userName: String
    let dateLabel: String
    let quickActions: [DashboardQuickAction]
    let activityItems: [DashboardActivityItem]
}

struct DashboardStats: Codable {
    let pendingCount: Int
    let inProgressCount: Int
    let completedTodayCount: Int
    let urgentCount: Int
}

struct DashboardActionableItem: Codable, Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let priority: Int
    let dueDate: Date?
    let type: String
}

struct DashboardActionableData: Codable {
    let items: [DashboardActionableItem]
}
