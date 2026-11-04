import SwiftUI

struct StatusUpdateSheet: View {
    let currentStatus: OrderStatus
    @Binding var isPresented: Bool
    let onConfirm: (OrderStatus, String?) async -> Void

    @State private var viewModel = StatusUpdateViewModel()
    @State private var isSubmitting = false

    private var allowedTransitions: [OrderStatus] {
        currentStatus.allowedTransitions
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if allowedTransitions.isEmpty {
                    EmptyStateView(
                        icon: "lock.circle",
                        title: "אין מעברים אפשריים",
                        message: "לא ניתן לשנות את הסטטוס מהמצב הנוכחי"
                    )
                } else {
                    List {
                        Section("בחר סטטוס חדש") {
                            ForEach(allowedTransitions, id: \.self) { status in
                                StatusTransitionRow(
                                    status: status,
                                    isSelected: viewModel.selectedStatus == status
                                ) {
                                    viewModel.selectedStatus = status
                                }
                            }
                        }

                        if viewModel.selectedStatus != nil {
                            Section("סיבה (אופציונלי)") {
                                TextField("הוסף סיבה לשינוי...", text: $viewModel.reason, axis: .vertical)
                                    .lineLimit(1...4)
                            }
                        }

                        if let error = viewModel.error {
                            Section {
                                Text(error)
                                    .foregroundStyle(.red)
                                    .font(.footnote)
                            }
                        }
                    }
                }

                // Confirm button
                if let selected = viewModel.selectedStatus {
                    Button {
                        Task {
                            isSubmitting = true
                            await onConfirm(selected, viewModel.reason.isEmpty ? nil : viewModel.reason)
                            isSubmitting = false
                            isPresented = false
                        }
                    } label: {
                        HStack {
                            if isSubmitting {
                                ProgressView().tint(.white)
                            }
                            Text("עדכן ל: \(selected.hebrewLabel)")
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(selected.color)
                    .padding()
                    .disabled(isSubmitting)
                }
            }
            .navigationTitle("עדכון סטטוס")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("ביטול") { isPresented = false }
                }
            }
        }
        .onDisappear { viewModel.reset() }
    }
}

private struct StatusTransitionRow: View {
    let status: OrderStatus
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack {
                StatusBadge(status: status)
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark")
                        .foregroundStyle(Color.ordexBlue)
                }
            }
        }
        .tint(.primary)
    }
}
