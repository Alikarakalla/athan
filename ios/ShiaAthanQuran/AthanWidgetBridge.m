#import <React/RCTBridgeModule.h>
#import "ShiaAthanQuran-Swift.h"

@interface AthanWidgetBridge (ReactBridgeModule) <RCTBridgeModule>
@end

@implementation AthanWidgetBridge (ReactBridgeModule)

RCT_EXPORT_MODULE(AthanWidgetBridge)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(setWidgetPayload:(NSDictionary *)payload)
{
  [self setWidgetPayloadInternal:payload];
}

RCT_EXPORT_METHOD(clearWidgetPayload)
{
  [self clearWidgetPayloadInternal];
}

RCT_EXPORT_METHOD(setLiveActivityEnabled:(BOOL)enabled)
{
  [self setLiveActivityEnabledInternal:enabled];
}

@end
