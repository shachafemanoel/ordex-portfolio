import SwiftUI

struct ProfileView: View {
    @Environment(\.authRepository) private var authRepository
    @State private var viewModel = ProfileViewModel()
    @State private var showLogoutConfirm = false

    var body: some View {
        ZStack {
            OrdexTheme.Color.background.ignoresSafeArea()
            
            ResourceView(resource: viewModel.state, onRetry: {
                Task { await viewModel.loadUser() }
            }) { user in
                List {
                    Section {
                        HStack(spacing: OrdexTheme.Spacing.m) {
                            ZStack {
                                Circle()
                                    .fill(OrdexTheme.Color.accent.opacity(0.15))
                                    .frame(width: 64, height: 64)
                                Text(user.displayName.prefix(1).uppercased())
                                    .font(.title.bold())
                                    .foregroundStyle(OrdexTheme.Color.accent)
                            }
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.displayName)
                                    .font(.headline)
                                    .foregroundColor(OrdexTheme.Color.textPrimary)
                                Text(user.email)
                                    .font(.subheadline)
                                    .foregroundStyle(OrdexTheme.Color.textSecondary)
                                    .environment(\.layoutDirection, .leftToRight)
                            }
                        }
                        .padding(.vertical, OrdexTheme.Spacing.s)
                    }
                    .listRowBackground(OrdexTheme.Color.surface)

                    Section("ניהול ותפעול") {
                        NavigationLink {
                            DashboardView()
                        } label: {
                            Label("דשבורד", systemImage: "chart.bar.fill")
                        }

                        NavigationLink {
                            DeliveryMapView()
                        } label: {
                            Label("מפה", systemImage: "map.fill")
                        }

                        NavigationLink {
                            NotificationsFeedView()
                        } label: {
                            Label("התראות", systemImage: "bell.fill")
                        }
                    }
                    .listRowBackground(OrdexTheme.Color.surface)

                    Section("הגדרות") {
                        NavigationLink {
                            SettingsView()
                        } label: {
                            Label("הגדרות חנות", systemImage: "gearshape.fill")
                        }
                    }
                    .listRowBackground(OrdexTheme.Color.surface)

                    Section("מידע כללי") {
                        LabeledContent {
                            Text(user.role.hebrewLabel)
                                .foregroundColor(OrdexTheme.Color.textPrimary)
                        } label: {
                            Text("תפקיד")
                                .foregroundColor(OrdexTheme.Color.textSecondary)
                        }
                        
                        LabeledContent {
                            Text("\(user.permissions.count) הרשאות")
                                .foregroundColor(OrdexTheme.Color.textPrimary)
                        } label: {
                            Text("הרשאות")
                                .foregroundColor(OrdexTheme.Color.textSecondary)
                        }
                    }
                    .listRowBackground(OrdexTheme.Color.surface)

                    Section {
                        Button(role: .destructive) {
                            showLogoutConfirm = true
                        } label: {
                            HStack {
                                if viewModel.isLoggingOut {
                                    ProgressView()
                                } else {
                                    Image(systemName: "rectangle.portrait.and.arrow.right")
                                }
                                Text("יציאה מהחשבון")
                            }
                        }
                        .disabled(viewModel.isLoggingOut)
                    }
                    .listRowBackground(OrdexTheme.Color.surface)
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .refreshable {
                    await viewModel.loadUser()
                }
            }
        }
        .navigationTitle("פרופיל")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(OrdexTheme.Color.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .confirmationDialog("האם אתה בטוח שברצונך לצאת?", isPresented: $showLogoutConfirm, titleVisibility: .visible) {
            Button("יציאה", role: .destructive) {
                Task { await viewModel.logout() }
            }
            Button("ביטול", role: .cancel) {}
        }
        .task {
            viewModel = ProfileViewModel(authRepository: authRepository)
            await viewModel.loadUser()
        }
    }
}
