import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const Fonts = {
  arabic: 'Cairo-Regular',
  arabicBold: 'Cairo-Bold',
  arabicSemiBold: 'Cairo-SemiBold',
  english: 'Inter-Regular',
  englishBold: 'Inter-Bold',
  englishSemiBold: 'Inter-SemiBold',
};

export const FontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  huge: 40,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Screen = {
  width,
  height,
  isSmall: width < 375,
  isTablet: width >= 768,
};
