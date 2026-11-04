import SwiftUI
import SwiftData

struct DashboardView: View {
    @Environment(\.dashboardRepository) private var repository
    @Environment(\.modelContext) private var modelContext
    
    // Use @State with a factory to avoid re-initialization issues in .task
    @State private var viewModel: DashboardViewModel?
    
    var body: some View {
        ZStack {
            OrdexTheme.Color.background.ignoresSafeArea()
            
            if let viewModel = viewModel {
                ResourceView(resource: viewModel.state, onRetry: {
                    Task { await viewModel.load(modelContext: modelContext) }
                }) { data in
                    ScrollView {
                        VStack(spacing: OrdexTheme.Spacing.l) {
                            if let kpis = data.kpis {
                                kpiSection(kpis)
                            }
                            
                            if let recent = data.recentOrders, !recent.isEmpty {
                                recentOrdersSection(recent)
                            }
                        }
                        .padding(OrdexTheme.Spacing.m)
                    }
                    .refreshable {
                        await viewModel.load(modelContext: modelContext)
                    }
                }
            } else {
                ProgressView()
                    .tint(OrdexTheme.Color.accent)
            }
        }
        .navigationTitle("דשבורד")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(OrdexTheme.Color.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task {
            if viewModel == nil {
                viewModel = DashboardViewModel(repository: repository)
            }
            await viewModel?.load(modelContext: modelContext)
        }
    }

    @ViewBuilder
    private func kpiSection(_ kpis: DashboardKpis) -> some View {
        VStack(alignment: .leading, spacing: OrdexTheme.Spacing.m) {
            Text("סיכום ביצועים")
                .font(.headline)
                .foregroundColor(OrdexTheme.Color.textPrimary)
                .padding(.leading, 4)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: OrdexTheme.Spacing.m) {
                KpiCard(title: "הזמנות פעילות", value: "\(kpis.activeOrders ?? 0)", icon: "list.bullet.clipboard", color: OrdexTheme.Color.accent)
                KpiCard(title: "הכנסה החודש", value: kpis.displayRevenue, icon: "shekel.sign.circle", color: OrdexTheme.Color.success)
                KpiCard(title: "התקנות חדשות", value: "\(kpis.newInstallations ?? 0)", icon: "wrench.and.screwdriver", color: OrdexTheme.Color.accent)
                KpiCard(title: "לקוחות חדשים", value: "\(kpis.newCustomers ?? 0)", icon: "person.badge.plus", color: OrdexTheme.Color.warning)
            }
        }
    }

    @ViewBuilder
    private func recentOrdersSection(_ orders: [DashboardRecentOrder]) -> some View {
        VStack(alignment: .leading, spacing: OrdexTheme.Spacing.m) {
            HStack {
                Text("הזמנות אחרונות")
                    .font(.headline)
                    .foregroundColor(OrdexTheme.Color.textPrimary)
                Spacer()
                NavigationLink("הצג הכל", value: "all_orders")
                    .font(.caption)
                    .foregroundColor(OrdexTheme.Color.accent)
            }
            .padding(.horizontal, 4)

            VStack(spacing: OrdexTheme.Spacing.s) {
                ForEach(orders) { order in
                    NavigationLink(value: order.id) {
                        HStack(spacing: OrdexTheme.Spacing.m) {
                            Circle()
                                .fill(OrdexTheme.Color.accent.opacity(0.1))
                                .frame(width: 44, height: 44)
                                .overlay {
                                    Text(order.number.suffix(2))
                                        .font(.system(.subheadline, design: .monospaced).bold())
                                        .foregroundColor(OrdexTheme.Color.accent)
                                }
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text(order.customerName ?? "לקוח מזדמן")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(OrdexTheme.Color.textPrimary)
                                Text("#\(order.number)")
                                    .font(.caption)
                                    .foregroundColor(OrdexTheme.Color.textSecondary)
                            }
                            
                            Spacer()
                            
                            VStack(alignment: .trailing, spacing: 4) {
                                StatusBadge(status: order.status)
                                if let total = order.totalCents {
                                    Text(total.shekels)
                                        .font(.caption.weight(.bold))
                                        .foregroundColor(OrdexTheme.Color.textPrimary)
                                }
                            }
                        }
                        .padding(OrdexTheme.Spacing.m)
                        .background(OrdexTheme.Color.surface.opacity(0.6))
                        .clipShape(RoundedRectangle(cornerRadius: 20))
                        .overlay {
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(OrdexTheme.Color.border.opacity(0.5), lineWidth: 1)
                        }
                        .shadow(color: Color.black.opacity(0.1), radius: 5, x: 0, y: 2)
                    }
                }
            }
        }
    }
}


private struct KpiCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: OrdexTheme.Spacing.s) {
            HStack {
                ZStack {
                    Circle()
                        .fill(color.opacity(0.15))
                        .frame(width: 32, height: 32)
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(color)
                }
                Spacer()
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.title3.bold())
                    .foregroundColor(OrdexTheme.Color.textPrimary)
                Text(title)
                    .font(.caption2)
                    .foregroundColor(OrdexTheme.Color.textSecondary)
            }
        }
        .padding(OrdexTheme.Spacing.m)
        .background(OrdexTheme.Color.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .stroke(OrdexTheme.Color.border, lineWidth: 1)
        }
    }
}
