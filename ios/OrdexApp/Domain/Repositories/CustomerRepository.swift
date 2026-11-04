import Foundation
import SwiftUI

protocol CustomerRepository {
    func listCustomers(query: CustomersQuery) async throws -> PaginatedResponse<Customer>
    func createCustomer(customer: Customer) async throws -> Customer
    func getCustomer(id: String) async throws -> Customer
}

struct CustomerRepositoryKey: EnvironmentKey {
    static let defaultValue: any CustomerRepository = RemoteCustomerRepository(client: .shared)
}

extension EnvironmentValues {
    var customerRepository: any CustomerRepository {
        get { self[CustomerRepositoryKey.self] }
        set { self[CustomerRepositoryKey.self] = newValue }
    }
}
