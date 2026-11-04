import Foundation
import Observation

struct OrderDetails: Equatable {
    let order: Order
    let timeline: OpsActivityTimeline?
    let availableActions: [OrderAction]
    
    static func == (lhs: OrderDetails, rhs: OrderDetails) -> Bool {
        lhs.order.id == rhs.order.id && 
        lhs.order.status == rhs.order.status &&
        lhs.availableActions.count == rhs.availableActions.count
    }
}

@MainActor
@Observable
final class OrderDetailViewModel {
    var state: Resource<OrderDetails> = .idle
    var isPerformingAction = false
    var isSubmittingNote = false
    var noteText = ""

    private let orderId: String
    private let repository: any OrderRepository

    init(orderId: String, repository: any OrderRepository = RemoteOrderRepository(client: .shared)) {
        self.orderId = orderId
        self.repository = repository
    }

    func load() async {
        // Keep stale data if we already have a success state
        let staleData: OrderDetails? = if case .success(let data) = state { data } else { nil }
        state = .loading(staleData: staleData)
        
        do {
            // Main order fetch is mandatory
            let fetchedOrder = try await repository.getOrder(id: orderId)
            
            // Optional fetches (don't fail the screen if they error)
            async let timelineFetch = try? repository.getTimeline(id: orderId)
            async let actionsFetch = try? repository.getAvailableActions(id: orderId)
            
            let (fetchedTimeline, fetchedActions) = await (timelineFetch, actionsFetch)
            
            let details = OrderDetails(
                order: fetchedOrder,
                timeline: fetchedTimeline,
                availableActions: fetchedActions ?? []
            )
            state = .success(details)
        } catch {
            state = .error(error, staleData: staleData)
        }
    }

    func updateStatus(to status: OrderStatus, reason: String?) async {
        isPerformingAction = true
        do {
            _ = try await repository.updateStatus(
                id: orderId,
                status: status,
                reason: reason
            )
            await load()
        } catch {
            // Error handling for actions can be a separate toast state
            // For now, reload to ensure UI is in sync
            await load()
        }
        isPerformingAction = false
    }

    func performAction(_ action: OrderAction, payload: OrderActionPayload? = nil) async {
        isPerformingAction = true
        do {
            _ = try await repository.performAction(
                id: orderId,
                action: action.type,
                payload: payload
            )
            await load()
        } catch {
            await load()
        }
        isPerformingAction = false
    }

    func addNote() async {
        let content = noteText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        isSubmittingNote = true
        do {
            _ = try await repository.addNote(id: orderId, content: content)
            noteText = ""
            await load()
        } catch {
            // Note failure handling
        }
        isSubmittingNote = false
    }
}

