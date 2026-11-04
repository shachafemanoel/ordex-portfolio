import Foundation

struct DashboardKpis: Codable {
    let revenue: Double?
    let activeOrders: Int?
    let newInstallations: Int?
    let newCustomers: Int?
    let monthlyGrowth: Double?
    let completedOrders: Int?
    let pendingPayments: Int?

    var displayRevenue: String {
        guard let revenue else { return "—" }
        return Int(revenue * 100).shekels
    }
}

struct DashboardRecentOrder: Codable, Identifiable {
    let id: String
    let number: String
    let customerName: String?
    let status: OrderStatus
    let totalCents: Int?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, number, customerName, status, totalCents, updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        number = try container.decodeIfPresent(String.self, forKey: .number) ?? "#000"
        customerName = try container.decodeIfPresent(String.self, forKey: .customerName)
        status = try container.decodeIfPresent(OrderStatus.self, forKey: .status) ?? .unknown
        totalCents = try container.decodeIfPresent(Int.self, forKey: .totalCents)
        updatedAt = try? container.decodeIfPresent(Date.self, forKey: .updatedAt) ?? nil
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(number, forKey: .number)
        try container.encode(customerName, forKey: .customerName)
        try container.encode(status, forKey: .status)
        try container.encode(totalCents, forKey: .totalCents)
        try container.encode(updatedAt, forKey: .updatedAt)
    }
}

struct DashboardData: Codable {
    let kpis: DashboardKpis?
    let recentOrders: [DashboardRecentOrder]?
    let statusCounts: [String: Int]?
    
    enum CodingKeys: String, CodingKey {
        case kpis, recentOrders, statusCounts
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        kpis = try container.decodeIfPresent(DashboardKpis.self, forKey: .kpis)
        recentOrders = try container.decodeIfPresent([DashboardRecentOrder].self, forKey: .recentOrders)
        statusCounts = try container.decodeIfPresent([String: Int].self, forKey: .statusCounts)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(kpis, forKey: .kpis)
        try container.encode(recentOrders, forKey: .recentOrders)
        try container.encode(statusCounts, forKey: .statusCounts)
    }
}
