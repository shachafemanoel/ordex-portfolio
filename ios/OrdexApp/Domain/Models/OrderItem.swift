import Foundation

enum AllocationStatus: String, Codable {
    case pending = "PENDING"
    case allocated = "ALLOCATED"
    case sent = "SENT"
    case received = "RECEIVED"

    var hebrewLabel: String {
        switch self {
        case .pending: return "ממתין"
        case .allocated: return "הוקצה"
        case .sent: return "נשלח"
        case .received: return "התקבל"
        }
    }

    var hexColor: String {
        switch self {
        case .pending: return "#94a3b8"
        case .allocated: return "#3b82f6"
        case .sent: return "#f97316"
        case .received: return "#22c55e"
        }
    }
}

struct OrderItem: Codable, Identifiable {
    let id: String
    let sku: String?
    let name: String
    let qty: Int
    let priceCents: Int?
    let totalCents: Int?
    let allocationStatus: AllocationStatus?
    let supplierId: String?
    let supplierName: String?
    let remarks: String?
    let receivedQuantity: Int?
    let installedQuantity: Int?
    let productId: String?

    var displayPrice: String { priceCents?.shekels ?? "—" }
    var displayTotal: String { totalCents?.shekels ?? "—" }
    enum CodingKeys: String, CodingKey {
        case id, sku, name, qty, remarks
        case priceCents, totalCents, allocationStatus, supplierId, supplierName, receivedQuantity, installedQuantity, productId
        case snakePriceCents = "unit_price_cents"
        case snakeTotalCents = "total_cents"
        case snakeAllocationStatus = "allocation_status"
        case snakeSupplierId = "supplier_id"
        case snakeSupplierName = "supplier_name"
        case snakeReceivedQuantity = "received_quantity"
        case snakeInstalledQuantity = "installed_quantity"
        case snakeProductId = "product_id"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        id = try container.decode(String.self, forKey: .id)
        
        // Robust SKU decoding (can be String or Int)
        if let s = try? container.decodeIfPresent(String.self, forKey: .sku) {
            sku = s
        } else if let i = try? container.decodeIfPresent(Int.self, forKey: .sku) {
            sku = String(i)
        } else {
            sku = nil
        }
        
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? "פריט ללא שם"
        qty = try container.decodeIfPresent(Int.self, forKey: .qty) ?? 0
        priceCents = (try? container.decodeIfPresent(Int.self, forKey: .priceCents))
            ?? (try? container.decodeIfPresent(Int.self, forKey: .snakePriceCents))
        totalCents = (try? container.decodeIfPresent(Int.self, forKey: .totalCents))
            ?? (try? container.decodeIfPresent(Int.self, forKey: .snakeTotalCents))
        allocationStatus = (try? container.decodeIfPresent(AllocationStatus.self, forKey: .allocationStatus))
            ?? (try? container.decodeIfPresent(AllocationStatus.self, forKey: .snakeAllocationStatus))
        supplierId = (try? container.decodeIfPresent(String.self, forKey: .supplierId))
            ?? (try? container.decodeIfPresent(String.self, forKey: .snakeSupplierId))
        supplierName = (try? container.decodeIfPresent(String.self, forKey: .supplierName))
            ?? (try? container.decodeIfPresent(String.self, forKey: .snakeSupplierName))
        remarks = try container.decodeIfPresent(String.self, forKey: .remarks)
        receivedQuantity = (try? container.decodeIfPresent(Int.self, forKey: .receivedQuantity))
            ?? (try? container.decodeIfPresent(Int.self, forKey: .snakeReceivedQuantity))
        installedQuantity = (try? container.decodeIfPresent(Int.self, forKey: .installedQuantity))
            ?? (try? container.decodeIfPresent(Int.self, forKey: .snakeInstalledQuantity))
        productId = (try? container.decodeIfPresent(String.self, forKey: .productId))
            ?? (try? container.decodeIfPresent(String.self, forKey: .snakeProductId))
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(sku, forKey: .sku)
        try container.encode(name, forKey: .name)
        try container.encode(qty, forKey: .qty)
        try container.encode(priceCents, forKey: .priceCents)
        try container.encode(totalCents, forKey: .totalCents)
        try container.encode(allocationStatus, forKey: .allocationStatus)
        try container.encode(supplierId, forKey: .supplierId)
        try container.encode(supplierName, forKey: .supplierName)
        try container.encode(remarks, forKey: .remarks)
        try container.encode(receivedQuantity, forKey: .receivedQuantity)
        try container.encode(installedQuantity, forKey: .installedQuantity)
        try container.encode(productId, forKey: .productId)
    }
}
