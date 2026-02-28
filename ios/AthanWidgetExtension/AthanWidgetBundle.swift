import ActivityKit
import SwiftUI
import WidgetKit

private enum WidgetConstants {
  static let appGroupIdentifier = "group.com.anonymous.shia-athan-quran.widget"
  static let payloadKey = "athan_widget_payload"
}

private struct WidgetTheme {
  let background: Color
  let backgroundAlt: Color
  let card: Color
  let border: Color
  let text: Color
  let textMuted: Color
  let primary: Color
  let accent: Color

  static let fallback = WidgetTheme(
    background: Color(hex: "#16110D"),
    backgroundAlt: Color(hex: "#221A14"),
    card: Color(hex: "#2A2119"),
    border: Color(hex: "#4A3A2D"),
    text: Color(hex: "#F0E9D4"),
    textMuted: Color(hex: "#C0B39F"),
    primary: Color(hex: "#D0B089"),
    accent: Color(hex: "#CBA67A")
  )
}

private func isArabicLanguage(_ language: String) -> Bool {
  language.lowercased().hasPrefix("ar")
}

private func localizedPrayerLabel(_ prayerName: String, language: String) -> String {
  if !isArabicLanguage(language) {
    return prayerName
  }

  switch prayerName {
  case "Fajr":
    return "الفجر"
  case "Sunrise":
    return "الشروق"
  case "Dhuhr":
    return "الظهر"
  case "Asr":
    return "العصر"
  case "Maghrib":
    return "المغرب"
  case "Isha":
    return "العشاء"
  default:
    return prayerName
  }
}

private func compactPrayerLabel(_ prayerName: String, language: String) -> String {
  if isArabicLanguage(language) {
    switch prayerName {
    case "Fajr":
      return "فجر"
    case "Sunrise":
      return "شروق"
    case "Dhuhr":
      return "ظهر"
    case "Asr":
      return "عصر"
    case "Maghrib":
      return "مغرب"
    case "Isha":
      return "عشاء"
    default:
      return "أذان"
    }
  }

  switch prayerName {
  case "Fajr":
    return "FJR"
  case "Sunrise":
    return "SUN"
  case "Dhuhr":
    return "DHR"
  case "Asr":
    return "ASR"
  case "Maghrib":
    return "MGB"
  case "Isha":
    return "ISH"
  default:
    return "ADN"
  }
}

private struct AthanWidgetPayload {
  let nextPrayerName: String
  let nextPrayerTimestampMs: Double
  let nextPrayerDisplayTime: String
  let cityLabel: String?
  let language: String
  let theme: WidgetTheme

  var nextPrayerDate: Date {
    Date(timeIntervalSince1970: nextPrayerTimestampMs / 1000)
  }

  var isArabic: Bool {
    isArabicLanguage(language)
  }

  var localizedPrayerName: String {
    localizedPrayerLabel(nextPrayerName, language: language)
  }
}

@available(iOSApplicationExtension 16.1, *)
struct AthanLiveActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    let nextPrayerName: String
    let nextPrayerTimestampMs: Double
    let nextPrayerDisplayTime: String
    let cityLabel: String?
    let language: String
  }

  let id: String
}

private struct AthanTimelineEntry: TimelineEntry {
  let date: Date
  let payload: AthanWidgetPayload?
}

