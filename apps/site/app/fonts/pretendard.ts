import localFont from 'next/font/local';

// One variable master split into two complementary unicode-ranges, so a page fetches only the half
// it renders. Two calls rather than one `src` array: `declarations` applies per call.
// Regenerate both files with scripts/subset-pretendard.sh.
// Every argument must be a literal - next/font reads the call site's AST, and a value behind a
// `const` serialises as `undefined`.

// Everything but hangul - 324 kB, and the only face worth preloading.
export const pretendardLatin = localFont({
  src: './PretendardVariable-latin.woff2',
  weight: '45 930', // the master's wght axis verbatim, so no weight is synthesised
  style: 'normal',
  display: 'swap',
  variable: '--font-pretendard-latin',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0-10FF,U+1200-312F,U+3190-A95F,U+A980-ABFF,U+D7A4-D7AF,U+D800-10FFFF',
    },
  ],
});

// Hangul - 1.7 MB. An English page renders no glyph in this range, so the unicode-range keeps the
// request from being made; preloading or fallback metrics here would defeat that.
export const pretendardKorean = localFont({
  src: './PretendardVariable-korean.woff2',
  weight: '45 930',
  style: 'normal',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  variable: '--font-pretendard-korean',
  declarations: [
    {
      prop: 'unicode-range',
      value: 'U+1100-11FF,U+3130-318F,U+A960-A97F,U+AC00-D7A3,U+D7B0-D7FF',
    },
  ],
});
