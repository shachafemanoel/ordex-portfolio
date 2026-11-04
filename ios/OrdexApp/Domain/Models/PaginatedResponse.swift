import Foundation

struct PaginationMeta: Decodable {
    let total: Int
    let page: Int
    let limit: Int
    let totalPages: Int
    let hasNext: Bool?
    let hasPrev: Bool?

    var hasMore: Bool { hasNext ?? (page < totalPages) }

    init(total: Int, page: Int, limit: Int, totalPages: Int, hasNext: Bool? = nil, hasPrev: Bool? = nil) {
        self.total = total
        self.page = page
        self.limit = limit
        self.totalPages = totalPages
        self.hasNext = hasNext
        self.hasPrev = hasPrev
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        // Handle 'total' being missing or 0
        total = (try? container.decode(Int.self, forKey: .total)) 
            ?? (try? container.decode(Int.self, forKey: .totalItems))
            ?? 0
            
        page = (try? container.decode(Int.self, forKey: .page)) 
            ?? (try? container.decode(Int.self, forKey: .currentPage))
            ?? 1
            
        limit = (try? container.decode(Int.self, forKey: .limit))
            ?? (try? container.decode(Int.self, forKey: .perPage))
            ?? (try? container.decode(Int.self, forKey: .pageSize))
            ?? 20
            
        // totalPages is optional in some backend responses
        if let tp = try? container.decode(Int.self, forKey: .totalPages) {
            totalPages = tp
        } else {
            totalPages = limit > 0 ? (total + limit - 1) / limit : 1
        }
        
        hasNext = try? container.decode(Bool.self, forKey: .hasNext)
        hasPrev = try? container.decode(Bool.self, forKey: .hasPrev)
    }

    private enum CodingKeys: String, CodingKey {
        case total, totalItems
        case page, currentPage
        case limit, perPage, pageSize
        case totalPages
        case hasNext
        case hasPrev
    }
}

struct PaginatedResponse<T: Decodable>: Decodable {
    let items: [T]
    let meta: PaginationMeta

    init(items: [T], meta: PaginationMeta) {
        self.items = items
        self.meta = meta
    }

    init(from decoder: Decoder) throws {
        // 1. Try decoding as a keyed container
        let keyedContainer = try decoder.container(keyedBy: CodingKeys.self)
        
        var itemsArr: [T]?
        var metaObj: PaginationMeta?
        
        // Try to find items in common keys
        if let directItems = try? keyedContainer.decode([T].self, forKey: .items) {
            itemsArr = directItems
        } else if let directData = try? keyedContainer.decode([T].self, forKey: .data) {
            itemsArr = directData
        } else if let directResults = try? keyedContainer.decode([T].self, forKey: .results) {
            itemsArr = directResults
        } else if let nestedDataContainer = try? keyedContainer.nestedContainer(keyedBy: CodingKeys.self, forKey: .data) {
            // Case: { "data": { "items": [...], "meta": {...} } }
            if let nestedItems = try? nestedDataContainer.decode([T].self, forKey: .items) {
                itemsArr = nestedItems
                metaObj = try? nestedDataContainer.decode(PaginationMeta.self, forKey: .meta)
            }
        }
        
        // Fallback for raw array
        if itemsArr == nil {
            if let array = try? decoder.singleValueContainer().decode([T].self) {
                self.items = array
                self.meta = PaginationMeta(total: array.count, page: 1, limit: max(20, array.count), totalPages: 1)
                return
            }
        }
        
        guard let finalItems = itemsArr else {
            throw DecodingError.dataCorrupted(.init(
                codingPath: decoder.codingPath,
                debugDescription: "Could not find items array in keys: items, data, results"
            ))
        }
        
        self.items = finalItems
        
        // Find meta
        if let meta = metaObj {
            self.meta = meta
        } else if let meta = (try? keyedContainer.decode(PaginationMeta.self, forKey: .meta))
            ?? (try? keyedContainer.decode(PaginationMeta.self, forKey: .pagination))
            ?? (try? keyedContainer.decode(PaginationMeta.self, forKey: .info)) {
            self.meta = meta
        } else if let flattenedMeta = try? PaginationMeta(from: decoder) {
            self.meta = flattenedMeta
        } else {
            self.meta = PaginationMeta(total: finalItems.count, page: 1, limit: 20, totalPages: 1)
        }
    }

    private enum CodingKeys: String, CodingKey {
        case items, data, results, results_list
        case meta, pagination, info, _meta
    }
}
