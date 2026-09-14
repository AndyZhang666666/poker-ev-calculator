// GitHub Pages 默认走 Jekyll，会忽略 _next/ 目录 —— 页面能开但样式脚本全 404。
// 在 out/ 写一个 .nojekyll 关掉它。挂在 npm run build 里，本地和 CI 走同一条路径。
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "out");
if (!existsSync(out)) mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, ".nojekyll"), "");
console.log("✓ .nojekyll written");
