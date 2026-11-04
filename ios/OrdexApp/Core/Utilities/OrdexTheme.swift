import SwiftUI

enum OrdexTheme {
    // MARK: - Colors
    enum Color {
        static let background = adaptive(light: "#F6F8FB", dark: "#0B1220")
        static let surface = adaptive(light: "#FFFFFF", dark: "#111827")
        static let surfaceTint = adaptive(light: "#EAF2FF", dark: "#1E293B")
        static let accent = adaptive(light: "#1D4ED8", dark: "#93C5FD")
        static let success = adaptive(light: "#047857", dark: "#6EE7B7")
        static let warning = adaptive(light: "#B45309", dark: "#FCD34D")
        static let error = adaptive(light: "#B91C1C", dark: "#FCA5A5")
        
        static let textPrimary = adaptive(light: "#172033", dark: "#F8FAFC")
        static let textSecondary = adaptive(light: "#475569", dark: "#CBD5E1")
        
        static let border = adaptive(light: "#CBD5E1", dark: "#334155")

        static func adaptive(light: String, dark: String) -> SwiftUI.Color {
            SwiftUI.Color(UIColor { traits in
                UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
            })
        }
    }
    
    // MARK: - Gradients
    enum Gradient {
        static let primary = LinearGradient(
            colors: [Color.accent, SwiftUI.Color(hex: "#2563EB")],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        
        static let surface = LinearGradient(
            colors: [Color.surface, Color.surfaceTint.opacity(0.65)],
            startPoint: .top,
            endPoint: .bottom
        )
    }
    
    // MARK: - Spacing
    enum Spacing {
        static let xs: CGFloat = 4
        static let s: CGFloat = 8
        static let m: CGFloat = 16
        static let l: CGFloat = 24
        static let xl: CGFloat = 32
    }
}

extension View {
    @ViewBuilder
    func ordexGlassSurface(
        cornerRadius: CGFloat = 12,
        tint: SwiftUI.Color? = nil,
        isInteractive: Bool = false
    ) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        if UIAccessibility.isReduceTransparencyEnabled {
            self.background(OrdexTheme.Color.surface, in: shape)
                .overlay {
                    shape.stroke(OrdexTheme.Color.border.opacity(0.85), lineWidth: 1)
                }
        } else if #available(iOS 26.0, *) {
            if isInteractive {
                if let tint {
                    self.glassEffect(.regular.tint(tint).interactive(), in: shape)
                } else {
                    self.glassEffect(.regular.interactive(), in: shape)
                }
            } else if let tint {
                self.glassEffect(.regular.tint(tint), in: shape)
            } else {
                self.glassEffect(.regular, in: shape)
            }
        } else {
            self.background(.ultraThinMaterial, in: shape)
                .overlay {
                    shape.stroke(OrdexTheme.Color.border.opacity(0.55), lineWidth: 1)
                }
        }
    }

    @ViewBuilder
    func ordexGlassButton(prominent: Bool = false) -> some View {
        if #available(iOS 26.0, *) {
            if prominent {
                self.buttonStyle(.glassProminent)
            } else {
                self.buttonStyle(.glass)
            }
        } else {
            self.buttonStyle(.borderedProminent)
        }
    }
}



extension OrdexTheme {
    struct Haptics {
        static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
            let generator = UIImpactFeedbackGenerator(style: style)
            generator.prepare()
            generator.impactOccurred()
        }
        
        static func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(type)
        }
        
        static func selection() {
            let generator = UISelectionFeedbackGenerator()
            generator.prepare()
            generator.selectionChanged()
        }
    }
}
