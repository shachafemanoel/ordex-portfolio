import Foundation

struct OrdersQuery {
    var page: Int = 1
    var limit: Int = 20
    var statuses: [String] = []
    var search: String = ""
    var scheduledDate: String? = nil  // "YYYY-MM-DD"
    var installerName: String? = nil
    var includeItems: Bool = false
    var sort: String? = nil
    var direction: String? = nil

    var queryItems: [URLQueryItem] {
        var items = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if !statuses.isEmpty {
            items.append(URLQueryItem(name: "status", value: statuses.joined(separator: ",")))
        }
        if !search.isEmpty {
            items.append(URLQueryItem(name: "q", value: search))
        }
        if let scheduledDate {
            items.append(URLQueryItem(name: "scheduledAt", value: scheduledDate))
        }
        if let installerName {
            items.append(URLQueryItem(name: "installerName", value: installerName))
        }
        if includeItems {
            items.append(URLQueryItem(name: "includeItems", value: "true"))
        }
        if let sort {
            items.append(URLQueryItem(name: "sort", value: sort))
        }
        if let direction {
            items.append(URLQueryItem(name: "dir", value: direction))
        }
        return items
    }
}

struct CustomersQuery {
    var page: Int = 1
    var limit: Int = 50
    var query: String = ""

    var queryItems: [URLQueryItem] {
        var items = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "perPage", value: "\(limit)"),
        ]
        if !query.isEmpty {
            items.append(URLQueryItem(name: "query", value: query))
        }
        return items
    }
}

enum HTTPMethod: String {
    case GET, POST, PUT, PATCH, DELETE
}

enum APIEndpoint {
    // Auth
    case login
    case logout
    case me
    case register

    // Orders
    case orders(query: OrdersQuery)
    case orderDetail(id: String)
    case orderTimeline(id: String)
    case updateOrderStatus(id: String)
    case advanceOrderStatus(id: String)
    case orderChecklist(id: String)
    case addOrderNote(id: String)
    case ordersGeo
    case orderActions(id: String)
    case performOrderAction(id: String)

    // Customers
    case customers(query: CustomersQuery)
    case createCustomer
    case customerDetail(id: String)

    // Products
    case products(query: ProductListQuery)
    case productDetail(id: String)

    // Dashboard
    case dashboardOverview
    case dashboardHome
    case dashboardStats
    case dashboardActionable

    // Notifications
    case notificationsFeed
    case markNotificationsRead

    // Push
    case registerPushToken

    // Settings
    case storeSettings

    var path: String {
        switch self {
        case .login: return "/api/auth/login"
        case .logout: return "/api/auth/logout"
        case .me: return "/api/auth/me"
        case .register: return "/api/auth/register"
        case .orders: return "/api/orders"
        case .orderDetail(let id): return "/api/orders/\(id)"
        case .orderTimeline(let id): return "/api/orders/\(id)/timeline"
        case .updateOrderStatus(let id): return "/api/orders/\(id)/status"
        case .advanceOrderStatus(let id): return "/api/orders/\(id)/advance-status"
        case .orderChecklist(let id): return "/api/orders/\(id)/checklist"
        case .addOrderNote(let id): return "/api/orders/\(id)/notes"
        case .ordersGeo: return "/api/orders/geo"
        case .orderActions(let id): return "/api/orders/\(id)/actions"
        case .performOrderAction(let id): return "/api/orders/\(id)/actions"
        case .customers: return "/api/customers"
        case .createCustomer: return "/api/customers"
        case .customerDetail(let id): return "/api/customers/\(id)"
        case .products: return "/api/products"
        case .productDetail(let id): return "/api/products/\(id)"
        case .dashboardOverview: return "/api/dashboard/overview"
        case .dashboardHome: return "/api/dashboard/home"
        case .dashboardStats: return "/api/dashboard/stats"
        case .dashboardActionable: return "/api/dashboard/actionable"
        case .notificationsFeed: return "/api/notifications/feed"
        case .markNotificationsRead: return "/api/notifications/read"
        case .registerPushToken: return "/api/push/subscribe"
        case .storeSettings: return "/api/store/settings"
        }
    }

    var method: HTTPMethod {
        switch self {
        case .login, .logout, .register, .updateOrderStatus, .advanceOrderStatus, .orderChecklist, .addOrderNote, .markNotificationsRead, .registerPushToken, .createCustomer, .performOrderAction:
            return .POST
        default:
            return .GET
        }
    }

    var queryItems: [URLQueryItem]? {
        switch self {
        case .orders(let query): return query.queryItems
        case .customers(let query): return query.queryItems
        case .products(let query): return query.queryItems
        default: return nil
        }
    }
}
