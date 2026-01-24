// src/theme/icons.ts
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type IconName =
  | 'cards'
  | 'cards-playing-outline'
  | 'casino'
  | 'poker-chip'
  | 'cash'
  | 'account-group'
  | 'account-group-outline'
  | 'trophy'
  | 'crown'
  | 'menu-down'
  | 'check'
  | 'cog'
  | 'account-multiple'
  | 'refresh'
  | 'checkbox-marked-outline'
  | 'checkbox-blank-outline'
  | 'arrow-right'
  | 'arrow-left'
  | 'logout'
  | 'card-account-details-outline'
  | 'pencil'
  | 'trash-can'
  | 'plus'
  | 'account-circle'
  | 'calculator'
  | 'cash-multiple'
  | 'calendar'
  | 'account-outline'
  | 'emoticon-sad-outline'
  | 'percent'
  | 'trending-up'
  | 'trending-down'
  | 'cash-minus'
  | 'minus'
  | 'account'
  | 'account-question'
  | 'calendar-month'
  | 'information-outline'
  | 'alert-circle'
  | 'magnify'
  | 'account-multiple-outline'
  | 'book-open-variant'
  | 'gamepad'
  | 'home'
  | 'history'
  | 'line-chart'
  | 'lock'
  | 'shield-check'
  | 'wifi-off'
  | 'check-circle'
  | 'close-circle'
  | 'delete'
  | 'content-save-outline'
  | 'check-circle-outline'
  | 'alert-circle-outline'
  | 'loading-indicator'
  | 'account-plus'
  | 'clipboard-list'
  | 'chevron-up'
  | 'chevron-down'
  | 'star'
  | 'shield-account'
  ;

export const ICON_SIZES = {
  tiny: 16,
  small: 20,
  medium: 24,
  large: 32,
  xlarge: 48
} as const;

export const IconComponent = MaterialCommunityIcons;

export default {
  sizes: ICON_SIZES,
  Icon: IconComponent
};