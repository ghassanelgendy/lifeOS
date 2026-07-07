import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Habit Streak Structs

struct HabitStreakItem: Hashable, Codable {
    let name: String
    let streak: Int
    let completed: Bool
}

struct DashboardData {
    let completionRate: Double
    let totalHabits: Int
    let completedHabits: Int
    let activeStreak: Int
    let items: [HabitStreakItem]
}

// Helper to load shared App Group data
func loadDashboardData() -> DashboardData {
    let defaults = UserDefaults(suiteName: "group.com.ghassanelgendy.lifeos")
    guard let dict = defaults?.dictionary(forKey: "habitStreaks") else {
        return DashboardData(completionRate: 0.0, totalHabits: 0, completedHabits: 0, activeStreak: 0, items: [])
    }
    
    let completionRate = dict["completionRate"] as? Double ?? 0.0
    let totalHabits = dict["totalHabits"] as? Int ?? 0
    let completedHabits = dict["completedHabits"] as? Int ?? 0
    let activeStreak = dict["activeStreak"] as? Int ?? 0
    
    var items: [HabitStreakItem] = []
    if let itemsList = dict["items"] as? [[String: Any]] {
        for item in itemsList {
            let name = item["name"] as? String ?? ""
            let streak = item["streak"] as? Int ?? 0
            let completed = item["completed"] as? Bool ?? false
            items.append(HabitStreakItem(name: name, streak: streak, completed: completed))
        }
    }
    
    return DashboardData(completionRate: completionRate, totalHabits: totalHabits, completedHabits: completedHabits, activeStreak: activeStreak, items: items)
}

// MARK: - App Intent (opens app to dashboard)

struct OpenDashboardIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Dashboard"
    static var description = IntentDescription("Opens the lifeOS dashboard")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

// MARK: - Timeline Entry

struct DashboardEntry: TimelineEntry {
    let date: Date
    let completionRate: Double
    let totalHabits: Int
    let completedHabits: Int
    let activeStreak: Int
    let items: [HabitStreakItem]
}

// MARK: - Timeline Provider

struct DashboardProvider: TimelineProvider {
    func placeholder(in context: Context) -> DashboardEntry {
        DashboardEntry(
            date: Date(),
            completionRate: 75.0,
            totalHabits: 4,
            completedHabits: 3,
            activeStreak: 5,
            items: [
                HabitStreakItem(name: "Pray Fajr", streak: 5, completed: true),
                HabitStreakItem(name: "Read Quran", streak: 3, completed: true),
                HabitStreakItem(name: "Gym", streak: 1, completed: false)
            ]
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (DashboardEntry) -> Void) {
        let data = loadDashboardData()
        let entry = DashboardEntry(
            date: Date(),
            completionRate: data.completionRate,
            totalHabits: data.totalHabits,
            completedHabits: data.completedHabits,
            activeStreak: data.activeStreak,
            items: data.items
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DashboardEntry>) -> Void) {
        let data = loadDashboardData()
        let entry = DashboardEntry(
            date: Date(),
            completionRate: data.completionRate,
            totalHabits: data.totalHabits,
            completedHabits: data.completedHabits,
            activeStreak: data.activeStreak,
            items: data.items
        )
        // Refresh once per hour automatically, or reload manually via WidgetCenter
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Widget Views

/// Circular lock screen widget — shows a flame icon and the active streak count
struct CircularView: View {
    var entry: DashboardEntry
    
    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 15))
                    .foregroundStyle(.primary)
                Text("\(entry.activeStreak)")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
            }
        }
    }
}

/// Rectangular lock screen widget — shows streak details and today's completions
struct RectangularView: View {
    var entry: DashboardEntry
    
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "flame.fill")
                .font(.system(size: 20))
                .foregroundStyle(.primary)
            VStack(alignment: .leading, spacing: 0) {
                if entry.totalHabits == 0 {
                    Text("lifeOS Habits")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(.primary)
                    Text("Open app to sync")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                } else {
                    Text("\(entry.activeStreak) Day Streak")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(.primary)
                    Text("\(entry.completedHabits)/\(entry.totalHabits) completed")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
        }
    }
}

