# macOS Signing Material, Backup and Cross-Machine Release

This document manages CucCut's Developer ID signing identity and Apple notarization credentials. For the app packaging layout, see the [desktop README](../apps/desktop/README.md). For commit and release artifact rules, see [development workflow §5](development-workflow.md#5-workspace-and-artifacts).

## Contents

- [1. Application and signing identity](#1-application-and-signing-identity)
- [2. Backup material and storage location](#2-backup-material-and-storage-location)
- [3. Issuing a new certificate and recovery drill](#3-issuing-a-new-certificate-and-recovery-drill)
- [4. Releasing on another Mac](#4-releasing-on-another-mac)
- [5. GitHub Actions configuration](#5-github-actions-configuration)
- [6. Release and backup completion criteria](#6-completion-criteria-for-release-and-backup)
- [7. Official references](#7-official-references)

## 1. Application and signing identity

| Item | Value and rules |
| --- | --- |
| Product name | `CucCut` |
| New app Bundle ID | `com.cuccut.app`; the description in Apple Developer is `CucCut Desktop` |
| First target version | `3.0.0`; the app version and the certificate validity period are independent |
| Apple Developer Team ID | `22FY8U8BF9` |
| Signing certificate type | `Developer ID Application`, for distribution outside the Mac App Store |
| Current signing certificate SHA-1 | `CCD56C43C3C9CC9764C50E1D47D368E957353AD6` |
| Current signing certificate SHA-256 | `3A7F430A27E13AFC6109E475B56F739EB64D1F329D5BB5FE902F53687EA4231D` |
| Current certificate expiry | `2031-09-17T00:00:00Z` (local date is shown according to the time zone) |
| Notary keychain profile | `${CUCCUT_NOTARY_PROFILE:-cuccut-notary}`; the name is portable, but the credentials inside must be reconfigured on the new machine |

A Bundle ID is not a certificate name. Different certificates can share the same display name. When you need to reuse **the same certificate**, compare the full fingerprint before signing; never pick one of them based only on `Developer ID Application: Chunli XIe (22FY8U8BF9)`. After a new certificate is issued, record its SHA-1, SHA-256, serial number, validity period and saved file name in `signing-inventory.json`, kept outside the repository.

The new ID and the old `com.jimliu.cuccut` are two different app identities. The Bundle ID check in the old updater rejects the new ID, so the old update feed cannot be pointed directly at the new package. Package replacement, Keychain Access and old project migration must each be rehearsed separately. "The signature belongs to the same Team" is not evidence that the migration has passed.

## 2. Backup material and storage location

The default local directory is `~/.cuccut-release/signing/com.cuccut.app/`, with directory permissions `700` and file permissions `600`. This is a local storage location. **Disaster recovery is complete only after a copy has been stored in another secure location and the decryption password has been saved.**

A second local file copy is kept in `~/Documents/cuccut/macos-signing-com.cuccut.app-ccd56c43c3c9/`. It contains the encrypted `.p12`, the encrypted PEM private key, the public certificate, the CSR, the identity manifest, recovery verification records, a SHA-256 file manifest and a standalone note. The password is stored separately in the Keychain, and the notary password has not been exported. This directory is on the same Mac, so it does not represent off-site disaster recovery or configured GitHub Secrets.

| Material | Storage method | Purpose |
| --- | --- | --- |
| `developer-id-<SHA1>.p12` | Password-protected PKCS#12 containing the target certificate and its matching private key; one copy outside the repository and one in the encrypted offline backup | Same signing identity on another Mac or in CI |
| `developer-id-<SHA1>.cer` or `.pem` | Public certificate, stored together with the `.p12` | Verifies the certificate identity; cannot sign on its own |
| CSR `.certSigningRequest` | Keep the request used for the application | Traces the application; does not contain the private key |
| `developer-id-private-key.encrypted.pem` (OpenSSL request path) | Encrypted PEM only; decryption password stored separately | After the certificate is issued, combined with the certificate into a `.p12`; not a complete signing identity on its own |
| `.p12` password | Stored separately in a password manager, apart from the backup files | Decrypts the signing identity |
| Notary credentials | App Store Connect API private key `.p8` + Key ID + Issuer ID, or Apple ID + Team ID + app-specific password | `notarytool` submission and status queries |
| `signing-inventory.json` | Contains no passwords or private keys; records the Bundle ID, Team, both certificate fingerprints, serial number, validity period, backup file digests and recovery verification status | Prevents using the wrong certificate or reporting a pending backup as completed |
| Report for each release | Version, build, full source commit, file size and SHA-256, signing fingerprint, notary submission ID, verification results | Traceability and release recovery |

Passwords, private keys, `.p12`, `.p8`, the Keychain database and their Base64 contents must not enter git, app resources, release attachments, test logs or Actions artifacts. Base64 is only used to load a file into a GitHub Secret; it does not provide encryption. Do not export the whole login keychain. Export only the signing identity selected for this release, to avoid carrying along other products' private keys.

Apple only provides public certificate downloads and does not store a signing private key that can be downloaded again. If the private key is lost, downloading the `.cer` again cannot restore the same signing identity.

## 3. Issuing a new certificate and recovery drill

1. Generate the CSR and the corresponding private key on this machine. In Apple Developer, select `Developer ID Application`, submit the CSR, and download the issued `.cer`. Keep the old certificate; do not revoke the identity that is currently shipping in order to request a new one.
2. If the CSR was generated by Xcode / Keychain Access, import the `.cer` on the same Mac that generated the private key. In Xcode › Settings › Accounts › Manage Certificates, select the **newly issued certificate whose fingerprint matches**, and use Export Certificate to export an encrypted `.p12`. You can also export the corresponding identity from My Certificates in Keychain Access. The holder enters the password in the system secure input box; it is not sent in chat.
3. Save the public certificate, CSR, encrypted `.p12` and manifest. In the manifest, first set `privateKeyBackupVerified` to `false`; a public certificate backup cannot change this value to `true`.
4. Import the `.p12` into a temporary keychain, sign a temporary binary with the identity in it, and verify it. Only after confirming that the SHA-1 and SHA-256 match the target certificate should `privateKeyBackupVerified` be set to `true`. A drill cannot consist only of checking that the `.p12` file exists or that the certificate can be read from it.
5. Copy the encrypted backup to a second secure location and store the decryption password separately. Record the recovery drill result and a hint about the backup location, but do not write real secrets into the manifest.

If you use OpenSSL to generate the CSR and the encrypted PEM private key, the private key does not enter the Keychain automatically. After receiving the `.cer`, first convert it to PEM, check that the certificate's public key matches the CSR's public key, then combine them into an encrypted `.p12`, and finally import it into the Keychain. Importing only the `.cer` does not mean you have the signing identity:

```bash
openssl x509 -inform DER -in developer-id.cer -out developer-id.pem
openssl pkcs12 -export -inkey developer-id-private-key.encrypted.pem \
  -in developer-id.pem -out developer-id.p12
```

The command prompts separately for the private key decryption password and the `.p12` export password. Automatically prepared requests are placed in `request-<unique ID>/` in the local directory. `request-inventory.json` records the encrypted private key, the CSR digest and the Keychain location of the password. The automatically generated random password is stored in the local Keychain under the `com.cuccut.release.signing` service, with the account specified by the manifest. The generator should read it through a process pipe and must not write the password to logs or chat output. The holder can find the entry in Keychain Access and then save the password separately in a password manager. If the password exists only in the local Keychain, off-site recovery is still unverified.

To list the identities available on this machine (shows only public names and SHA-1):

```bash
security find-identity -v -p codesigning
```

To check a public certificate, for a PEM file omit `-inform DER`:

```bash
openssl x509 -inform DER -in developer-id.cer \
  -noout -subject -issuer -serial -dates -fingerprint -sha256
```

## 4. Releasing on another Mac

Transfer the encrypted `.p12` through a secure channel, import it in Keychain Access, enter the password securely, and verify the fingerprint from `security find-identity -v -p codesigning`. Do not continue building an official package if the signing identity has no matching private key.

Signing and notarization use two separate sets of credentials. Copying the `.p12` does not copy the `cuccut-notary` profile, and the notary password should not be migrated by exporting the whole keychain.

When using an Apple ID, create the profile interactively in the terminal. Do not pass `--password`; let `notarytool` prompt securely for the app-specific password:

```bash
xcrun notarytool store-credentials cuccut-notary \
  --apple-id '<release Apple ID>' --team-id 22FY8U8BF9
xcrun notarytool history --keychain-profile cuccut-notary
```

When using the team App Store Connect API key:

```bash
xcrun notarytool store-credentials cuccut-notary \
  --key '/secure/path/AuthKey_<KEY_ID>.p8' \
  --key-id '<KEY_ID>' --issuer '<ISSUER_UUID>'
xcrun notarytool history --keychain-profile cuccut-notary
```

A personal API key does not pass `--issuer`. Which credential type to use is determined by the permissions actually available to the Apple account and by whether `notarytool` verification succeeds. Encrypt the `.p8` immediately after downloading it. Do not create account permissions broader than the notarization scope requires just for CI.

Verify profile access with `notarytool history`. If a generic Keychain query finds no entry, that does not prove the profile does not exist, and there is no need to read or print the password stored in it.

Then install the same Node / Rust / Xcode toolchain, check out the source commit from the release report, and rebuild, sign and notarize according to the release process. Same identity does not mean the rebuilt ZIP has identical bytes. Versions and builds that are already public remain immutable; a rebuild that produces different bytes must use a new build.

## 5. GitHub Actions configuration

### 5.1 Secrets and variables

Configure the following values in the release Environment `macos-release`. That environment allows the `main` branch and `cuccut-v*-build.*` release tags to use it. Local backups are not uploaded to GitHub automatically; uploading requires explicit authorization from the holder.

| Name | Type | Content |
| --- | --- | --- |
| `CUCCUT_MAC_CERTIFICATE_BASE64` | Secret | Base64 of the target `.p12` |
| `CUCCUT_MAC_CERTIFICATE_PASSWORD` | Secret | `.p12` password |
| `CUCCUT_MAC_KEYCHAIN_PASSWORD` | Secret | Random password for the temporary CI keychain; not the local login password |
| `CUCCUT_MAC_SIGNING_SHA1` | Variable | Full SHA-1 of the target certificate, 40 hex characters |
| `CUCCUT_APPLE_TEAM_ID` | Variable | `22FY8U8BF9` |
| `CUCCUT_NOTARY_API_KEY_BASE64` | Secret, API key method | Base64 of the `.p8` |
| `CUCCUT_NOTARY_KEY_ID` | Secret, API key method | Key ID |
| `CUCCUT_NOTARY_ISSUER_ID` | Secret, team API key method | Issuer ID |
| `CUCCUT_NOTARY_APPLE_ID` | Secret, Apple ID method | Release Apple ID |
| `CUCCUT_NOTARY_APP_PASSWORD` | Secret, Apple ID method | App-specific password |

Configure one of the notarization credential sets. Official builds run only on native macOS arm64 runners. The unified entry point `desktop-release` receives release tag pushes. Before accessing Secrets, it validates the tag format, the package version, the incremented build number, and that the commit belongs to `main`. PRs, ordinary branch pushes and legacy skill tags do not trigger a release. `desktop-macos` keeps the manual credential verification and the single-platform emergency entry point; only the credential preparation step receives Secrets.

### 5.2 Temporary keychain

The following shows the preparation steps before signing. The implementation in the workflow is `apps/desktop/tools/macos-ci-keychain.mjs`. In the step's `env`, map the Secret / Variable from the table above to environment variables with the same names. Do not enable shell tracing or print the environment. The existence of the workflow does not mean it has already been verified on Actions.

```bash
set -euo pipefail
set +x
umask 077
CUCCUT_CI_KEYCHAIN="$RUNNER_TEMP/cuccut-signing.keychain-db"
CUCCUT_CI_P12="$RUNNER_TEMP/cuccut-signing.p12"
security list-keychains -d user > "$RUNNER_TEMP/cuccut-keychains-before.txt"
printf '%s' "$CUCCUT_MAC_CERTIFICATE_BASE64" | base64 --decode > "$CUCCUT_CI_P12"
security create-keychain -p "$CUCCUT_MAC_KEYCHAIN_PASSWORD" "$CUCCUT_CI_KEYCHAIN"
security set-keychain-settings -lut 21600 "$CUCCUT_CI_KEYCHAIN"
security unlock-keychain -p "$CUCCUT_MAC_KEYCHAIN_PASSWORD" "$CUCCUT_CI_KEYCHAIN"
security import "$CUCCUT_CI_P12" -k "$CUCCUT_CI_KEYCHAIN" \
  -P "$CUCCUT_MAC_CERTIFICATE_PASSWORD" -f pkcs12 -T /usr/bin/codesign
security set-key-partition-list -S apple-tool:,apple:,codesign: \
  -s -k "$CUCCUT_MAC_KEYCHAIN_PASSWORD" "$CUCCUT_CI_KEYCHAIN"
python3 - "$CUCCUT_CI_KEYCHAIN" "$RUNNER_TEMP/cuccut-keychains-before.txt" <<'PY'
import shlex
import subprocess
import sys
from pathlib import Path

previous = shlex.split(Path(sys.argv[2]).read_text())
subprocess.run(['security', 'list-keychains', '-d', 'user', '-s',
                sys.argv[1], *previous], check=True)
PY
security find-identity -v -p codesigning "$CUCCUT_CI_KEYCHAIN" \
  | grep -F -- "$CUCCUT_MAC_SIGNING_SHA1"
```

Adjust `set-key-partition-list` only on the dedicated temporary CI keychain. Do not change the private key authorizations of the login keychain on the development machine. The fingerprint should be validated as 40 hex characters at configuration time, and the build configuration must use this specified identity. The identity name cannot replace the fingerprint check.

### 5.3 Notarization and cleanup

With the API key method, decode `.p8` into `$RUNNER_TEMP` with mode `600`, create the profile with the command from §4, and add `--keychain "$CUCCUT_CI_KEYCHAIN"`. Later `submit`, `history`, and `log` also pass the same `--keychain`. With the Apple ID method, store the profile in the same temporary keychain; CI passes `--password` from a Secret, and `set +x` must stay in effect so command arguments are never printed.

After signing, submit to Apple notarization. Only when the result is `Accepted` do you staple and produce the final ZIP / DMG. The final extracted package is checked again for signature, ticket, Gatekeeper, and Runtime self-check. Successful credential preparation does not mean the app has been packaged, notarized, or released.

Whether the job succeeds or fails, restore the search list and clean up CI material in a separate `if: ${{ always() }}` step. Do not decode the Secrets again in the cleanup step:

```bash
set -euo pipefail
set +x
CUCCUT_CI_KEYCHAIN="$RUNNER_TEMP/cuccut-signing.keychain-db"
if [ -f "$RUNNER_TEMP/cuccut-keychains-before.txt" ]; then
  python3 - "$RUNNER_TEMP/cuccut-keychains-before.txt" <<'PY'
import shlex
import subprocess
import sys
from pathlib import Path

previous = shlex.split(Path(sys.argv[1]).read_text())
subprocess.run(['security', 'list-keychains', '-d', 'user', '-s', *previous], check=True)
PY
fi
if [ -f "$CUCCUT_CI_KEYCHAIN" ]; then
  security delete-keychain "$CUCCUT_CI_KEYCHAIN"
fi
rm -f "$RUNNER_TEMP/cuccut-signing.p12" "$RUNNER_TEMP/cuccut-notary.p8" \
  "$RUNNER_TEMP/cuccut-keychains-before.txt"
```

Self-hosted runners must also ensure that cleanup still runs after a cancelled job, or that the host cleans up any material the job left behind. Upload artifacts using an explicit list of release files. Never upload all of `$RUNNER_TEMP` or the signing backup directory.

### 5.4 Automatic publishing from release tags

The single entry point is `.github/workflows/desktop-release.yml`, which matches `cuccut-v<MAJOR>.<MINOR>.<PATCH>-build.<BUILD>`, for example `cuccut-v3.0.1-build.61`. Only stable version numbers without leading zeros and positive integer builds are accepted. The tag version must equal the version in the root package, the desktop package, and the lockfile at the same time. The build must be higher than the current update feed of every platform, so the version never goes backward. The commit the tag points to must already be on `main`. Tags and public files stay immutable. After all selected platform releases and verifications complete, mark the latest stable desktop version as GitHub Latest, following the [completion steps of the release skill](../.agents/skills/ccut-release/SKILL.md#complete-public-release).

After the version update is complete, verified, and committed to `main`, tag the full source commit that has been pushed:

```bash
git tag -a cuccut-v3.0.1-build.61 <full COMMIT already pushed to main> -m 'CucCut 3.0.1 build 61'
git push origin cuccut-v3.0.1-build.61
```

The version and build here are format examples. Do not tag a commit whose version is still 3.0.0 with a 3.0.1 tag. When only configuring the pipeline, do not create or push a release tag.

The Mac Apple Silicon and Windows x64 CPU, CUDA, and Vulkan builds for the same tag run in parallel. Publishing starts only after all native jobs pass. The Mac build uses the reusable `desktop-macos-build.yml` and the `macos-release` Environment, and temporarily imports the signing and notarization credentials. Windows uses the reusable `desktop-windows.yml` and does not receive Mac Secrets. The Mac candidate uploads only six files: the ZIP, the DMG, two digests, the public report, and the appcast. Keychains, private keys, and intermediate notarization ZIPs are excluded.

Publishing runs in order, Mac then Windows, to avoid pushing update feeds at the same time. After the public downloads are read back, Mac verifies the signature, ticket, Gatekeeper, and App Runtime of the App and DMG again. Windows checks the source, native job, and digest of all three candidates, plus the result of parsing the App's own manifest. Finally, each platform's appcast is committed and pushed separately. Other platforms and old release assets are left unchanged. The report must clearly mark UI/export, real model or GPU inference, and paid Agent calls as not run. The existence of the workflow does not mean a full release has actually been run.

After a failure, check the corresponding job. Prefer re-running the failed job, reusing the candidate already verified. A version/build that is already public is not rebuilt into different bytes, and the tag is not deleted or moved to bypass the immutability check.

### 5.5 Manual verification and single-platform entry point

`desktop-macos.yml` remains manually triggerable from `main`. By default it only validates credentials and does not create a Release:

```bash
gh workflow run desktop-macos.yml --repo hieudinh/cuccut --ref main -f mode=validate
# Generate candidates only; do not publish publicly.
gh workflow run desktop-macos.yml --repo hieudinh/cuccut --ref main -f mode=package -f build=<new BUILD>
# Single-platform emergency publish; the regular all-platform release uses the release tag from §5.4.
gh workflow run desktop-macos.yml --repo hieudinh/cuccut --ref main -f mode=publish -f build=<new BUILD>
```

Validation imports the private key, signs and runs the probe, checks the full fingerprint and access to Apple notarization, then cleans up. The first real Actions credential validation, the full build, and the public release are each recorded separately. The single-platform entry point does not automatically resume other platforms.

Local checks are `node --test apps/desktop/tools/desktop-release-rules.test.mjs apps/desktop/tools/macos-release.test.mjs apps/desktop/tools/windows-release.test.mjs` and `actionlint .github/workflows/*.yml`.

## 6. Completion criteria for release and backup

- The new App ID is registered, and the `CFBundleIdentifier` of the build and the update verification use the same ID.
- The new certificate has been issued. The manifest's fingerprint, serial number, and validity period match the actual signature.
- Recovery of the private key from the encrypted `.p12` and a real signing drill both succeed, and the backup digest is recorded correctly.
- The second backup location and the decryption password in the password manager have both been confirmed to exist.
- Notarization credentials on a new machine or in CI pass the access check. Saving only the profile name is not enough.
- For the current artifact, signing, notarization, staple, Gatekeeper, and the required feature acceptance have passed, and the report is saved.
- Only after CI has actually run may you claim that the Actions release is available. The status of not issued, not exported, drill not recovered, or Secrets not uploaded must each be noted separately.

## 7. Official references

- [Apple: Create Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates)
- [Apple: Export and share signing identities](https://developer.apple.com/documentation/xcode/sharing-your-teams-signing-certificates)
- [Apple: Customizing the notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)
- [GitHub: Installing a signing certificate on a macOS runner](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)
