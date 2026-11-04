import SwiftUI

struct OrderNotesSection: View {
    let notes: [OrderNote]
    @Binding var noteText: String
    let isSubmitting: Bool
    let onSubmit: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            if notes.isEmpty && noteText.isEmpty {
                EmptyStateView(icon: "note.text", title: "אין הערות", message: "הוסף הערה ראשונה")
                    .frame(maxHeight: .infinity)
            } else {
                List(notes.reversed()) { note in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(note.content)
                            .font(.subheadline)
                        HStack {
                            if let author = note.authorName {
                                Text(author)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(note.createdAt.hebrewFormatted)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .listStyle(.plain)
            }

            // Input bar
            Divider()
            HStack(spacing: 12) {
                TextField("כתוב הערה...", text: $noteText, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(UIColor.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 20))

                Button {
                    onSubmit()
                } label: {
                    if isSubmitting {
                        ProgressView()
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundStyle(noteText.trimmingCharacters(in: .whitespaces).isEmpty ? .gray : .ordexBlue)
                    }
                }
                .disabled(noteText.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.ordexSurface)
        }
    }
}
