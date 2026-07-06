import WidgetKit
import SwiftUI
import AppIntents

// MARK: - App Intent (opens app to dashboard)

struct OpenDashboardIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Dashboard"
    static var description = IntentDescription("Opens the lifeOS dashboard")

    // Setting openAppWhenRun = true causes iOS to foreground the app when the
    // intent is performed. The app's deep-link handler then navigates to /dashboard.
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        // The URL scheme handler in App.ios.tsx handles lifeos://dashboard
        // Nothing else needed here — openAppWhenRun brings the app to foreground
        return .result()
    }
}

// MARK: - Timeline Entry

struct DashboardEntry: TimelineEntry {
    let date: Date
}

// MARK: - Timeline Provider

struct DashboardProvider: TimelineProvider {
    func placeholder(in context: Context) -> DashboardEntry {
        DashboardEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (DashboardEntry) -> Void) {
        completion(DashboardEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DashboardEntry>) -> Void) {
        // Refresh once per hour (widget is static, just an app launcher)
        let entry = DashboardEntry(date: Date())
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Widget Views

/// Circular lock screen widget — shows the app icon with a small label
struct CircularView: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(.ultraThinMaterial)
            VStack(spacing: 1) {
                Image(systemName: "house.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(.primary)
                Text("lifeOS")
                    .font(.system(size: 7, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)
            }
        }
        .widgetURL(URL(string: "lifeos://dashboard"))
    }
}

/// Rectangular lock screen widget — icon + "Open Dashboard" label
struct RectangularView: View {
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "house.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.primary)
            VStack(alignment: .leading, spacing: 0) {
                Text("lifeOS")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(.primary)
                Text("Open Dashboard")
                    .font(.system(size: 10, weight: .regular))
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .widgetURL(URL(string: "lifeos://dashboard"))
    }
}

// MARK: - Entry View (dispatches to family-specific views)

struct DashboardWidgetEntryView: View {
    @Environment(\.widgetFamily) var widgetFamily
    var entry: DashboardEntry

    var body: some View {
        switch widgetFamily {
        case .accessoryCircular:
            CircularView()
        case .accessoryRectangular:
            RectangularView()
        default:
            CircularView()
        }
    }
}

// MARK: - Widget Definition

struct DashboardWidget: Widget {
    let kind: String = "DashboardWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DashboardProvider()) { entry in
            DashboardWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("lifeOS Dashboard")
        .description("Tap to open your lifeOS dashboard directly from the lock screen.")
        .supportedFamilies([
            .accessoryCircular,      // Small circular icon on iOS 16+ lock screen
            .accessoryRectangular,   // Rectangular bar on iOS 16+ lock screen
        ])
    }
}

// MARK: - Preview

#Preview(as: .accessoryCircular) {
    DashboardWidget()
} timeline: {
    DashboardEntry(date: .now)
}
