import SwiftUI

struct OrderQueueView: View {
    @Environment(\.orderRepository) private var repository
    
    // Use optional @State to ensure initialization happens once in .task
    @State private var viewModel: OrderQueueViewModel?

    var body: some View {
        ZStack {
            OrdexTheme.Color.background.ignoresSafeArea()
            
            VStack(spacing: 0) {
                if let viewModel = viewModel {
                    StatusFilterChipsView(
                        selectedStatuses: viewModel.selectedStatuses,
                        onToggle: { viewModel.setStatusFilter($0) },
                        onClear: { viewModel.clearFilters() }
                    )
                    .padding(.vertical, OrdexTheme.Spacing.s)
                    .background(OrdexTheme.Color.surface.opacity(0.8))
                    
                    ResourceView(resource: viewModel.state, onRetry: {
                        Task { await viewModel.loadOrders(reset: true) }
                    }) { orders in
                        if orders.isEmpty {
                            EmptyStateView(
                                icon: "list.bullet.clipboard",
                                title: "אין הזמנות",
                                message: "לא נמצאו הזמנות התואמות את הסינון"
                            )
                        } else {
                            List {
                                ForEach(orders) { order in
                                    NavigationLink(value: order.id) {
                                        OrderRowView(order: order)
                                            .padding(.vertical, 4)
                                    }
                                    .listRowBackground(Color.clear)
                                    .listRowSeparator(.hidden)
                                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                                    .onAppear {
                                        if order.id == orders.last?.id {
                                            Task { await viewModel.loadMore() }
                                        }
                                    }
                                }

                                if viewModel.hasMore {
                                    HStack {
                                        Spacer()
                                        ProgressView()
                                            .tint(OrdexTheme.Color.accent)
                                        Spacer()
                                    }
                                    .listRowBackground(Color.clear)
                                }
                            }
                            .listStyle(.plain)
                            .refreshable { await viewModel.refresh() }
                            .scrollContentBackground(.hidden)
                        }
                    }
                } else {
                    ProgressView()
                        .tint(OrdexTheme.Color.accent)
                }
            }
        }
        .navigationTitle("תור הזמנות")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(OrdexTheme.Color.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .searchable(text: Binding(
            get: { viewModel?.searchText ?? "" },
            set: { viewModel?.searchText = $0 }
        ), prompt: "חיפוש הזמנות")
        .onChange(of: viewModel?.searchText) { _, newValue in
            guard let newValue = newValue else { return }
            Task {
                try? await Task.sleep(nanoseconds: 500_000_000)
                if newValue == viewModel?.searchText {
                    await viewModel?.loadOrders(reset: true)
                }
            }
        }
        .task {
            if viewModel == nil {
                viewModel = OrderQueueViewModel(repository: repository)
                await viewModel?.loadOrders(reset: true)
            }
        }
    }
}
