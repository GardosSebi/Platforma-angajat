import { dirname, join } from "path";

export const PdfFont = {
  regular: "DejaVuSans",
  bold: "DejaVuSans-Bold"
} as const;

type PdfKitDoc = {
  registerFont(name: string, path: string): PdfKitDoc;
  font(name: string): PdfKitDoc;
};

function dejavuTtfPath(fileName: string): string {
  // Resolve via package.json so paths work from dist/ and monorepo installs.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const packageJson = require.resolve("dejavu-fonts-ttf/package.json") as string;
  return join(dirname(packageJson), "ttf", fileName);
}

/** Registers Unicode-capable fonts (Romanian diacritics) and sets regular as default. */
export function applyUnicodeFonts(doc: PdfKitDoc): void {
  doc.registerFont(PdfFont.regular, dejavuTtfPath("DejaVuSans.ttf"));
  doc.registerFont(PdfFont.bold, dejavuTtfPath("DejaVuSans-Bold.ttf"));
  doc.font(PdfFont.regular);
}
