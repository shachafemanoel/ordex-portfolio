import Foundation
import MapKit
import SwiftUI
import Observation

@Observable
final class DeliveryMapViewModel {
    var state: Resource<[GeoOrder]> = .idle
    var selectedOrder: GeoOrder? = nil
    var cameraPosition: MapCameraPosition = .automatic

    private let repository: any OrderRepository

    init(repository: any OrderRepository = RemoteOrderRepository(client: .shared)) {
        self.repository = repository
    }

    func loadPins() async {
        let staleData: [GeoOrder]? = if case .success(let data) = state { data } else { nil }
        state = .loading(staleData: staleData)
        
        do {
            let orders = try await repository.getGeoOrders()
            state = .success(orders)

            if let first = orders.first, staleData == nil {
                let region = MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: first.lat, longitude: first.lng),
                    span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5)
                )
                cameraPosition = .region(region)
            }
        } catch {
            state = .error(error, staleData: staleData)
        }
    }

    func select(_ order: GeoOrder) {
        selectedOrder = order
    }

    func clearSelection() {
        selectedOrder = nil
    }
}

