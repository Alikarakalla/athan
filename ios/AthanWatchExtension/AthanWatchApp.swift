import SwiftUI

@main
struct AthanWatchApp: App {
  @StateObject private var syncStore = AthanWatchSyncStore()

  var body: some Scene {
    WindowGroup {
      AthanWatchHomeView()
        .environmentObject(syncStore)
    }
  }
}

private struct AthanWatchHomeView: View {
  @EnvironmentObject private var syncStore: AthanWatchSyncStore

  var body: some View {
    if let payload = syncStore.payload {
      ZStack {
        LinearGradient(
          colors: [payload.theme.background, payload.theme.backgroundAlt],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )
        .ignoresSafeArea()

        VStack(alignment: .leading, spacing: 8) {
          Text(payload.isArabic ? "الأذان القادم" : "Next Athan")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(payload.theme.textMuted)

          Text(payload.localizedPrayerName)
            .font(.system(size: 24, weight: .bold, design: .rounded))
            .minimumScaleFactor(0.7)
            .lineLimit(1)
            .foregroundStyle(payload.theme.text)

          Text(payload.nextPrayerDisplayTime)
            .font(.system(size: 14, weight: .semibold, design: .rounded))
            .foregroundStyle(payload.theme.primary)

          Divider()
            .overlay(payload.theme.border)

          if payload.nextPrayerDate > syncStore.now {
            Text(payload.nextPrayerDate, style: .timer)
              .font(.system(size: 28, weight: .heavy, design: .rounded))
              .monospacedDigit()
              .foregroundStyle(payload.theme.accent)
              .lineLimit(1)
              .minimumScaleFactor(0.6)
          } else {
            Text(payload.isArabic ? "جارٍ التحديث" : "Refreshing")
              .font(.system(size: 15, weight: .bold, design: .rounded))
              .foregroundStyle(payload.theme.textMuted)
          }

          if let city = payload.cityLabel, !city.isEmpty {
            HStack(spacing: 4) {
              Image(systemName: "mappin.and.ellipse")
              Text(city)
                .lineLimit(1)
            }
            .font(.caption2)
            .foregroundStyle(payload.theme.textMuted)
          }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
      }
    } else {
      ZStack {
        LinearGradient(
          colors: [Color(red: 22 / 255, green: 17 / 255, blue: 13 / 255), Color(red: 34 / 255, green: 26 / 255, blue: 20 / 255)],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )
        .ignoresSafeArea()

        VStack(alignment: .leading, spacing: 6) {
          Text("Next Athan")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(Color(red: 192 / 255, green: 179 / 255, blue: 159 / 255))
          Text("--")
            .font(.system(size: 24, weight: .bold, design: .rounded))
            .foregroundStyle(Color(red: 240 / 255, green: 233 / 255, blue: 212 / 255))
          Text("Open iPhone app to sync")
            .font(.caption2)
            .foregroundStyle(Color(red: 192 / 255, green: 179 / 255, blue: 159 / 255))
            .lineLimit(2)
        }
        .padding(12)
      }
    }
  }
}
