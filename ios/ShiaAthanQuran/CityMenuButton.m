#import <UIKit/UIKit.h>
#import <React/RCTComponent.h>
#import <React/RCTConvert.h>
#import <React/RCTViewManager.h>

@interface CityMenuButtonView : UIView

@property (nonatomic, strong) UIButton *button;
@property (nonatomic, copy) NSString *title;
@property (nonatomic, copy) NSArray<NSDictionary *> *items;
@property (nonatomic, copy) RCTBubblingEventBlock onSelectAction;
@property (nonatomic, strong) UIColor *titleColor;
@property (nonatomic, strong) UIColor *pillBackgroundColor;
@property (nonatomic, strong) UIColor *pillBorderColor;

@end

@implementation CityMenuButtonView

- (instancetype)initWithFrame:(CGRect)frame
{
  self = [super initWithFrame:frame];
  if (self) {
    self.backgroundColor = UIColor.clearColor;

    _button = [UIButton buttonWithType:UIButtonTypeSystem];
    _button.frame = self.bounds;
    _button.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    _button.contentHorizontalAlignment = UIControlContentHorizontalAlignmentLeft;
    _button.contentEdgeInsets = UIEdgeInsetsMake(8, 14, 8, 14);
    _button.titleLabel.font = [UIFont systemFontOfSize:13 weight:UIFontWeightSemibold];
    _button.titleLabel.lineBreakMode = NSLineBreakByTruncatingTail;
    _button.layer.cornerRadius = 17;
    _button.layer.borderWidth = 1.0;
    if (@available(iOS 13.0, *)) {
      _button.layer.cornerCurve = kCACornerCurveContinuous;
    }

    if (@available(iOS 14.0, *)) {
      _button.showsMenuAsPrimaryAction = YES;
    }

    [self addSubview:_button];

    _titleColor = UIColor.labelColor;
    _pillBackgroundColor = [UIColor colorWithWhite:1 alpha:0.06];
    _pillBorderColor = [UIColor colorWithWhite:1 alpha:0.12];
    _items = @[];
    _title = @"";
    [self applyStyle];
    [self updateTitle];
    [self updateMenu];
  }
  return self;
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  self.button.frame = self.bounds;
}

- (void)setTitle:(NSString *)title
{
  _title = [title isKindOfClass:[NSString class]] ? title : @"";
  [self updateTitle];
}

- (void)setItems:(NSArray<NSDictionary *> *)items
{
  _items = [items isKindOfClass:[NSArray class]] ? items : @[];
  [self updateMenu];
}

- (void)setTitleColor:(UIColor *)titleColor
{
  _titleColor = titleColor ?: UIColor.labelColor;
  [self applyStyle];
}

- (void)setPillBackgroundColor:(UIColor *)pillBackgroundColor
{
  _pillBackgroundColor = pillBackgroundColor ?: [UIColor colorWithWhite:1 alpha:0.06];
  [self applyStyle];
}

- (void)setPillBorderColor:(UIColor *)pillBorderColor
{
  _pillBorderColor = pillBorderColor ?: [UIColor colorWithWhite:1 alpha:0.12];
  [self applyStyle];
}

- (void)updateTitle
{
  [self.button setTitle:self.title ?: @"" forState:UIControlStateNormal];
}

- (void)applyStyle
{
  [self.button setTitleColor:self.titleColor ?: UIColor.labelColor forState:UIControlStateNormal];
  self.button.backgroundColor = self.pillBackgroundColor ?: UIColor.clearColor;
  self.button.layer.borderColor = (self.pillBorderColor ?: UIColor.clearColor).CGColor;
}

- (void)updateMenu
{
  if (@available(iOS 14.0, *)) {
    NSMutableArray<UIMenuElement *> *actions = [NSMutableArray new];
    for (NSDictionary *item in self.items) {
      NSString *itemId = [RCTConvert NSString:item[@"id"]] ?: @"";
      NSString *itemTitle = [RCTConvert NSString:item[@"title"]] ?: @"";
      if (itemTitle.length == 0) continue;

      NSString *sfName = [RCTConvert NSString:item[@"sf"]] ?: @"";
      UIImage *icon = nil;
      if (@available(iOS 13.0, *)) {
        if (sfName.length > 0) {
          icon = [UIImage systemImageNamed:sfName];
        }
      }

      __weak typeof(self) weakSelf = self;
      UIAction *action = [UIAction actionWithTitle:itemTitle image:icon identifier:nil handler:^(__kindof UIAction * _Nonnull _) {
        if (!weakSelf.onSelectAction) return;
        weakSelf.onSelectAction(@{
          @"id": itemId,
          @"title": itemTitle,
        });
      }];
      [actions addObject:action];
    }

    self.button.menu = [UIMenu menuWithTitle:@"" children:actions];
  }
}

@end

@interface CityMenuButtonManager : RCTViewManager
@end

@implementation CityMenuButtonManager

RCT_EXPORT_MODULE(CityMenuButton)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (UIView *)view
{
  return [CityMenuButtonView new];
}

RCT_EXPORT_VIEW_PROPERTY(title, NSString)
RCT_EXPORT_VIEW_PROPERTY(items, NSArray)
RCT_EXPORT_VIEW_PROPERTY(onSelectAction, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(titleColor, UIColor)
RCT_EXPORT_VIEW_PROPERTY(pillBackgroundColor, UIColor)
RCT_EXPORT_VIEW_PROPERTY(pillBorderColor, UIColor)

@end

