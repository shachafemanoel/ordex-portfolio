import SwiftUI

struct CustomersListView: View {
    @State private var viewModel = CustomersViewModel()
    @State private var searchText = ""
    @State private var showCreateSheet = false

    var body: some View {
        ResourceView(resource: viewModel.state, onRetry: { Task { await viewModel.load() } }) { customers in
            List(customers) { customer in
                NavigationLink(value: customer.id) {
                    CustomerRow(customer: customer)
                }
            }
            .listStyle(.plain)
            .refreshable {
                await viewModel.load()
            }
        }
        .navigationTitle("לקוחות")
        .searchable(text: $searchText, prompt: "חפש לקוחות...")
        .onChange(of: searchText) { _, newValue in
            viewModel.search(text: newValue)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreateSheet = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            CreateCustomerView()
                .onDisappear {
                    Task { await viewModel.load() }
                }
        }
        .task {
            await viewModel.load()
        }
    }
}

private struct CustomerRow: View {
    let customer: Customer

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(customer.name)
                .font(.headline)
            
            HStack(spacing: 12) {
                if let phone = customer.phone {
                    Label(phone, systemImage: "phone.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                if let email = customer.email {
                    Label(email, systemImage: "envelope.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            if let city = customer.shippingAddress?.city {
                Label(city, systemImage: "mappin.and.ellipse")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}
