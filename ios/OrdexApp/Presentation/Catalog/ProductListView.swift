import SwiftUI

struct ProductListView: View {
    @State private var viewModel = CatalogViewModel()
    @State private var searchText = ""

    var body: some View {
        ResourceView(resource: viewModel.state, onRetry: { Task { await viewModel.load() } }) { products in
            List(products) { product in
                NavigationLink(value: product.id) {
                    ProductRow(product: product)
                }
            }
            .listStyle(.plain)
            .refreshable {
                await viewModel.load()
            }
        }
        .navigationTitle("קטלוג")
        .searchable(text: $searchText, prompt: "חפש מוצרים...")
        .onChange(of: searchText) { _, newValue in
            viewModel.search(text: newValue)
        }
        .task {
            await viewModel.load()
        }
    }
}

private struct ProductRow: View {
    let product: Product

    var body: some View {
        HStack(spacing: 12) {
            // Placeholder for image
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.systemGray6))
                .frame(width: 50, height: 50)
                .overlay {
                    Image(systemName: "cube.box")
                        .foregroundColor(.secondary)
                }

            VStack(alignment: .leading, spacing: 4) {
                Text(product.name)
                    .font(.subheadline.weight(.medium))
                
                Text("SKU: \(product.sku)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                if let price = product.salePriceCents ?? product.basePriceCents {
                    Text(price.shekels)
                        .font(.subheadline.weight(.bold))
                }
                
                if let stock = product.stock {
                    Text("מלאי: \(stock)")
                        .font(.caption2)
                        .foregroundStyle(stock > 0 ? .green : .red)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