/// Home Screen Small Widget - progress ring & streak flame
struct SmallHomeWidgetView: View {
    var entry: DashboardEntry
    
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Habits")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(.secondary)
                Spacer()
                if entry.activeStreak > 0 {
                    HStack(spacing: 2) {
                        Image(systemName: "flame.fill")
                            .font(.system(size: 12))
                            .foregroundStyle(.orange)
                        Text("\(entry.activeStreak)d")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundStyle(.orange)
                    }
                }
            }
            
            Spacer()
            
            if entry.totalHabits == 0 {
                VStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.dashed")
                        .font(.system(size: 24))
                        .foregroundStyle(.secondary)
                    Text("Open lifeOS")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
            } else {
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.1), lineWidth: 8)
                    Circle()
                        .trim(from: 0.0, to: CGFloat(min(entry.completionRate / 100.0, 1.0)))
                        .stroke(
                            LinearGradient(
                                colors: [.orange, .red],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            style: StrokeStyle(lineWidth: 8, lineCap: .round)
                        )
                        .rotationEffect(Angle(degrees: -90))
                    
                    VStack(spacing: 0) {
                        Text("\(entry.completedHabits)/\(entry.totalHabits)")
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundStyle(.primary)
                        Text("Done")
                            .font(.system(size: 9, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 70, height: 70)
            }
            
            Spacer()
        }
        .padding(12)
    }
}

/// Home Screen Medium Widget - Split layout with details list
struct MediumHomeWidgetView: View {
    var entry: DashboardEntry
    
    var body: some View {
        HStack(spacing: 16) {
            // Left Side: Status & Ring
            VStack(alignment: .leading, spacing: 6) {
                Text("Streaks")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                
                HStack(spacing: 8) {
                    ZStack {
                        Circle()
                            .stroke(Color.white.opacity(0.1), lineWidth: 6)
                        Circle()
                            .trim(from: 0.0, to: CGFloat(min(entry.completionRate / 100.0, 1.0)))
                            .stroke(
                                LinearGradient(
                                    colors: [.orange, .red],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                style: StrokeStyle(lineWidth: 6, lineCap: .round)
                            )
                            .rotationEffect(Angle(degrees: -90))
                        
                        Text("\(entry.completedHabits)/\(entry.totalHabits)")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                    }
                    .frame(width: 44, height: 44)
                    
                    VStack(alignment: .leading, spacing: 1) {
                        HStack(spacing: 3) {
                            Image(systemName: "flame.fill")
                                .font(.system(size: 13))
                                .foregroundStyle(.orange)
                            Text("\(entry.activeStreak) Days")
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundStyle(.primary)
                        }
                        Text("Active Streak")
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            
            Divider()
                .padding(.vertical, 8)
            
            // Right Side: Habits list
            VStack(alignment: .leading, spacing: 6) {
                Text("Today's Habits")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                
                if entry.items.isEmpty {
                    Spacer()
                    Text("No habits scheduled.")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                    Spacer()
                } else {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(entry.items.prefix(3), id: \.self) { item in
                            HStack(spacing: 8) {
                                Image(systemName: item.completed ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(item.completed ? Color.green : Color.secondary)
                                    .font(.system(size: 13))
                                
                                Text(item.name)
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundStyle(item.completed ? .secondary : .primary)
                                    .lineLimit(1)
                                
                                Spacer()
                                
                                if item.streak > 0 {
                                    HStack(spacing: 1) {
                                        Image(systemName: "flame.fill")
                                            .font(.system(size: 10))
                                            .foregroundStyle(.orange)
                                        Text("\(item.streak)")
                                            .font(.system(size: 9, weight: .semibold))
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                    if entry.items.count > 3 {
                        Text("+ \(entry.items.count - 3) more")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.secondary)
                            .padding(.leading, 22)
                    }
                }
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
    }
}

// MARK: - Entry View (dispatches to family-specific views)

struct DashboardWidgetEntryView: View {
    @Environment(\.widgetFamily) var widgetFamily
    var entry: DashboardEntry

    var body: some View {
        Group {
            switch widgetFamily {
            case .accessoryCircular:
                CircularView(entry: entry)
            case .accessoryRectangular:
                RectangularView(entry: entry)
            case .systemSmall:
                SmallHomeWidgetView(entry: entry)
            case .systemMedium:
                MediumHomeWidgetView(entry: entry)
            default:
                SmallHomeWidgetView(entry: entry)
            }
        }
        .widgetURL(URL(string: "lifeos://dashboard"))
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
        .configurationDisplayName("lifeOS Habits & Streaks")
        .description("Track your daily habits and streaks directly from your home and lock screen.")
        .supportedFamilies([
            .accessoryCircular,      // Small circular icon on iOS 16+ lock screen
            .accessoryRectangular,   // Rectangular bar on iOS 16+ lock screen
            .systemSmall,            // Small home screen widget
            .systemMedium            // Medium home screen widget
        ])
    }
}

// MARK: - Preview

#Preview(as: .systemSmall) {
    DashboardWidget()
} timeline: {
    DashboardEntry(
        date: .now,
        completionRate: 66.7,
        totalHabits: 3,
        completedHabits: 2,
        activeStreak: 7,
        items: [
            HabitStreakItem(name: "Workout", streak: 7, completed: true),
            HabitStreakItem(name: "Read", streak: 4, completed: true),
            HabitStreakItem(name: "Meditate", streak: 0, completed: false)
        ]
    )
}
