import Foundation

// The API returns PaginatedResponse<Order> directly in the data envelope.
// Order itself is Codable and maps directly. No separate DTO needed — the
// APIClient decodes PaginatedResponse<Order> from the ApiSuccessResponse wrapper.
// This file is kept for documentation purposes.
typealias OrderListResponseDTO = PaginatedResponse<Order>
