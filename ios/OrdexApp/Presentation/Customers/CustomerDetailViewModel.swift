import Foundation
import Observation

@MainActor
@Observable
final class CustomerDetailViewModel {
    var state: Resource<Customer> = .idle
    private let customerId: String
    private let repository: any CustomerRepository

    init(customerId: String, repository: any CustomerRepository = RemoteCustomerRepository(client: .shared)) {
        self.customerId = customerId
        self.repository = repository
    }

    func load() async {
        state = .loading(staleData: state.data)
        do {
            let customer = try await repository.getCustomer(id: customerId)
            state = .success(customer)
        } catch {
            state = .error(error, staleData: state.data)
        }
    }
}
