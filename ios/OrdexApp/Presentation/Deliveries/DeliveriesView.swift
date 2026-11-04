import SwiftUI
import MapKit

struct DeliveriesView: View {
    @State private var viewModel = DeliveriesViewModel()
    @State private var position: MapCameraPosition = .automatic

    @State private var activeOrderAction: ActiveOrderAction? = nil

    var body: some View {
        ZStack {
            OrdexTheme.Color.background.ignoresSafeArea()
            
            ResourceView(resource: viewModel.state, onRetry: { Task { await viewModel.load() } }) { orders in
                VStack(spacing: 0) {
                    // 1. Map Header
                    Map(position: $position) {
                        ForEach(orders) { order in
                            if let lat = order.lat, let lng = order.lng {
                                Annotation(order.customerName ?? "", coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng)) {
                                    OrderPinView(order: mapToGeo(order))
                                }
                            }
                        }
                    }
                    .frame(height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding()
                    .onAppear {
                        updateMapPosition(orders: orders)
                    }

                    // 2. Summary & Stats
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("משלוחי היום")
                                .font(.headline)
                            Text("\(orders.count) הזמנות בטיפול")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        
                        if viewModel.isUpdating {
                            ProgressView()
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 8)

                    // 3. Operational List
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(orders) { currentOrder in
                                NavigationLink(value: currentOrder.id) {
                                    DeliveryOpsRow(order: currentOrder) {
                                        activeOrderAction = ActiveOrderAction(
                                            order: currentOrder,
                                            action: OrderActionPresentation.prepareShipmentAction(for: currentOrder)
                                        )
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 100) // Bottom bar offset
                    }
                    .refreshable {
                        await viewModel.load()
                    }
                }
            }
        }
        .navigationTitle("תפעול שטח")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $activeOrderAction) { presentation in
            OrderActionSheet(order: presentation.order, action: presentation.action) { payload in
                activeOrderAction = nil
                handleActionConfirmation(presentation, payload: payload)
            } onCancel: {
                activeOrderAction = nil
            }
        }
        .task {
            await viewModel.load()
        }
    }

    private func updateMapPosition(orders: [Order]) {
        let coords = orders.compactMap { order -> CLLocationCoordinate2D? in
            guard let lat = order.lat, let lng = order.lng else { return nil }
            return CLLocationCoordinate2D(latitude: lat, longitude: lng)
        }
        
        if !coords.isEmpty {
            position = .automatic
        }
    }
    
    private func mapToGeo(_ order: Order) -> GeoOrder {
        GeoOrder(
            id: order.id,
            number: order.number,
            lat: order.lat ?? 0,
            lng: order.lng ?? 0,
            status: order.status,
            customerName: order.customerName,
            city: order.city
        )
    }

    private func handleActionConfirmation(_ presentation: ActiveOrderAction, payload: OrderActionPayload?) {
        guard OrderActionPresentation.shouldExecuteRemote(action: presentation.action, payload: payload) else {
            return
        }
        Task {
            await viewModel.performAction(
                presentation.order,
                action: presentation.action,
                payload: payload
            )
        }
    }
}
