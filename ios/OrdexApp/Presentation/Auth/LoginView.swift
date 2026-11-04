import SwiftUI

struct LoginView: View {
    @Environment(\.authRepository) private var authRepository
    @State private var viewModel = LoginViewModel()

    var body: some View {
        ZStack {
            OrdexTheme.Color.background.ignoresSafeArea()
            
            VStack(spacing: 0) {
                Spacer()

                // Logo / Brand
                VStack(spacing: OrdexTheme.Spacing.s) {
                    ZStack {
                        Circle()
                            .fill(OrdexTheme.Color.accent.opacity(0.1))
                            .frame(width: 80, height: 80)
                        Image(systemName: "shippingbox.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(OrdexTheme.Color.accent)
                    }
                    
                    Text("OrdeX")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundColor(OrdexTheme.Color.textPrimary)
                    
                    Text("מערכת ניהול הזמנות")
                        .font(.subheadline)
                        .foregroundColor(OrdexTheme.Color.textSecondary)
                }
                .padding(.bottom, 48)

                // Form
                VStack(spacing: OrdexTheme.Spacing.l) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("אימייל")
                            .font(.subheadline.weight(.medium))
                            .foregroundColor(OrdexTheme.Color.textSecondary)
                        
                        TextField("הזן אימייל", text: $viewModel.email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .padding()
                            .background(OrdexTheme.Color.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay {
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(OrdexTheme.Color.border, lineWidth: 1)
                            }
                            .environment(\.layoutDirection, .leftToRight)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("סיסמה")
                            .font(.subheadline.weight(.medium))
                            .foregroundColor(OrdexTheme.Color.textSecondary)
                        
                        SecureField("הזן סיסמה", text: $viewModel.password)
                            .textContentType(.password)
                            .padding()
                            .background(OrdexTheme.Color.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay {
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(OrdexTheme.Color.border, lineWidth: 1)
                            }
                            .environment(\.layoutDirection, .leftToRight)
                    }

                    if let error = viewModel.errorMessage {
                        HStack {
                            Image(systemName: "exclamationmark.circle.fill")
                            Text(error)
                        }
                        .font(.footnote)
                        .foregroundColor(OrdexTheme.Color.error)
                        .padding(.vertical, 4)
                    }

                    Button {
                        Task { await viewModel.login() }
                    } label: {
                        HStack {
                            if viewModel.isLoading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("כניסה")
                                    .font(.headline)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .background(viewModel.isFormValid ? OrdexTheme.Color.accent : OrdexTheme.Color.accent.opacity(0.5))
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .shadow(color: OrdexTheme.Color.accent.opacity(0.3), radius: 10, x: 0, y: 5)
                    }
                    .disabled(!viewModel.isFormValid || viewModel.isLoading)
                }
                .padding(.horizontal, 32)

                Spacer()
                Spacer()
            }
        }
        .onAppear {
            viewModel = LoginViewModel(repository: authRepository)
        }
    }
}
