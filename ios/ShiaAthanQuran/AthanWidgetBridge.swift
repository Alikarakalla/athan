import ActivityKit
import Foundation
import WatchConnectivity
import WidgetKit

@objc(AthanWidgetBridge)
final class AthanWidgetBridge: NSObject {
  private let appGroupIdentifier = "group.com.anonymous.shia-athan-quran.widget"
  private let widgetPayloadKey = "athan_widget_payload"
  private let widgetUpdatedAtKey = "athan_widget_payload_updated_at_ms"
  private let liveActivityIdKey = "athan_live_activity_id"
  private let liveActivityEnabledKey = "athan_live_activity_enabled"
  private static let liveActivityAttributesId = "next-athan"

  @objc(setWidgetPayloadInternal:)
  func setWidgetPayloadInternal(_ payload: NSDictionary) {
    guard let sanitized = sanitizePropertyListObject(payload) as? NSDictionary else {
      return
    }

    let defaults = UserDefaults(suiteName: appGroupIdentifier)
    defaults?.set(sanitized, forKey: widgetPayloadKey)
    defaults?.set(Date().timeIntervalSince1970 * 1000, forKey: widgetUpdatedAtKey)
    AthanWatchSyncManager.shared.syncPayload(sanitized)
    reloadWidgetTimelines()
    if let defaults {
      if isLiveActivityEnabled(defaults: defaults) {
        upsertLiveActivity(using: sanitized, defaults: defaults)
      } else {
        let storedActivityId = defaults.string(forKey: liveActivityIdKey)
        defaults.removeObject(forKey: liveActivityIdKey)
        endLiveActivity(storedActivityId: storedActivityId)
      }
    }
  }

  @objc(clearWidgetPayloadInternal)
  func clearWidgetPayloadInternal() {
    let defaults = UserDefaults(suiteName: appGroupIdentifier)
    let storedActivityId = defaults?.string(forKey: liveActivityIdKey)

    defaults?.removeObject(forKey: widgetPayloadKey)
    defaults?.set(Date().timeIntervalSince1970 * 1000, forKey: widgetUpdatedAtKey)
    defaults?.removeObject(forKey: liveActivityIdKey)
    AthanWatchSyncManager.shared.clearPayload()
    reloadWidgetTimelines()
    endLiveActivity(storedActivityId: storedActivityId)
  }

  @objc(setLiveActivityEnabledInternal:)
  func setLiveActivityEnabledInternal(_ enabled: Bool) {
    guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
      return
    }

    defaults.set(enabled, forKey: liveActivityEnabledKey)
    if enabled {
      guard
        let payload = defaults.dictionary(forKey: widgetPayloadKey) as NSDictionary?
      else {
        return
      }
      upsertLiveActivity(using: payload, defaults: defaults)
      return
    }

