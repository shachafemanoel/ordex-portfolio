import Foundation

enum Resource<T> {
    case idle
    case loading(staleData: T?)
    case success(T)
    case error(Error, staleData: T?)
    
    var data: T? {
        switch self {
        case .idle: return nil
        case .loading(let staleData): return staleData
        case .success(let data): return data
        case .error(_, let staleData): return staleData
        }
    }
    
    var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }
    
    var error: Error? {
        if case .error(let error, _) = self { return error }
        return nil
    }
}
