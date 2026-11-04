import SwiftUI

struct CustomerDetailView: View {
    let customerId: String
    @State private var viewModel: CustomerDetailViewModel?

    var body: some View {
        ZStack {
            OrdexTheme.Color.background.ignoresSafeArea()
            
            if let viewModel {
                ResourceView(resource: viewModel.state, onRetry: { Task { await viewModel.load() } }) { customer in
                    List {
                        Section("מידע בסיסי") {
                            LabeledContent("שם מלא", value: customer.name)
                            if let email = customer.email {
                                LabeledContent("אימייל", value: email)
                            }
                            if let phone = customer.phone {
                                LabeledContent("טלפון", value: phone)
                            }
                        }
                        
                        if let shipping = customer.shippingAddress {
                            Section("כתובת למשלוח") {
                                Text("\(shipping.street) \(shipping.number)")
                                Text(shipping.city)
                                if let notes = shipping.notes {
                                    Text(notes).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        
                        Section("פיננסי") {
                            if let limit = customer.creditLimitCents {
                                LabeledContent("מסגרת אשראי", value: limit.shekels)
                            }
                            if let terms = customer.paymentTermsDays {
                                LabeledContent("תנאי תשלום", value: "+ \(terms) יום")
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("פרטי לקוח")
        .task {
            if viewModel == nil {
                viewModel = CustomerDetailViewModel(customerId: customerId)
                await viewModel?.load()
            }
        }
    }
}
