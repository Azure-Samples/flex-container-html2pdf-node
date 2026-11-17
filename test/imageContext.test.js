const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..');

test('image context is deterministic and excludes unrelated files', async () => {
  const { hashImageContext, prepareImageContext } = await import(
    '../infra/scripts/imagecontext.mjs'
  );
  const firstRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'image-context-test-'));
  const secondRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'image-context-test-'));
  const firstContext = path.join(firstRoot, 'context');
  const secondContext = path.join(secondRoot, 'context');
  const workerInput = `worker-sha256:${'a'.repeat(64)}`;

  try {
    const firstHash = prepareImageContext(
      repositoryRoot,
      firstContext,
      [workerInput],
    );
    const secondHash = prepareImageContext(
      repositoryRoot,
      secondContext,
      [workerInput],
    );

    assert.match(firstHash, /^[0-9a-f]{64}$/);
    assert.equal(secondHash, firstHash);
    assert.deepEqual(fs.readdirSync(firstContext).sort(), [
      '.dockerignore',
      'host.json',
      'node24.Dockerfile',
      'package-lock.json',
      'package.json',
      'src',
      'tsconfig.json',
      'vendor',
    ]);

    fs.appendFileSync(path.join(secondContext, 'host.json'), '\n');
    assert.notEqual(hashImageContext(secondContext, [workerInput]), firstHash);
    assert.notEqual(
      hashImageContext(firstContext, [`worker-sha256:${'b'.repeat(64)}`]),
      firstHash,
    );
  } finally {
    fs.rmSync(firstRoot, { recursive: true, force: true });
    fs.rmSync(secondRoot, { recursive: true, force: true });
  }
});

test('Dockerfile uses the official floating Node worker reference', () => {
  const dockerfile = fs.readFileSync(
    path.join(repositoryRoot, 'node24.Dockerfile'),
    'utf8',
  );

  assert.match(
    dockerfile,
    /https:\/\/aka\.ms\/azurefunctions\/releases\/node\/worker\/latest\/worker\.tar\.gz/,
  );
  assert.doesNotMatch(
    dockerfile,
    /azure-functions-nodejs-worker\/releases\/download\/v\d+/,
  );
  assert.match(dockerfile, /ARG FUNCTIONS_NODE_WORKER_SHA256/);
  assert.match(dockerfile, /sha256sum -c/);
});
