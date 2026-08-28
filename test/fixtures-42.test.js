// test/fixtures-42.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseSkeleton } from '../src/index.js';

const CH0169_PATH = '/mnt/ssd/vscode/AtlasToolkit/.workspaces/CH0169/CH0169_spr.skel';

test('parses the real CH0169_spr.skel (4.2.33) — developer-local, self-skips if absent', { skip: !existsSync(CH0169_PATH) }, () => {
  const bytes = readFileSync(CH0169_PATH);
  const { version, attachments } = parseSkeleton(new Uint8Array(bytes));
  assert.equal(version.raw, '4.2.33');
  // This is the acceptance check from the AtlasToolkit design spec's
  // Testing section: CH0169_1/2/3 must come back as raw type 'Mesh'.
  for (const name of ['CH0169_1', 'CH0169_2', 'CH0169_3']) {
    const info = attachments.get(name);
    assert.ok(info, `expected an attachment for region ${name}`);
    assert.equal(info.type, 'Mesh', `${name} should be a Mesh attachment, got ${info?.type}`);
  }
});
