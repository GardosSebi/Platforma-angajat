import { copyFileSync, mkdirSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "assets", "fonts");
const destDir = join(root, "dist", "assets", "fonts");

mkdirSync(destDir, { recursive: true });
for (const name of readdirSync(srcDir)) {
  if (!name.endsWith(".ttf")) continue;
  copyFileSync(join(srcDir, name), join(destDir, name));
  console.log(`copied ${name} -> dist/assets/fonts/`);
}
