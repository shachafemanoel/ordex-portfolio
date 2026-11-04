import Foundation

final class RemoteCustomerRepository: CustomerRepository {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func listCustomers(query: CustomersQuery) async throws -> PaginatedResponse<Customer> {
        // createPaginatedResponse returns { data: T[], pagination: PaginationMeta }
        // The PaginatedResponse<T> model in iOS should match this structure.
        try await client.request(endpoint: .customers(query: query))
    }

    func createCustomer(customer: Customer) async throws -> Customer {
        // createDataResponse returns { data: T }
        struct DataWrapper: Decodable { let data: Customer }
        let wrapper: DataWrapper = try await client.request(endpoint: .createCustomer, body: customer)
        return wrapper.data
    }

    func getCustomer(id: String) async throws -> Customer {
        // Individual customer detail also usually wrapped in { data: T } or direct?
        // Let's assume { data: T } based on createDataResponse convention in the web app
        struct DataWrapper: Decodable { let data: Customer }
        let wrapper: DataWrapper = try await client.request(endpoint: .customerDetail(id: id))
        return wrapper.data
    }
}
