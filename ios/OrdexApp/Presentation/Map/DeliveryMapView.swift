import SwiftUI
import MapKit

struct DeliveryMapView: View {
    @Environment(\.orderRepository) private var repository
    @State private var viewModel = DeliveryMapViewModel()
    @State private var navigateToOrder: OrderNavigationTarget? = nil

    var body: some View {
        ZStack {
            OrdexTheme.Color.background.ignoresSafeArea()
            
            ResourceView(resource: viewModel.state, onRetry: { Task { await viewModel.loadPins() } }) { annotations in
                Map(position: $viewModel.cameraPosition) {
                    ForEach(annotations) { order in
                        Annotation(
                            "#\(order.number)",
                            coordinate: order.coordinate,
                            anchor: .bottom
                        ) {
                            OrderPinView(order: order)
                                .onTapGesture {
                                    withAnimation(.spring()) {
                                        viewModel.select(order)
                                    }
                                }
                        }
                    }
                }
                .mapStyle(.standard(emphasis: .muted, pointsOfInterest: .excludingAll))
            }
            .ignoresSafeArea(edges: .bottom)

            // Callout overlay
            if let selected = viewModel.selectedOrder {
                VStack {
                    Spacer()
                    OrderPinCallout(
                        order: selected,
                        onOpen: {
                            navigateToOrder = OrderNavigationTarget(id: selected.id)
                            viewModel.clearSelection()
                        },
                        onDismiss: { 
                            withAnimation(.spring()) {
                                viewModel.clearSelection()
                            }
                        }
                    )
                    .padding(.bottom, 40)
                    .padding(.horizontal, 16)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .navigationTitle("מפת משלוחים")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await viewModel.loadPins() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .foregroundColor(OrdexTheme.Color.accent)
                }
            }
        }
        .navigationDestination(item: $navigateToOrder) { target in
            OrderDetailView(orderId: target.id)
        }
        .task {
            viewModel = DeliveryMapViewModel(repository: repository)
            await viewModel.loadPins()
        }
    }
}

private struct OrderNavigationTarget: Identifiable, Hashable {
    let id: String
}

