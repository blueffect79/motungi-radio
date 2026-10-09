import { checkBinaryArchitecture } from "./check-binary-architecture.mjs";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";

const [target, input, output] = process.argv.slice(2);
const formats = {
  "aarch64-apple-darwin": ["macos-arm64", ".dmg"],
  "x86_64-apple-darwin": ["macos-x64", ".dmg"],
  "x86_64-pc-windows-msvc": ["windows-x64", ".exe"],
  "x86_64-unknown-linux-gnu": ["linux-x64", [".deb", ".AppImage"]],
};
if (!formats[target] || !input || !output)
  throw new Error(
    "사용법: node scripts/package-artifacts.mjs <target> <bundle-directory> <output-directory>",
  );
const [platform, format] = formats[target];
const extensions = Array.isArray(format) ? format : [format];
const binary = resolve(
  input,
  "..",
  target === "x86_64-pc-windows-msvc" ? "motungi-radio.exe" : "motungi-radio",
);
checkBinaryArchitecture(readFileSync(binary), target);
const walk = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const files = walk(resolve(input));
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url)),
);
mkdirSync(output, { recursive: true });
if (readdirSync(output).length)
  throw new Error("다른 빌드와 섞이지 않도록 빈 출력 폴더를 사용하세요.");
const hashes = [];
for (const extension of extensions) {
  const candidates = files.filter((path) => path.endsWith(extension));
  if (candidates.length !== 1)
    throw new Error(
      `${extension} 설치파일이 정확히 하나여야 합니다: ${candidates.length}`,
    );
  const source = candidates[0];
  const bytes = readFileSync(source);
  if (
    bytes.length < 1024 ||
    (extension === ".exe" && bytes.subarray(0, 2).toString() !== "MZ") ||
    (extension === ".dmg" &&
      bytes.subarray(-512, -508).toString() !== "koly") ||
    (extension === ".deb" && bytes.subarray(0, 8).toString() !== "!<arch>\n") ||
    (extension === ".AppImage" &&
      (bytes.subarray(0, 4).toString("hex") !== "7f454c46" ||
        bytes.subarray(8, 11).toString("hex") !== "414902"))
  )
    throw new Error("설치파일 크기 또는 형식이 올바르지 않습니다.");
  if (extension === ".AppImage") checkBinaryArchitecture(bytes, target);
  const name = `motungi-radio-${version}-${platform}${extension}`;
  copyFileSync(source, join(output, name));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (
    createHash("sha256")
      .update(readFileSync(join(output, name)))
      .digest("hex") !== digest
  )
    throw new Error("복사 후 해시 검증 실패");
  hashes.push(`${digest}  ${name}`);
  console.log(`${basename(source)} -> ${name}`);
}
writeFileSync(join(output, "SHA256SUMS.txt"), hashes.join("\n") + "\n");
