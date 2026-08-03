import { existsSync } from "fs";
import { dirname, join } from "path";

export const PdfFont = {
  regular: "DejaVuSans",
  bold: "DejaVuSans-Bold"
} as const;

type PdfKitDoc = {
  registerFont(name: string, path: string): PdfKitDoc;
  font(name: string): PdfKitDoc;
};

function resolveFontFile(fileName: string): string {
  const candidates: string[] = [
    // Bundled next to compiled JS (after build copy)
    join(__dirname, "..", "assets", "fonts", fileName),
    // Repo assets (dev / deploy that keeps apps/api/assets)
    join(__dirname, "..", "..", "assets", "fonts", fileName),
    join(process.cwd(), "assets", "fonts", fileName),
    join(process.cwd(), "apps", "api", "assets", "fonts", fileName)
  ];

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const packageJson = require.resolve("dejavu-fonts-ttf/package.json") as string;
    candidates.push(join(dirname(packageJson), "ttf", fileName));
  } catch {
    // Optional dependency path — ignore if package is not installed.
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Font PDF lipsă: ${fileName}. Asigură-te că apps/api/assets/fonts este pe server sau rulează pnpm install (dejavu-fonts-ttf).`
  );
}

/** Registers Unicode-capable fonts (Romanian diacritics) and sets regular as default. */
export function applyUnicodeFonts(doc: PdfKitDoc): void {
  doc.registerFont(PdfFont.regular, resolveFontFile("DejaVuSans.ttf"));
  doc.registerFont(PdfFont.bold, resolveFontFile("DejaVuSans-Bold.ttf"));
  doc.font(PdfFont.regular);
}
