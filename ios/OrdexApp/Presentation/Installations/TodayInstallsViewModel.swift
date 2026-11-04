import Foundation
import Observation

@MainActor
@Observable
final class TodayInstallsViewModel {
    private let repository: any OrderRepository

    var state: Resource<[DailyOpsSectionModel]> = .idle
    var selectedDate: Date = .now

    init(repository: any OrderRepository) {
        self.repository = repository
    }

    func load() async {
        state = .loading(staleData: state.data)
        do {
            let query = OrdersQuery(
                page: 1,
                limit: 200,
                statuses: operationalStatuses.map(\.rawValue),
                includeItems: true,
                sort: "scheduledAt",
                direction: "asc"
            )
            let paginated = try await repository.listOrders(query: query)
            state = .success(makeSections(from: paginated.items))
        } catch {
            state = .error(error, staleData: state.data)
        }
    }

    func refresh() async {
        await load()
    }

    func performAction(order: Order, action: OrderAction, payload: OrderActionPayload?) async {
        do {
            _ = try await repository.performAction(id: order.id, action: action.type, payload: payload)
            await load()
        } catch {
            await load()
        }
    }

    // MARK: - Private

    private var operationalStatuses: [OrderStatus] {
        [
            .callBack,
            .pendingApproval,
            .confirmed,
            .toDo,
            .ready,
            .poCreated,
            .awaitingStock,
            .partiallySupplied,
            .installScheduling,
            .readyForInstall,
            .awaitingInstall,
            .scheduled,
            .inTransit,
            .installation,
            .onHold,
            .unknown,
        ]
    }

    private func makeSections(from orders: [Order]) -> [DailyOpsSectionModel] {
        var assignedOrderIds = Set<String>()

        func take(_ bucket: DailyOpsBucket, matching predicate: (Order) -> Bool) -> DailyOpsSectionModel {
            let bucketOrders = orders
                .filter { !assignedOrderIds.contains($0.id) && predicate($0) }
                .sorted(by: sortForDailyOps)
            assignedOrderIds.formUnion(bucketOrders.map(\.id))
            return DailyOpsSectionModel(bucket: bucket, orders: bucketOrders)
        }

        return [
            take(.needsAttention, matching: needsAttention),
            take(.prepareOrders, matching: isPrepareOrder),
            take(.waitingForGoods, matching: isWaitingForGoods),
            take(.readyToSchedule, matching: isReadyToSchedule),
            take(.installationsToday, matching: isInstallationOnSelectedDate),
            take(.upcoming, matching: isUpcoming),
        ]
    }

    private func needsAttention(_ order: Order) -> Bool {
        order.status == .callBack ||
            order.status == .pendingApproval ||
            order.status == .onHold ||
            order.status == .unknown ||
            order.customerPhone?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false ||
            addressText(for: order).isEmpty ||
            order.items.isEmpty
    }

    private func isPrepareOrder(_ order: Order) -> Bool {
        order.status == .confirmed ||
            order.status == .toDo ||
            (order.status == .ready && order.scheduledAt == nil)
    }

    private func isWaitingForGoods(_ order: Order) -> Bool {
        order.status == .poCreated ||
            order.status == .awaitingStock ||
            order.status == .partiallySupplied
    }

    private func isReadyToSchedule(_ order: Order) -> Bool {
        order.status == .installScheduling || order.status == .readyForInstall
    }

    private func isInstallationOnSelectedDate(_ order: Order) -> Bool {
        guard let scheduledAt = order.scheduledAt else { return false }
        let installStatuses: Set<OrderStatus> = [.awaitingInstall, .scheduled, .inTransit, .installation]
        return installStatuses.contains(order.status) &&
            Calendar.current.isDate(scheduledAt, inSameDayAs: selectedDate)
    }

    private func isUpcoming(_ order: Order) -> Bool {
        guard let scheduledAt = order.scheduledAt else { return false }
        return Calendar.current.startOfDay(for: scheduledAt) > Calendar.current.startOfDay(for: selectedDate)
    }

    private func sortForDailyOps(_ lhs: Order, _ rhs: Order) -> Bool {
        switch (lhs.scheduledAt, rhs.scheduledAt) {
        case let (lhsDate?, rhsDate?):
            return lhsDate < rhsDate
        case (_?, nil):
            return true
        case (nil, _?):
            return false
        case (nil, nil):
            return lhs.updatedAt > rhs.updatedAt
        }
    }

    private func addressText(for order: Order) -> String {
        [order.addressLine, order.city]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }
}

struct DailyOpsSectionModel: Identifiable {
    var id: DailyOpsBucket { bucket }
    let bucket: DailyOpsBucket
    let orders: [Order]
}

enum DailyOpsBucket: CaseIterable, Hashable {
    case needsAttention
    case prepareOrders
    case waitingForGoods
    case readyToSchedule
    case installationsToday
    case upcoming

    var title: String {
        switch self {
        case .needsAttention: return "דורש טיפול"
        case .prepareOrders: return "הכנת הזמנות"
        case .waitingForGoods: return "ממתין לסחורה"
        case .readyToSchedule: return "מוכן לתיאום"
        case .installationsToday: return "התקנות היום"
        case .upcoming: return "קרוב"
        }
    }

    var icon: String {
        switch self {
        case .needsAttention: return "exclamationmark.triangle.fill"
        case .prepareOrders: return "shippingbox.fill"
        case .waitingForGoods: return "clock.badge.exclamationmark.fill"
        case .readyToSchedule: return "calendar.badge.plus"
        case .installationsToday: return "wrench.and.screwdriver.fill"
        case .upcoming: return "calendar"
        }
    }

    var emptyMessage: String {
        switch self {
        case .needsAttention: return "אין הזמנות שמצריכות טיפול"
        case .prepareOrders: return "אין הזמנות להכנה"
        case .waitingForGoods: return "אין הזמנות שממתינות לסחורה"
        case .readyToSchedule: return "אין הזמנות לתיאום"
        case .installationsToday: return "אין התקנות לתאריך הזה"
        case .upcoming: return "אין עבודות קרובות"
        }
    }
}
