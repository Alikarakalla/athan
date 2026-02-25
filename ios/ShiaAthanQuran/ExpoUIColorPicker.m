#import <UIKit/UIKit.h>
#import <React/RCTBridgeModule.h>

@interface ExpoUIColorPicker : NSObject <RCTBridgeModule, UIColorPickerViewControllerDelegate, UIAdaptivePresentationControllerDelegate>

@property (nonatomic, copy) RCTPromiseResolveBlock resolver;
@property (nonatomic, copy) RCTPromiseRejectBlock rejecter;
@property (nonatomic, strong) UIColorPickerViewController *activePicker;

@end

@implementation ExpoUIColorPicker

RCT_EXPORT_MODULE(ExpoUIColorPicker);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

RCT_REMAP_METHOD(
  presentColorPicker,
  presentColorPickerWithOptions:(NSDictionary *)options
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.resolver != nil || self.activePicker != nil) {
      BOOL hasLivePicker = self.activePicker != nil && self.activePicker.presentingViewController != nil;
      if (!hasLivePicker) {
        [self clearState];
      }
    }

    if (self.resolver != nil || self.activePicker != nil) {
      reject(@"PICKER_BUSY", @"A color picker is already open.", nil);
      return;
    }

    UIViewController *presenter = [self topViewController];
    if (!presenter) {
      reject(@"NO_ROOT_VC", @"No active root view controller found.", nil);
      return;
    }

    UIColorPickerViewController *picker = [UIColorPickerViewController new];
    picker.delegate = self;
    picker.presentationController.delegate = self;
    picker.supportsAlpha = [options[@"supportsAlpha"] boolValue];
    picker.modalPresentationStyle = UIModalPresentationPageSheet;

    if (@available(iOS 15.0, *)) {
      UISheetPresentationController *sheet = picker.sheetPresentationController;
      if (sheet) {
        sheet.detents = @[ [UISheetPresentationControllerDetent mediumDetent] ];
        sheet.selectedDetentIdentifier = UISheetPresentationControllerDetentIdentifierMedium;
        sheet.largestUndimmedDetentIdentifier = UISheetPresentationControllerDetentIdentifierMedium;
        sheet.prefersGrabberVisible = YES;
        sheet.prefersScrollingExpandsWhenScrolledToEdge = NO;
        sheet.prefersEdgeAttachedInCompactHeight = YES;
        sheet.widthFollowsPreferredContentSizeWhenEdgeAttached = YES;
      }
    }

    NSString *title = [options[@"title"] isKindOfClass:[NSString class]] ? options[@"title"] : nil;
    if (title.length > 0) {
      picker.title = title;
    }

    NSString *initialHex = [options[@"initialHex"] isKindOfClass:[NSString class]] ? options[@"initialHex"] : nil;
    UIColor *initialColor = [self colorFromHex:initialHex];
    if (initialColor) {
      picker.selectedColor = initialColor;
    }

    self.resolver = resolve;
    self.rejecter = reject;
    self.activePicker = picker;

    [presenter presentViewController:picker animated:YES completion:nil];
  });
}

- (void)colorPickerViewControllerDidFinish:(UIColorPickerViewController *)viewController
{
  if (!self.resolver) {
    [self clearState];
    return;
  }

  NSString *hex = [self hexFromColor:viewController.selectedColor];
  self.resolver(@{ @"hex": hex ?: @"#000000" });
  [self clearState];
}

- (void)presentationControllerDidDismiss:(UIPresentationController *)presentationController
{
  if (!self.resolver) {
    [self clearState];
    return;
  }

  UIColor *selected = self.activePicker.selectedColor;
  NSString *hex = [self hexFromColor:selected];
  self.resolver(@{ @"hex": hex ?: @"#000000" });
  [self clearState];
}

- (void)clearState
{
  self.resolver = nil;
  self.rejecter = nil;
  self.activePicker = nil;
}

- (UIViewController *)topViewController
{
  UIWindow *keyWindow = nil;
  if (@available(iOS 13.0, *)) {
    NSSet<UIScene *> *scenes = UIApplication.sharedApplication.connectedScenes;
    for (UIScene *scene in scenes) {
      if (scene.activationState != UISceneActivationStateForegroundActive) {
        continue;
      }
      if (![scene isKindOfClass:[UIWindowScene class]]) {
        continue;
      }
      for (UIWindow *window in ((UIWindowScene *)scene).windows) {
        if (window.isKeyWindow) {
          keyWindow = window;
          break;
        }
      }
      if (keyWindow) {
        break;
      }
    }
  }

  if (!keyWindow) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    keyWindow = UIApplication.sharedApplication.keyWindow;
#pragma clang diagnostic pop
  }

  UIViewController *controller = keyWindow.rootViewController;
  while (controller.presentedViewController) {
    controller = controller.presentedViewController;
  }

  if ([controller isKindOfClass:[UINavigationController class]]) {
    return ((UINavigationController *)controller).visibleViewController ?: controller;
  }
  if ([controller isKindOfClass:[UITabBarController class]]) {
    return ((UITabBarController *)controller).selectedViewController ?: controller;
  }
  return controller;
}

- (UIColor *)colorFromHex:(NSString *)hex
{
  if (![hex isKindOfClass:[NSString class]]) {
    return nil;
  }

  NSString *clean = [[hex stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]] uppercaseString];
  if ([clean hasPrefix:@"#"]) {
    clean = [clean substringFromIndex:1];
  }

  if (clean.length == 3) {
    unichar chars[3];
    [clean getCharacters:chars range:NSMakeRange(0, 3)];
    clean = [NSString stringWithFormat:@"%C%C%C%C%C%C", chars[0], chars[0], chars[1], chars[1], chars[2], chars[2]];
  }

  if (clean.length != 6) {
    return nil;
  }

  unsigned int value = 0;
  NSScanner *scanner = [NSScanner scannerWithString:clean];
  if (![scanner scanHexInt:&value]) {
    return nil;
  }

  CGFloat red = ((value & 0xFF0000) >> 16) / 255.0;
  CGFloat green = ((value & 0x00FF00) >> 8) / 255.0;
  CGFloat blue = (value & 0x0000FF) / 255.0;
  return [UIColor colorWithRed:red green:green blue:blue alpha:1.0];
}

- (NSString *)hexFromColor:(UIColor *)color
{
  if (!color) {
    return nil;
  }

  CGFloat red = 0;
  CGFloat green = 0;
  CGFloat blue = 0;
  CGFloat alpha = 0;

  if (![color getRed:&red green:&green blue:&blue alpha:&alpha]) {
    CIColor *ciColor = [CIColor colorWithCGColor:color.CGColor];
    red = ciColor.red;
    green = ciColor.green;
    blue = ciColor.blue;
  }

  NSInteger r = (NSInteger)lroundf(red * 255.0f);
  NSInteger g = (NSInteger)lroundf(green * 255.0f);
  NSInteger b = (NSInteger)lroundf(blue * 255.0f);
  return [NSString stringWithFormat:@"#%02lX%02lX%02lX", (long)r, (long)g, (long)b];
}

@end
