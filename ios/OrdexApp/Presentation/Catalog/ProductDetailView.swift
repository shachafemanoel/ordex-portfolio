import SwiftUI

struct ProductDetailView: View {
    let productId: String
    @State private var viewModel: ProductDetailViewModel?

    var body: some View {
        ZStack {
            OrdexTheme.Color.background.ignoresSafeArea()
            
            if let viewModel {
                ResourceView(resource: viewModel.state, onRetry: { Task { await viewModel.load() } }) { product in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            // Image Header
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color(.systemGray6))
                                .frame(height: 250)
                                .overlay {
                                    Image(systemName: "cube.box")
                                        .font(.system(size: 64))
                                        .foregroundColor(.secondary)
                                }
                                .padding(.horizontal)

                            VStack(alignment: .leading, spacing: 8) {
                                Text(product.name)
                                    .font(.title.bold())
                                
                                Text("SKU: \(product.sku)")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.horizontal)

                            VStack(alignment: .leading, spacing: 16) {
                                InfoRow(label: "מחיר בסיס", value: product.basePriceCents?.shekels ?? "—")
                                if let sale = product.salePriceCents {
                                    InfoRow(label: "מחיר מבצע", value: sale.shekels)
                                }
                                InfoRow(label: "מלאי זמין", value: "\(product.stock ?? 0)")
                                if let reorder = product.reorderLevel {
                                    InfoRow(label: "נקודת הזמנה", value: "\(reorder)")
                                }
                                InfoRow(label: "סוג רכש", value: product.procurementType ?? "—")
                            }
                            .padding()
                            .background(OrdexTheme.Color.surface)
                            .cornerRadius(12)
                            .padding(.horizontal)

                            if let description = product.description, !description.isEmpty {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("תיאור")
                                        .font(.headline)
                                    Text(description)
                                        .font(.body)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(.horizontal)
                            }
                        }
                        .padding(.vertical)
                    }
                }
            }
        }
        .navigationTitle("פרטי מוצר")
        .task {
            if viewModel == nil {
                viewModel = ProductDetailViewModel(productId: productId)
                await viewModel?.load()
            }
        }
    }
}

private struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
    }
}
