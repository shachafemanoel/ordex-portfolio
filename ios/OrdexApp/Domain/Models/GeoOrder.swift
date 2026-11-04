import Foundation
import CoreLocation

struct GeoOrder: Codable, Identifiable {
    let id: String
    let number: String
    let lat: Double
    let lng: Double
    let status: OrderStatus
    let customerName: String?
    let city: String?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}
