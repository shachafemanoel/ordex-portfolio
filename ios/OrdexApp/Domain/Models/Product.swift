import Foundation

struct Product: Codable, Identifiable {
    let id: String
    let name: String
    let sku: String
    let wooId: String?
    let procurementType: String?
    let type: String?
    let basePriceCents: Int?
    let priceCents: Int?
    let salePriceCents: Int?
    let price: Double?
    let basePrice: Double?
    let salePrice: Double?
    let currency: String?
    let stock: Int?
    let stockUnits: Int?
    let reorderLevel: Int?
    let isActive: Bool?
    let isFeatured: Bool?
    let imageUrl: String?
    let description: String?
    let shortDescription: String?
    let createdAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name, sku, wooId, procurementType, type
        case basePriceCents, priceCents, salePriceCents
        case price, basePrice, salePrice, currency
        case stock, stockUnits, reorderLevel, isActive
        case isFeatured, imageUrl, description, shortDescription
        case createdAt, updatedAt
    }

    // Separate enum for snake_case fallbacks to avoid compiler errors in CodingKeys
    private enum FallbackKeys: String, CodingKey {
        case woo_id, is_featured, base_price_cents, image_url
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let fallback = try? decoder.container(keyedBy: FallbackKeys.self)
        
        id = try container.decode(String.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? "פריט כללי"
        sku = try container.decodeIfPresent(String.self, forKey: .sku) ?? "N/A"
        
        // Robust wooId decoding (can be String or Int)
        if let stringValue = try? container.decodeIfPresent(String.self, forKey: .wooId) {
            wooId = stringValue
        } else if let intValue = try? container.decodeIfPresent(Int.self, forKey: .wooId) {
            wooId = String(intValue)
        } else if let stringValue = try? fallback?.decodeIfPresent(String.self, forKey: .woo_id) {
            wooId = stringValue
        } else if let intValue = try? fallback?.decodeIfPresent(Int.self, forKey: .woo_id) {
            wooId = String(intValue)
        } else {
            wooId = nil
        }
        
        procurementType = try container.decodeIfPresent(String.self, forKey: .procurementType)
        type = try container.decodeIfPresent(String.self, forKey: .type)
        
        basePriceCents = try container.decodeIfPresent(Int.self, forKey: .basePriceCents) 
            ?? fallback?.decodeIfPresent(Int.self, forKey: .base_price_cents) ?? nil
        priceCents = try container.decodeIfPresent(Int.self, forKey: .priceCents)
        salePriceCents = try container.decodeIfPresent(Int.self, forKey: .salePriceCents)
        
        price = try container.decodeIfPresent(Double.self, forKey: .price)
        basePrice = try container.decodeIfPresent(Double.self, forKey: .basePrice)
        salePrice = try container.decodeIfPresent(Double.self, forKey: .salePrice)
        currency = try container.decodeIfPresent(String.self, forKey: .currency)
        
        stock = try container.decodeIfPresent(Int.self, forKey: .stock)
        stockUnits = try container.decodeIfPresent(Int.self, forKey: .stockUnits)
        reorderLevel = try container.decodeIfPresent(Int.self, forKey: .reorderLevel)
        
        isActive = try container.decodeIfPresent(Bool.self, forKey: .isActive)
        isFeatured = try container.decodeIfPresent(Bool.self, forKey: .isFeatured) 
            ?? fallback?.decodeIfPresent(Bool.self, forKey: .is_featured) ?? nil
        
        imageUrl = try container.decodeIfPresent(String.self, forKey: .imageUrl) 
            ?? fallback?.decodeIfPresent(String.self, forKey: .image_url) ?? nil
        
        description = try container.decodeIfPresent(String.self, forKey: .description)
        shortDescription = try container.decodeIfPresent(String.self, forKey: .shortDescription)
        
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(sku, forKey: .sku)
        try container.encode(wooId, forKey: .wooId)
        try container.encode(procurementType, forKey: .procurementType)
        try container.encode(type, forKey: .type)
        try container.encode(basePriceCents, forKey: .basePriceCents)
        try container.encode(priceCents, forKey: .priceCents)
        try container.encode(salePriceCents, forKey: .salePriceCents)
        try container.encode(price, forKey: .price)
        try container.encode(basePrice, forKey: .basePrice)
        try container.encode(salePrice, forKey: .salePrice)
        try container.encode(currency, forKey: .currency)
        try container.encode(stock, forKey: .stock)
        try container.encode(stockUnits, forKey: .stockUnits)
        try container.encode(reorderLevel, forKey: .reorderLevel)
        try container.encode(isActive, forKey: .isActive)
        try container.encode(isFeatured, forKey: .isFeatured)
        try container.encode(imageUrl, forKey: .imageUrl)
        try container.encode(description, forKey: .description)
        try container.encode(shortDescription, forKey: .shortDescription)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
    }
}

struct ProductListQuery {
    var page: Int = 1
    var limit: Int = 20
    var search: String = ""

    var queryItems: [URLQueryItem] {
        var items = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if !search.isEmpty {
            items.append(URLQueryItem(name: "q", value: search))
        }
        return items
    }
}
