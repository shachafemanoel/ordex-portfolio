import SwiftUI

struct MainTabView: View {
    @Environment(NavigationRouter.self) private var router
    @State private var selectedTab = 0
    @State private var installsPath = NavigationPath()
    @State private var ordersPath = NavigationPath()
    @State private var deliveriesPath = NavigationPath()
    @State private var customersPath = NavigationPath()
    @State private var catalogPath = NavigationPath()

    var body: some View {
        TabView(selection: $selectedTab) {
            // 1. Daily Ops
            NavigationStack(path: $installsPath) {
                TodayInstallsView()
                    .navigationDestination(for: String.self) { orderId in
                        OrderDetailView(orderId: orderId)
                    }
            }
            .tabItem { Label("היום", systemImage: "wrench.and.screwdriver") }
            .tag(0)

            // 2. Orders
            NavigationStack(path: $ordersPath) {
                OrderQueueView()
                    .navigationDestination(for: String.self) { orderId in
                        OrderDetailView(orderId: orderId)
                    }
            }
            .tabItem { Label("הזמנות", systemImage: "list.bullet.clipboard") }
            .tag(1)

            // 3. Deliveries
            NavigationStack(path: $deliveriesPath) {
                DeliveriesView()
                    .navigationDestination(for: String.self) { orderId in
                        OrderDetailView(orderId: orderId)
                    }
            }
            .tabItem { Label("משלוחים", systemImage: "box.truck") }
            .tag(2)

            // 4. Catalog
            NavigationStack(path: $catalogPath) {
                ProductListView()
                    .navigationDestination(for: String.self) { productId in
                        ProductDetailView(productId: productId)
                    }
            }
            .tabItem { Label("קטלוג", systemImage: "grid") }
            .tag(3)

            // 5. Customers
            NavigationStack(path: $customersPath) {
                CustomersListView()
                    .navigationDestination(for: String.self) { customerId in
                        CustomerDetailView(customerId: customerId)
                    }
            }
            .tabItem { Label("לקוחות", systemImage: "person.2") }
            .tag(4)

            // 6. Profile & More
            NavigationStack {
                ProfileView()
            }
            .tabItem { Label("עוד", systemImage: "ellipsis.circle") }
            .tag(5)
        }
        .onChange(of: router.pendingNavigation) { _, newLink in
            if let link = newLink {
                handleDeepLink(link)
                router.clearPendingNavigation()
            }
        }
    }

    private func handleDeepLink(_ link: DeepLink) {
        switch link {
        case .orderDetail(let id):
            selectedTab = 0
            installsPath.append(id)
        }
    }
}
