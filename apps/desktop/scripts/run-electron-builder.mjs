// Resolve electronDist at runtime (#38673, #47917): electron-builder 26.8.x can
// re-unpack a broken Electron.app; reusing the installed dist dodges that.
// npm workspace hoisting is non-deterministic — require.resolve finds electron
// wherever it landed. Dist present → -c.electronDist=<abs>/dist; absent → let
// electron-builder fetch via @electron/get (electronVersion + ELECTRON_MIRROR).

import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

function electronDistDir() {
  try {
    return path.join(path.dirname(require.resolve("electron/package.json")), "dist")
  } catch {
    return null
  }
}

function distBinary(dist) {
  if (process.platform === "darwin") {
    return path.join(dist, "Electron.app", "Contents", "MacOS", "Electron")
  }
  if (process.platform === "win32") {
    return path.join(dist, "electron.exe")
  }
  return path.join(dist, "electron")
}

function electronBuilderCli() {
  const pkgJson = require.resolve("electron-builder/package.json")
  const bin = require(pkgJson).bin
  const rel = typeof bin === "string" ? bin : bin["electron-builder"]
  return path.join(path.dirname(pkgJson), rel)
}

function localMacSigningArgs() {
  if (process.platform !== "darwin") return []

  const identity = process.env.CSC_NAME || "DeepSeek Usage Local Code Signing"
  const probe = spawnSync("security", ["find-identity", "-v", "-p", "codesigning"], {
    encoding: "utf8",
  })
  if (probe.status !== 0 || !(probe.stdout || "").includes(identity)) {
    console.warn(
      `[run-electron-builder] local signing identity not in keychain (${identity}); ` +
        "leaving electron-builder defaults (ad-hoc / unsigned rebuilds invalidate Screen Recording TCC)."
    )
    return []
  }

  // Self-signed certs cannot talk to Apple's timestamp server. osx-sign still
  // passes bare `--timestamp` unless we force `none`, and that failure used to
  // drop this machine back to ad-hoc. Ad-hoc designated requirements change
  // every pack, so macOS treats each rebuild as a new app and re-prompts TCC.
  console.log(`[run-electron-builder] signing with stable identity: ${identity} (timestamp=none)`)
  return [`-c.mac.identity=${identity}`, `-c.mac.timestamp=none`]
}

const dist = electronDistDir()
const args = []
if (dist && fs.existsSync(distBinary(dist))) {
  args.push(`-c.electronDist=${dist}`)
} else {
  console.warn(
    "[run-electron-builder] no local electron dist; electron-builder will fetch " +
      "via @electron/get (electronVersion + ELECTRON_MIRROR)."
  )
}
args.push(...localMacSigningArgs())
args.push(...process.argv.slice(2))

const result = spawnSync(process.execPath, [electronBuilderCli(), ...args], {
  stdio: "inherit",
})
if (result.error) {
  console.error(`[run-electron-builder] spawn failed: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status == null ? 1 : result.status)
