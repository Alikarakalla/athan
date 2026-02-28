# watchOS support

This app now includes a native watchOS companion:

- `AthanWatchApp` (watch app container)
- `AthanWatchExtension` (SwiftUI watch UI + WatchConnectivity receiver)

## Data flow

1. React Native calls `AthanWidgetBridge.setWidgetPayload(...)`.
2. iPhone stores payload in the app-group defaults (`athan_widget_payload`).
3. iPhone pushes the same payload to Apple Watch via `WatchConnectivity` (`updateApplicationContext` + `transferUserInfo`).
4. Watch extension persists incoming payload locally and updates the watch UI.

## Xcode targets

- iOS app target: `ShiaAthanQuran`
- Widget target: `AthanWidgetExtension`
- Watch targets: `AthanWatchApp`, `AthanWatchExtension`

## Local build checks

From `ios/`:

```bash
xcodebuild -project ShiaAthanQuran.xcodeproj -target AthanWatchExtension -sdk watchsimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
xcodebuild -project ShiaAthanQuran.xcodeproj -target AthanWatchApp -sdk watchsimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

## Simulator note

The main iOS scheme now embeds a watch app. Running the iOS scheme on simulator requires an installed/paired watchOS simulator runtime that matches the chosen iOS simulator pairing.
