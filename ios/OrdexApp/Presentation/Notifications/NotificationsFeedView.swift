import SwiftUI

struct NotificationsFeedView: View {
    @Environment(\.notificationRepository) private var repository
    @State private var viewModel = NotificationsFeedViewModel()

    var body: some View {
        ZStack {
            OrdexTheme.Color.background.ignoresSafeArea()
            
            ResourceView(resource: viewModel.state, onRetry: { Task { await viewModel.load() } }) { notifications in
                if notifications.isEmpty {
                    EmptyStateView(
                        icon: "bell.slash",
                        title: "אין התראות",
                        message: "אין התראות חדשות כרגע"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: OrdexTheme.Spacing.s) {
                            ForEach(notifications) { notification in
                                NotificationRowView(notification: notification)
                                    .padding(.horizontal, 16)
                            }
                        }
                        .padding(.vertical, 16)
                    }
                    .refreshable { await viewModel.load() }
                }
            }
        }
        .navigationTitle("התראות")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if viewModel.unreadCount > 0 {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("סמן הכל") {
                        Task { await viewModel.markAllRead() }
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(OrdexTheme.Color.accent)
                }
            }
        }
        .task {
            viewModel = NotificationsFeedViewModel(repository: repository)
            await viewModel.load()
        }
    }
}

private struct NotificationRowView: View {
    let notification: OrdexNotification

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            // Icon / Status indicator
            ZStack {
                Circle()
                    .fill(notification.isRead ? OrdexTheme.Color.surface : OrdexTheme.Color.accent.opacity(0.2))
                    .frame(width: 40, height: 40)
                
                Image(systemName: iconName)
                    .foregroundColor(notification.isRead ? OrdexTheme.Color.textSecondary : OrdexTheme.Color.accent)
                    .font(.system(size: 18, weight: .semibold))
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(notification.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(OrdexTheme.Color.textPrimary)
                    
                    Spacer()
                    
                    Text(notification.createdAt.hebrewFormatted)
                        .font(.caption2)
                        .foregroundColor(OrdexTheme.Color.textSecondary)
                }
                
                if let body = notification.body {
                    Text(body)
                        .font(.caption)
                        .foregroundColor(OrdexTheme.Color.textSecondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
            }
        }
        .padding(12)
        .background(OrdexTheme.Color.surface.opacity(0.4))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(OrdexTheme.Color.border.opacity(0.5), lineWidth: 1)
        )
        .opacity(notification.isRead ? 0.7 : 1.0)
    }
    
    private var iconName: String {
        switch notification.type?.lowercased() {
        case "order_status": return "shippingbox"
        case "payment": return "creditcard"
        case "message": return "text.bubble"
        default: return "bell"
        }
    }
}