private struct AthanTimelineProvider: TimelineProvider {
  func placeholder(in context: Context) -> AthanTimelineEntry {
    AthanTimelineEntry(
      date: Date(),
      payload: AthanWidgetPayload(
        nextPrayerName: "Maghrib",
        nextPrayerTimestampMs: Date().addingTimeInterval(58 * 60).timeIntervalSince1970 * 1000,
        nextPrayerDisplayTime: "6:31 PM",
        cityLabel: "Karbala, Iraq",
        language: "en",
        theme: .fallback
      )
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (AthanTimelineEntry) -> Void) {
    completion(buildEntry(at: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<AthanTimelineEntry>) -> Void) {
    let now = Date()
    let entry = buildEntry(at: now)

    let refreshDate: Date
    if let payload = entry.payload, payload.nextPrayerDate > now {
      refreshDate = payload.nextPrayerDate.addingTimeInterval(60)
    } else {
      refreshDate = now.addingTimeInterval(30 * 60)
    }

    completion(Timeline(entries: [entry], policy: .after(refreshDate)))
  }

  private func buildEntry(at date: Date) -> AthanTimelineEntry {
    AthanTimelineEntry(date: date, payload: readPayload())
  }

  private func readPayload() -> AthanWidgetPayload? {
    guard
      let defaults = UserDefaults(suiteName: WidgetConstants.appGroupIdentifier),
      let raw = defaults.dictionary(forKey: WidgetConstants.payloadKey),
      let nextPrayerName = raw["nextPrayerName"] as? String,
      let nextPrayerDisplayTime = raw["nextPrayerDisplayTime"] as? String,
      let language = raw["language"] as? String,
      let nextPrayerTimestampMs = parseNumber(raw["nextPrayerTimestampMs"])
    else {
      return nil
    }

    let cityLabel = raw["cityLabel"] as? String
    let themeDict = raw["theme"] as? [String: Any]
    let theme = parseTheme(themeDict)

    return AthanWidgetPayload(
      nextPrayerName: nextPrayerName,
      nextPrayerTimestampMs: nextPrayerTimestampMs,
      nextPrayerDisplayTime: nextPrayerDisplayTime,
      cityLabel: cityLabel,
      language: language,
      theme: theme
    )
  }

  private func parseTheme(_ raw: [String: Any]?) -> WidgetTheme {
    guard let raw else {
      return .fallback
    }

    return WidgetTheme(
      background: Color(hex: raw["background"] as? String, fallback: "#16110D"),
      backgroundAlt: Color(hex: raw["backgroundAlt"] as? String, fallback: "#221A14"),
      card: Color(hex: raw["card"] as? String, fallback: "#2A2119"),
      border: Color(hex: raw["border"] as? String, fallback: "#4A3A2D"),
      text: Color(hex: raw["text"] as? String, fallback: "#F0E9D4"),
      textMuted: Color(hex: raw["textMuted"] as? String, fallback: "#C0B39F"),
      primary: Color(hex: raw["primary"] as? String, fallback: "#D0B089"),
      accent: Color(hex: raw["accent"] as? String, fallback: "#CBA67A")
    )
  }

  private func parseNumber(_ value: Any?) -> Double? {
    switch value {
    case let number as NSNumber:
      return number.doubleValue
    case let value as Double:
      return value
    case let value as Int:
      return Double(value)
    default:
      return nil
    }
  }
}

private struct AthanWidgetEntryView: View {
  let entry: AthanTimelineEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    if let payload = entry.payload {
      content(for: payload)
    } else {
      emptyState
    }
  }

  private func content(for payload: AthanWidgetPayload) -> some View {
    let isSmall = family == .systemSmall
    let title = payload.isArabic ? "الأذان القادم" : "Next Athan"
    let timeLeftLabel = payload.isArabic ? "الوقت المتبقي" : "Time Left"

    return ZStack {
      Circle()
        .fill(payload.theme.primary.opacity(0.14))
        .frame(width: isSmall ? 122 : 148)
        .offset(x: isSmall ? 56 : 122, y: isSmall ? -68 : -72)

      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .stroke(payload.theme.border.opacity(0.75), lineWidth: 1)
        .padding(1)

      VStack(alignment: .leading, spacing: isSmall ? 8 : 10) {
        HStack(alignment: .firstTextBaseline) {
          Text(title)
            .font(.system(size: 12, weight: .semibold, design: .rounded))
            .foregroundStyle(payload.theme.textMuted)
            .lineLimit(1)

          Spacer(minLength: 6)

          Text(payload.nextPrayerDisplayTime)
            .font(.system(size: isSmall ? 12 : 13, weight: .semibold, design: .rounded))
            .foregroundStyle(payload.theme.text)
            .lineLimit(1)
        }

        Text(payload.localizedPrayerName)
          .font(.system(size: isSmall ? 28 : 32, weight: .bold, design: .rounded))
          .foregroundStyle(payload.theme.text)
          .minimumScaleFactor(0.6)
          .lineLimit(1)

        VStack(alignment: .leading, spacing: 2) {
          Text(timeLeftLabel)
            .font(.system(size: 11, weight: .semibold, design: .rounded))
            .foregroundStyle(payload.theme.textMuted)

          if payload.nextPrayerDate > entry.date {
            Text(payload.nextPrayerDate, style: .timer)
              .font(.system(size: isSmall ? 25 : 28, weight: .heavy, design: .rounded))
              .monospacedDigit()
              .foregroundStyle(payload.theme.primary)
              .lineLimit(1)
              .minimumScaleFactor(0.7)
          } else {
            Text(payload.isArabic ? "جارٍ التحديث" : "Refreshing")
              .font(.system(size: isSmall ? 18 : 20, weight: .bold, design: .rounded))
              .foregroundStyle(payload.theme.primary)
              .lineLimit(1)
          }
        }

        Spacer(minLength: 0)

        if let cityLabel = payload.cityLabel, !cityLabel.isEmpty {
          HStack(spacing: 5) {
            Image(systemName: "mappin.and.ellipse")
              .font(.system(size: 10, weight: .semibold))
            Text(cityLabel)
              .font(.system(size: 11, weight: .medium, design: .rounded))
              .lineLimit(1)
              .minimumScaleFactor(0.75)
          }
          .foregroundStyle(payload.theme.textMuted)
        }
      }
      .padding(isSmall ? 14 : 16)
    }
    .widgetBackground {
      LinearGradient(
        colors: [payload.theme.background, payload.theme.card],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    }
  }

  private var emptyState: some View {
    let theme = WidgetTheme.fallback

    return ZStack {
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .stroke(theme.border.opacity(0.75), lineWidth: 1)
        .padding(1)

      VStack(alignment: .leading, spacing: 8) {
        Text("Next Athan")
          .font(.system(size: 12, weight: .semibold, design: .rounded))
          .foregroundStyle(theme.textMuted)

        Text("--")
          .font(.system(size: 30, weight: .bold, design: .rounded))
          .foregroundStyle(theme.text)

        Text("Open the app to load prayer times")
          .font(.system(size: 12, weight: .medium, design: .rounded))
          .foregroundStyle(theme.textMuted)
          .lineLimit(2)
      }
      .padding(16)
    }
    .widgetBackground {
      LinearGradient(
        colors: [theme.background, theme.backgroundAlt],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    }
  }
}

@available(iOSApplicationExtension 16.1, *)
private struct AthanLiveActivityView: View {
  let context: ActivityViewContext<AthanLiveActivityAttributes>

  var body: some View {
    let state = context.state
    let nextPrayerDate = Date(timeIntervalSince1970: state.nextPrayerTimestampMs / 1000)
    let isArabic = isArabicLanguage(state.language)
    let title = isArabic ? "الأذان القادم" : "Next Athan"
    let timeLeft = isArabic ? "الوقت المتبقي" : "Time Left"
    let refreshing = isArabic ? "جارٍ التحديث" : "Refreshing"
    let primaryText = Color.white
    let secondaryText = Color.white.opacity(0.78)

    return VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .firstTextBaseline) {
        Text(title)
          .font(.system(size: 12, weight: .semibold, design: .rounded))
          .foregroundStyle(secondaryText)
        Spacer(minLength: 8)
        Text(state.nextPrayerDisplayTime)
          .font(.system(size: 13, weight: .semibold, design: .rounded))
          .foregroundStyle(primaryText)
      }

      Text(localizedPrayerLabel(state.nextPrayerName, language: state.language))
        .font(.system(size: 24, weight: .bold, design: .rounded))
        .foregroundStyle(primaryText)
        .lineLimit(1)

      HStack(spacing: 6) {
        Image(systemName: "timer")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(secondaryText)
        Text(timeLeft)
          .font(.system(size: 12, weight: .semibold, design: .rounded))
          .foregroundStyle(secondaryText)

        Spacer(minLength: 8)

        if nextPrayerDate > Date() {
          Text(nextPrayerDate, style: .timer)
            .font(.system(size: 23, weight: .heavy, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(primaryText)
        } else {
          Text(refreshing)
            .font(.system(size: 18, weight: .bold, design: .rounded))
            .foregroundStyle(primaryText)
        }
      }

      if let cityLabel = state.cityLabel, !cityLabel.isEmpty {
        HStack(spacing: 5) {
          Image(systemName: "mappin.and.ellipse")
            .font(.system(size: 10, weight: .semibold))
          Text(cityLabel)
            .font(.system(size: 11, weight: .medium, design: .rounded))
            .lineLimit(1)
        }
        .foregroundStyle(secondaryText)
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
    .activityBackgroundTint(Color(hex: "#16110D"))
    .activitySystemActionForegroundColor(Color.white)
    .widgetURL(URL(string: "shiaathanquran://"))
  }
}

@available(iOSApplicationExtension 16.1, *)
private struct AthanLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: AthanLiveActivityAttributes.self) { context in
      AthanLiveActivityView(context: context)
    } dynamicIsland: { context in
      let state = context.state
      let nextPrayerDate = Date(timeIntervalSince1970: state.nextPrayerTimestampMs / 1000)
      let prayerName = localizedPrayerLabel(state.nextPrayerName, language: state.language)
      let compactPrayer = compactPrayerLabel(state.nextPrayerName, language: state.language)
      let refreshing = isArabicLanguage(state.language) ? "تحديث" : "Refresh"
      let islandPrimary = Color.white
      let islandSecondary = Color.white.opacity(0.76)

      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(prayerName)
            .font(.system(size: 15, weight: .bold, design: .rounded))
            .foregroundStyle(islandPrimary)
            .lineLimit(1)
            .minimumScaleFactor(0.75)
        }

        DynamicIslandExpandedRegion(.trailing) {
          Text(state.nextPrayerDisplayTime)
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundStyle(islandPrimary)
            .lineLimit(1)
        }

        DynamicIslandExpandedRegion(.bottom) {
          HStack(spacing: 6) {
            Image(systemName: "timer")
              .font(.system(size: 11, weight: .semibold))
              .foregroundStyle(islandSecondary)

            if nextPrayerDate > Date() {
              Text(nextPrayerDate, style: .timer)
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(islandPrimary)
                .lineLimit(1)
            } else {
              Text(refreshing)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(islandPrimary)
                .lineLimit(1)
            }

            Spacer(minLength: 8)

            if let cityLabel = state.cityLabel, !cityLabel.isEmpty {
              Text(cityLabel)
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundStyle(islandSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            }
          }
        }
      } compactLeading: {
        HStack(spacing: 3) {
          Image(systemName: "bell.fill")
            .font(.system(size: 9, weight: .bold))
          Text(compactPrayer)
            .font(.system(size: 11, weight: .bold, design: .rounded))
            .lineLimit(1)
            .minimumScaleFactor(0.75)
        }
        .foregroundStyle(islandPrimary)
      } compactTrailing: {
        if nextPrayerDate > Date() {
          Text(nextPrayerDate, style: .timer)
            .font(.system(size: 12, weight: .semibold, design: .rounded))
            .monospacedDigit()
            .lineLimit(1)
            .foregroundStyle(islandPrimary)
            .frame(width: 44, alignment: .trailing)
        } else {
          Image(systemName: "arrow.clockwise")
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(islandPrimary)
        }
      } minimal: {
        ZStack {
          Circle()
            .fill(Color.white.opacity(0.22))
            .frame(width: 22, height: 22)
          Image(systemName: "bell.fill")
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(islandPrimary)
        }
      }
      .keylineTint(Color.white.opacity(0.92))
      .widgetURL(URL(string: "shiaathanquran://"))
    }
  }
}

private extension Color {
  init(hex: String?, fallback: String = "#000000") {
    self = Color(hex: hex ?? fallback)
  }

  init(hex: String) {
    let cleaned = hex
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .replacingOccurrences(of: "#", with: "")

    guard cleaned.count == 6, let rgb = Int(cleaned, radix: 16) else {
      self = .black
      return
    }

    let red = Double((rgb >> 16) & 0xFF) / 255.0
    let green = Double((rgb >> 8) & 0xFF) / 255.0
    let blue = Double(rgb & 0xFF) / 255.0

    self = Color(red: red, green: green, blue: blue)
  }
}

private extension View {
  @ViewBuilder
  func widgetBackground<Background: View>(@ViewBuilder _ background: () -> Background) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget, content: background)
    } else {
      self.background(background())
    }
  }
}

struct AthanWidget: Widget {
  let kind = "AthanWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: AthanTimelineProvider()) { entry in
      AthanWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Next Athan")
    .description("Shows the next Athan and remaining time.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct AthanWidgetBundle: WidgetBundle {
  @WidgetBundleBuilder
  var body: some Widget {
    AthanWidget()

    if #available(iOSApplicationExtension 16.1, *) {
      AthanLiveActivityWidget()
    }
  }
}