    let storedActivityId = defaults.string(forKey: liveActivityIdKey)
    defaults.removeObject(forKey: liveActivityIdKey)
    endLiveActivity(storedActivityId: storedActivityId)
  }

  private func reloadWidgetTimelines() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  private func isLiveActivityEnabled(defaults: UserDefaults) -> Bool {
    if defaults.object(forKey: liveActivityEnabledKey) == nil {
      return true
    }
    return defaults.bool(forKey: liveActivityEnabledKey)
  }

  private func upsertLiveActivity(using payload: NSDictionary, defaults: UserDefaults) {
    guard #available(iOS 16.1, *) else {
      return
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      return
    }
    guard let parsed = parseLiveActivityPayload(payload) else {
      return
    }

    let state = AthanLiveActivityAttributes.ContentState(
      nextPrayerName: parsed.nextPrayerName,
      nextPrayerTimestampMs: parsed.nextPrayerTimestampMs,
      nextPrayerDisplayTime: parsed.nextPrayerDisplayTime,
      cityLabel: parsed.cityLabel,
      language: parsed.language
    )
    let attributes = AthanLiveActivityAttributes(id: Self.liveActivityAttributesId)
    let preferredId = defaults.string(forKey: liveActivityIdKey)

    Task {
      if let existing = findLiveActivity(preferredId: preferredId) {
        await existing.update(using: state)
        defaults.set(existing.id, forKey: liveActivityIdKey)
        return
      }

      do {
        let activity = try Activity<AthanLiveActivityAttributes>.request(
          attributes: attributes,
          contentState: state,
          pushType: nil
        )
        defaults.set(activity.id, forKey: liveActivityIdKey)
      } catch {
        return
      }
    }
  }

  private func endLiveActivity(storedActivityId: String?) {
    guard #available(iOS 16.1, *) else {
      return
    }

    Task {
      let activities = Activity<AthanLiveActivityAttributes>.activities
      if let storedActivityId, let matching = activities.first(where: { $0.id == storedActivityId }) {
        await matching.end(dismissalPolicy: .immediate)
        return
      }

      for activity in activities where activity.attributes.id == Self.liveActivityAttributesId {
        await activity.end(dismissalPolicy: .immediate)
      }
    }
  }

  @available(iOS 16.1, *)
  private func findLiveActivity(preferredId: String?) -> Activity<AthanLiveActivityAttributes>? {
    let activities = Activity<AthanLiveActivityAttributes>.activities
    if let preferredId, let exactMatch = activities.first(where: { $0.id == preferredId }) {
      return exactMatch
    }
    if let matchingAttributes = activities.first(where: { $0.attributes.id == Self.liveActivityAttributesId }) {
      return matchingAttributes
    }
    return activities.first
  }

  private func parseLiveActivityPayload(_ payload: NSDictionary) -> LiveActivityPayload? {
    guard
      let nextPrayerName = payload["nextPrayerName"] as? String,
      let nextPrayerDisplayTime = payload["nextPrayerDisplayTime"] as? String,
      let nextPrayerTimestampMs = parseNumber(payload["nextPrayerTimestampMs"])
    else {
      return nil
    }

    let language = payload["language"] as? String ?? "en"
    let cityLabel = (payload["cityLabel"] as? String)?
      .trimmingCharacters(in: .whitespacesAndNewlines)

    return LiveActivityPayload(
      nextPrayerName: nextPrayerName,
      nextPrayerTimestampMs: nextPrayerTimestampMs,
      nextPrayerDisplayTime: nextPrayerDisplayTime,
      cityLabel: cityLabel?.isEmpty == true ? nil : cityLabel,
      language: language
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

  private func sanitizePropertyListObject(_ value: Any) -> Any? {
    if value is NSNull {
      return nil
    }

    switch value {
    case let number as NSNumber:
      return number
    case let string as NSString:
      return string
    case let string as String:
      return string as NSString
    case let date as NSDate:
      return date
    case let date as Date:
      return date as NSDate
    case let data as NSData:
      return data
    case let data as Data:
      return data as NSData
    case let array as NSArray:
      let sanitizedItems = array.compactMap { sanitizePropertyListObject($0) }
      return sanitizedItems as NSArray
    case let dict as NSDictionary:
      let mutable = NSMutableDictionary()
      for (key, rawValue) in dict {
        guard let keyString = key as? NSString else { continue }
        guard let sanitizedValue = sanitizePropertyListObject(rawValue) else { continue }
        mutable[keyString] = sanitizedValue
      }
      let result = mutable.copy() as! NSDictionary
      return PropertyListSerialization.propertyList(result, isValidFor: .binary) ? result : nil
    default:
      return nil
    }
  }
}

private struct LiveActivityPayload {
  let nextPrayerName: String
  let nextPrayerTimestampMs: Double
  let nextPrayerDisplayTime: String
  let cityLabel: String?
  let language: String
}

@available(iOS 16.1, *)
private struct AthanLiveActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    let nextPrayerName: String
    let nextPrayerTimestampMs: Double
    let nextPrayerDisplayTime: String
    let cityLabel: String?
    let language: String
  }

  let id: String
}

private final class AthanWatchSyncManager: NSObject {
  static let shared = AthanWatchSyncManager()

  private let payloadKey = "athan_widget_payload"
  private let payloadUpdatedAtKey = "athan_widget_payload_updated_at_ms"
  private let clearKey = "athan_payload_cleared"
  private var pendingContext: [String: Any]?

  private override init() {
    super.init()
    activateSessionIfNeeded()
  }

  func syncPayload(_ payload: NSDictionary) {
    sendToWatch(payload: payload)
  }

  func clearPayload() {
    sendToWatch(payload: nil)
  }

  private func sendToWatch(payload: NSDictionary?) {
    guard WCSession.isSupported() else {
      return
    }

    let nowMs = Date().timeIntervalSince1970 * 1000
    var context: [String: Any] = [
      payloadUpdatedAtKey: nowMs,
    ]

    if let payload {
      context[payloadKey] = payload
      context[clearKey] = false
    } else {
      context[clearKey] = true
    }

    pendingContext = context
    activateSessionIfNeeded()
    pushLatestContextIfPossible()
  }

  private func pushLatestContextIfPossible() {
    guard WCSession.isSupported() else {
      return
    }

    guard let context = pendingContext else {
      return
    }

    let session = WCSession.default
    guard session.activationState == .activated else {
      return
    }

    var didUpdateContext = false
    do {
      try session.updateApplicationContext(context)
      didUpdateContext = true
    } catch {
      // Ignore transient errors; transferUserInfo below is the fallback channel.
    }

    session.transferUserInfo(context)
    if didUpdateContext {
      pendingContext = nil
    }
  }

  private func activateSessionIfNeeded() {
    guard WCSession.isSupported() else {
      return
    }

    let session = WCSession.default
    if session.delegate == nil {
      session.delegate = self
    }

    if session.activationState == .notActivated {
      session.activate()
    }
  }
}

extension AthanWatchSyncManager: WCSessionDelegate {
  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    guard activationState == .activated, error == nil else {
      return
    }
    pushLatestContextIfPossible()
  }

  func sessionWatchStateDidChange(_ session: WCSession) {
    pushLatestContextIfPossible()
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    pushLatestContextIfPossible()
  }

  func sessionDidBecomeInactive(_ session: WCSession) {
  }

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }
}
