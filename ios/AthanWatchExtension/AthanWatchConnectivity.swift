import Foundation
import SwiftUI
import WatchConnectivity

private enum AthanWatchConstants {
  static let appGroupIdentifier = "group.com.anonymous.shia-athan-quran.widget"
  static let payloadKey = "athan_widget_payload"
  static let payloadUpdatedAtKey = "athan_widget_payload_updated_at_ms"
  static let clearKey = "athan_payload_cleared"
}

final class AthanWatchSyncStore: NSObject, ObservableObject {
  @Published var payload: WatchAthanPayload?
  @Published var now = Date()

  private var timer: Timer?

  override init() {
    super.init()
    payload = readPayloadFromDefaults()
    startClock()
    activateSessionIfNeeded()
  }

  deinit {
    timer?.invalidate()
  }

  private func startClock() {
    timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      self?.now = Date()
    }
  }

  private func activateSessionIfNeeded() {
    guard WCSession.isSupported() else {
      return
    }

    let session = WCSession.default
    session.delegate = self
    if session.activationState == .notActivated {
      session.activate()
    }

    applyLatestContext(from: session)
  }

  private func applyLatestContext(from session: WCSession) {
    let context = session.receivedApplicationContext
    if context.isEmpty {
      return
    }

    applyIncoming(context)
  }

  private func applyIncoming(_ context: [String: Any]) {
    if (context[AthanWatchConstants.clearKey] as? Bool) == true {
      clearStoredPayload()
      return
    }

    guard let payload = context[AthanWatchConstants.payloadKey] as? [String: Any] else {
      return
    }

    writePayloadToDefaults(payload)
    self.payload = WatchAthanPayload(raw: payload)
  }

  private func readPayloadFromDefaults() -> WatchAthanPayload? {
    guard
      let defaults = UserDefaults(suiteName: AthanWatchConstants.appGroupIdentifier),
      let raw = defaults.dictionary(forKey: AthanWatchConstants.payloadKey)
    else {
      return nil
    }

    return WatchAthanPayload(raw: raw)
  }

  private func writePayloadToDefaults(_ payload: [String: Any]) {
    guard let defaults = UserDefaults(suiteName: AthanWatchConstants.appGroupIdentifier) else {
      return
    }

    defaults.set(payload, forKey: AthanWatchConstants.payloadKey)
    defaults.set(Date().timeIntervalSince1970 * 1000, forKey: AthanWatchConstants.payloadUpdatedAtKey)
  }

  private func clearStoredPayload() {
    guard let defaults = UserDefaults(suiteName: AthanWatchConstants.appGroupIdentifier) else {
      return
    }

    defaults.removeObject(forKey: AthanWatchConstants.payloadKey)
    defaults.set(Date().timeIntervalSince1970 * 1000, forKey: AthanWatchConstants.payloadUpdatedAtKey)
    payload = nil
  }
}

extension AthanWatchSyncStore: WCSessionDelegate {
  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    DispatchQueue.main.async {
      self.applyLatestContext(from: session)
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    DispatchQueue.main.async {
      self.applyIncoming(applicationContext)
    }
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    DispatchQueue.main.async {
      self.applyIncoming(userInfo)
    }
  }
}

struct WatchAthanPayload {
  let nextPrayerName: String
  let nextPrayerTimestampMs: Double
  let nextPrayerDisplayTime: String
  let cityLabel: String?
  let language: String
  let theme: WatchTheme

  init?(raw: [String: Any]) {
    guard
      let nextPrayerName = raw["nextPrayerName"] as? String,
      let nextPrayerDisplayTime = raw["nextPrayerDisplayTime"] as? String,
      let language = raw["language"] as? String,
      let nextPrayerTimestampMs = WatchAthanPayload.parseNumber(raw["nextPrayerTimestampMs"])
    else {
      return nil
    }

    self.nextPrayerName = nextPrayerName
    self.nextPrayerTimestampMs = nextPrayerTimestampMs
    self.nextPrayerDisplayTime = nextPrayerDisplayTime
    self.cityLabel = raw["cityLabel"] as? String
    self.language = language
    self.theme = WatchTheme(raw: raw["theme"] as? [String: Any])
  }

  var nextPrayerDate: Date {
    Date(timeIntervalSince1970: nextPrayerTimestampMs / 1000)
  }

  var isArabic: Bool {
    language == "ar"
  }

  var localizedPrayerName: String {
    if !isArabic {
      return nextPrayerName
    }

    switch nextPrayerName {
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
      return nextPrayerName
    }
  }

  private static func parseNumber(_ value: Any?) -> Double? {
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

struct WatchTheme {
  let background: Color
  let backgroundAlt: Color
  let border: Color
  let text: Color
  let textMuted: Color
  let primary: Color
  let accent: Color

  init(raw: [String: Any]?) {
    background = Color(hex: raw?["background"] as? String, fallback: "#16110D")
    backgroundAlt = Color(hex: raw?["backgroundAlt"] as? String, fallback: "#221A14")
    border = Color(hex: raw?["border"] as? String, fallback: "#4A3A2D")
    text = Color(hex: raw?["text"] as? String, fallback: "#F0E9D4")
    textMuted = Color(hex: raw?["textMuted"] as? String, fallback: "#C0B39F")
    primary = Color(hex: raw?["primary"] as? String, fallback: "#D0B089")
    accent = Color(hex: raw?["accent"] as? String, fallback: "#CBA67A")
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
