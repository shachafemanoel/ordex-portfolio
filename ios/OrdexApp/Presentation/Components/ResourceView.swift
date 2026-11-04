import SwiftUI

struct ResourceView<T, Content: View>: View {
    let resource: Resource<T>
    let showLoadingWhenStale: Bool
    let onRetry: () -> Void
    @ViewBuilder let content: (T) -> Content
    
    init(
        resource: Resource<T>,
        showLoadingWhenStale: Bool = false,
        onRetry: @escaping () -> Void = {},
        @ViewBuilder content: @escaping (T) -> Content
    ) {
        self.resource = resource
        self.showLoadingWhenStale = showLoadingWhenStale
        self.onRetry = onRetry
        self.content = content
    }
    
    var body: some View {
        switch resource {
        case .idle:
            Color.clear
            
        case .loading(let staleData):
            if let staleData = staleData, !showLoadingWhenStale {
                content(staleData)
                    .overlay(alignment: .top) {
                        LinearProgressView()
                    }
            } else {
                LoadingView()
            }
            
        case .success(let data):
            content(data)
            
        case .error(let error, let staleData):
            if let staleData = staleData {
                content(staleData)
                    .overlay(alignment: .bottom) {
                        ErrorBanner(message: error.localizedDescription, retry: onRetry)
                            .padding()
                    }
            } else {
                VStack(spacing: OrdexTheme.Spacing.m) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 48))
                        .foregroundColor(OrdexTheme.Color.error)
                    
                    Text(error.localizedDescription)
                        .font(.headline)
                        .multilineTextAlignment(.center)
                    
                    Button("נסה שוב", action: onRetry)
                        .buttonStyle(.borderedProminent)
                        .tint(OrdexTheme.Color.accent)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}

private struct LinearProgressView: View {
    @State private var offset: CGFloat = -1
    
    var body: some View {
        GeometryReader { geo in
            Rectangle()
                .fill(OrdexTheme.Color.accent)
                .frame(width: geo.size.width * 0.3, height: 3)
                .offset(x: geo.size.width * offset)
                .onAppear {
                    withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                        offset = 1
                    }
                }
        }
        .frame(height: 3)
        .clipped()
    }
}
