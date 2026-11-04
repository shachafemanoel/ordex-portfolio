import SwiftUI

struct SettingsView: View {
    @State private var viewModel = SettingsViewModel()

    var body: some View {
        ResourceView(resource: viewModel.state, onRetry: { Task { await viewModel.load() } }) { settings in
            List {
                Section("פרטי חנות") {
                    LabeledContent("שם החנות", value: settings.name)
                    LabeledContent("מטבע", value: settings.currency)
                    LabeledContent("אזור זמן", value: settings.timezone)
                }
                
                Section("מראה") {
                    if let primaryColor = settings.primaryColor {
                        HStack {
                            Text("צבע ראשי")
                            Spacer()
                            Circle()
                                .fill(Color(hex: primaryColor))
                                .frame(width: 24, height: 24)
                        }
                    }
                }
                
                Section {
                    Button("רענן הגדרות") {
                        Task { await viewModel.load() }
                    }
                }
            }
        }
        .navigationTitle("הגדרות חנות")
        .task {
            await viewModel.load()
        }
    }
}
