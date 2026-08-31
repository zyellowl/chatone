import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, '../..');
const iosRoot = path.join(projectRoot, 'custom/ios');

async function read(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8');
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.name !== '.build')
      .map((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? listFiles(target) : [target];
      }),
  );
  return nested.flat();
}

test('the iOS bundle contains no ZenMux credential', async () => {
  const files = await listFiles(iosRoot);
  const leaks = [];
  for (const file of files) {
    const content = await readFile(file, 'utf8').catch(() => '');
    if (content.includes('ZENMUX_API_KEY=')) {
      leaks.push(path.relative(projectRoot, file));
    }
  }
  assert.deepEqual(leaks, []);
});

test('the iOS web view keeps login state and appends a browser-compatible user agent token', async () => {
  const source = await read('custom/ios/ChatOne/Sources/WebView.swift');
  assert.match(source, /websiteDataStore\s*=\s*\.default\(\)/);
  assert.match(source, /applicationNameForUserAgent\s*=\s*"ChatOne-iOS\/1\.0"/);
  assert.doesNotMatch(source, /customUserAgent/);
});

test('physical devices require a configurable server while Simulator uses localhost', async () => {
  const source = await read('custom/ios/ChatOne/Sources/ServerAddress.swift');
  assert.match(source, /#if targetEnvironment\(simulator\)/);
  assert.match(source, /http:\/\/127\.0\.0\.1:3080/);
  assert.match(source, /#else\s+static let initialValue = ""/);
});

test('local networking and upload permission descriptions are declared', async () => {
  const plist = await read('custom/ios/ChatOne/Info.plist');
  assert.match(plist, /NSAllowsLocalNetworking/);
  assert.doesNotMatch(plist, /NSAllowsArbitraryLoads(?:InWebContent)?/);
  assert.match(plist, /NSLocalNetworkUsageDescription/);
  assert.match(plist, /NSCameraUsageDescription/);
  assert.match(plist, /NSPhotoLibraryUsageDescription/);
});

test('the iOS client validates servers and supports native download sharing', async () => {
  const address = await read('custom/ios/ChatOne/Sources/ServerAddress.swift');
  const probe = await read('custom/ios/ChatOne/Sources/ServerProbe.swift');
  const webView = await read('custom/ios/ChatOne/Sources/WebView.swift');
  assert.match(address, /isSecureEnoughForDevice/);
  assert.match(address, /192/);
  assert.match(probe, /URLSessionConfiguration\.ephemeral/);
  assert.match(webView, /WKDownloadDelegate/);
  assert.match(webView, /UIActivityViewController/);
  assert.match(webView, /contentInsetAdjustmentBehavior\s*=\s*\.never/);
});

test('the iOS target bundles a privacy manifest for app-local preferences', async () => {
  const manifest = await read('custom/ios/ChatOne/PrivacyInfo.xcprivacy');
  const project = await read('custom/ios/ChatOne.xcodeproj/project.pbxproj');
  assert.match(manifest, /NSPrivacyAccessedAPICategoryUserDefaults/);
  assert.match(manifest, /CA92\.1/);
  assert.match(project, /PrivacyInfo\.xcprivacy in Resources/);
});

test('the shared web client opts into iPhone safe-area viewport behavior', async () => {
  const html = await read('client/index.html');
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /interactive-widget=resizes-content/);
});

test('the Xcode target supports iPhone and iPad on iOS 16 or newer', async () => {
  const project = await read('custom/ios/ChatOne.xcodeproj/project.pbxproj');
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = app\.chatone\.ios/);
  assert.match(project, /IPHONEOS_DEPLOYMENT_TARGET = 16\.0/);
  assert.match(project, /TARGETED_DEVICE_FAMILY = "1,2"/);
});

test('the App Store icon preparation removes the alpha channel', async () => {
  const script = await read('custom/ios/prepare.sh');
  assert.match(script, /AppIcon-troll\.png/);
  assert.match(script, /-s format jpeg/);
  assert.match(script, /-s format png/);
});

test('the iPhone uses the server-side ChatGPT subscription route without bundling OAuth data', async () => {
  const config = await read('librechat.yaml');
  const registry = await read('custom/model-registry.json');
  const iosFiles = await listFiles(path.join(projectRoot, 'custom/ios'));
  assert.match(config, /model:\s+'gpt-5\.6-sol'/);
  assert.match(config, /ChatGPT Subscription/);
  assert.match(config, /host\.docker\.internal:4317/);
  assert.match(registry, /OpenAI Subscription/);
  for (const file of iosFiles) {
    const content = await readFile(file, 'utf8').catch(() => '');
    assert.doesNotMatch(content, /chatgpt-account-id|PI_AUTH_FILE|auth\.json/);
  }
});
