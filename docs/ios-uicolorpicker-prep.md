# iOS Native Color Picker Prep (`UIColorPickerViewController`)

This project already has a JS bridge stub at:

- `src/services/nativeColorPickerService.ts`

It expects a native iOS module named:

- `ExpoUIColorPicker`

with method:

- `presentColorPicker(options) -> Promise<{ hex: string }>`

## Recommended JS Library (Cross-platform fallback)

Use `reanimated-color-picker` for the CMS modal tabs (`Grid / Spectrum / Sliders`) on all platforms.

Why:
- Works with React Native + Expo (when `react-native-reanimated` is installed)
- Has multiple picker styles (palette/panel/sliders)
- Good active maintenance and docs

## Native iOS Plan (Mac later)

When you move to macOS:

1. `npx expo prebuild` (if needed)
2. Create an Expo module or native module named `ExpoUIColorPicker`
3. Implement `UIColorPickerViewController`
4. Return selected color as HEX string to JS

## Swift Skeleton (UIKit)

```swift
import UIKit

@objc(ExpoUIColorPicker)
class ExpoUIColorPicker: NSObject, UIColorPickerViewControllerDelegate {
  private var resolver: RCTPromiseResolveBlock?
  private var rejecter: RCTPromiseRejectBlock?

  @objc
  func presentColorPicker(
    _ options: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { [weak self] in
        self?.presentColorPicker(options, resolve: resolve, reject: reject)
      }
      return
    }

    guard let root = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .flatMap({ $0.windows })
      .first(where: { $0.isKeyWindow })?.rootViewController else {
      reject("NO_ROOT_VC", "No root view controller found", nil)
      return
    }

    let picker = UIColorPickerViewController()
    picker.delegate = self
    picker.supportsAlpha = (options["supportsAlpha"] as? Bool) ?? false

    if let hex = options["initialHex"] as? String {
      picker.selectedColor = UIColor(hex: hex) ?? .systemBrown
    }

    self.resolver = resolve
    self.rejecter = reject
    root.present(picker, animated: true)
  }

  func colorPickerViewControllerDidSelectColor(_ viewController: UIColorPickerViewController) {
    let hex = viewController.selectedColor.toHexString()
    resolver?(["hex": hex])
    resolver = nil
    rejecter = nil
  }

  func colorPickerViewControllerDidFinish(_ viewController: UIColorPickerViewController) {
    if resolver != nil {
      let hex = viewController.selectedColor.toHexString()
      resolver?(["hex": hex])
      resolver = nil
      rejecter = nil
    }
  }
}
```

## Notes

- Apple API: `UIColorPickerViewController`
- You can present it modally from the current root VC
- Keep the JS CMS modal as fallback on Android and when native module is unavailable

