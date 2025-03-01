// line height와 font weigth은 src/assets/styles/font.css에서 설정
export const fontFamily = {
  regular: ['NotoSans-Regular'],
  bold: ['NotoSans-Bold'],
};

// html font size 16px 기준
export const fontSize = {
  xxs: [
    '0.625rem', // 10px
    { lineHeight: '0.875rem' }, // 14px
  ],
  xm: [
    '0.75rem', // 12px
    { lineHeight: '1rem' }, // 16px
  ],
  sm: [
    '0.875rem', // 14px
    { lineHeight: '1.1875rem' }, // 19px
  ],
  md: [
    '1rem', // 16px
    { lineHeight: '1.375rem' }, // 22px
  ],
  lg: [
    '1.125rem', // 18px
    { lineHeight: '1.5625rem' }, // 25px
  ],
  xl: [
    '1.25rem', // 20px
    { lineHeight: '1.6875rem' }, // 27px
  ],
  '2xl': [
    '1.5rem', // 24px
    { lineHeight: '2.0625rem' }, // 33px
  ],
  '3xl': [
    '2rem', // 32px
    { lineHeight: '2.75rem' }, // 44px
  ],
};
