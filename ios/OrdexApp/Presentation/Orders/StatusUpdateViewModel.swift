import Foundation
import Observation

@MainActor
@Observable
final class StatusUpdateViewModel {
    var selectedStatus: OrderStatus? = nil
    var reason = ""
    var isSubmitting = false
    var error: String? = nil

    func reset() {
        selectedStatus = nil
        reason = ""
        error = nil
    }
}
