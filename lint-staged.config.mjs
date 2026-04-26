export default {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  // markdownlint runs BEFORE prettier on .md so prettier can normalise any
  // whitespace markdownlint touches. The two are complementary: prettier
  // formats; markdownlint enforces semantic rules (no duplicate H1s, fenced
  // blocks need language, no bare URLs).
  "*.md": ["markdownlint-cli2 --fix", "prettier --write"],
  "*.{json,yml,yaml,css}": ["prettier --write"],
};
