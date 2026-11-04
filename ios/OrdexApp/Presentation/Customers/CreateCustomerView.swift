import SwiftUI

struct CreateCustomerView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.customerRepository) private var repository
    
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var city = ""
    @State private var street = ""
    @State private var number = ""
    @State private var isSubmitting = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("פרטי לקוח") {
                    TextField("שם מלא", text: $name)
                    TextField("אימייל", text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    TextField("טלפון", text: $phone)
                        .keyboardType(.phonePad)
                }
                
                Section("כתובת") {
                    TextField("עיר", text: $city)
                    TextField("רחוב", text: $street)
                    TextField("מספר בית", text: $number)
                }
                
                if let error {
                    Section {
                        Text(error).foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("לקוח חדש")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ביטול") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("שמור") {
                        Task { await save() }
                    }
                    .disabled(name.isEmpty || isSubmitting)
                }
            }
            .overlay {
                if isSubmitting {
                    ProgressView().padding().background(.ultraThinMaterial).cornerRadius(8)
                }
            }
        }
    }

    private func save() async {
        isSubmitting = true
        error = nil
        
        let address = Customer.Address(
            city: city,
            street: street,
            number: number,
            floor: nil,
            apartment: nil,
            notes: nil,
            lat: nil,
            lng: nil
        )
        
        let customer = Customer(
            id: "", // Server will generate
            name: name,
            email: email.isEmpty ? nil : email,
            phone: phone.isEmpty ? nil : phone,
            creditLimitCents: 0,
            paymentTermsDays: 0,
            accountNotes: nil,
            billingAddress: address,
            shippingAddress: address,
            createdAt: nil,
            updatedAt: nil
        )
        
        do {
            _ = try await repository.createCustomer(customer: customer)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        isSubmitting = false
    }
}
