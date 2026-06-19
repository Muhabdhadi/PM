import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export default async function globalSetup() {
  const frontendDir = path.resolve(__dirname, "..");
  const outDir = path.join(frontendDir, "out");
  const backendStaticDir = path.resolve(frontendDir, "../backend/static");

  console.log("Building frontend for e2e tests...");
  execSync("npm run build", { cwd: frontendDir, stdio: "inherit" });

  console.log("Copying build to backend/static...");
  fs.rmSync(backendStaticDir, { recursive: true, force: true });
  fs.mkdirSync(backendStaticDir, { recursive: true });
  fs.cpSync(outDir, backendStaticDir, { recursive: true });
  console.log("Frontend ready at backend/static");
}
