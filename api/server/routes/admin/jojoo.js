const express = require('express');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();
const ownerOrigin = process.env.JOJOO_OWNER_API_URL || 'http://host.docker.internal:8788';

router.use(requireJwtAuth, requireCapability(SystemCapabilities.ACCESS_ADMIN));
router.use((_req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  next();
});

async function proxyOwnerRequest(req, res, suffix, options = {}) {
  try {
    const contentType = options.contentType || 'application/json';
    const requestBody = req.method === 'GET' || req.method === 'DELETE'
      ? undefined
      : Buffer.isBuffer(req.body)
        ? req.body
        : JSON.stringify(req.body);
    const upstream = await fetch(`${ownerOrigin}${suffix}`, {
      method: req.method,
      signal: AbortSignal.timeout(30_000),
      headers: {
        accept: 'application/json',
        ...(requestBody ? { 'content-type': contentType } : {}),
        origin: 'http://127.0.0.1:3080',
      },
      body: requestBody,
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.byteLength > 6 * 1024 * 1024) {
      res.status(502).json({ error: 'JOJOO_OWNER_RESPONSE_TOO_LARGE' });
      return;
    }
    const upstreamType = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).type(upstreamType).send(body);
  } catch {
    res.status(503).json({ error: 'JOJOO_OWNER_UNAVAILABLE' });
  }
}

router.get('/content', (req, res) => proxyOwnerRequest(req, res, '/api/studio/content'));
router.put('/content', (req, res) => proxyOwnerRequest(req, res, '/api/studio/content'));
router.post('/content/publish', (req, res) =>
  proxyOwnerRequest(req, res, '/api/studio/content/publish'),
);

router.get('/blog/articles', (req, res) =>
  proxyOwnerRequest(req, res, '/api/studio/blog/articles'),
);
router.get('/blog/articles/:id', (req, res) =>
  proxyOwnerRequest(req, res, `/api/studio/blog/articles/${encodeURIComponent(req.params.id)}`),
);
router.post('/blog/articles', (req, res) =>
  proxyOwnerRequest(req, res, '/api/studio/blog/articles'),
);
router.post('/blog/articles/:id', (req, res) =>
  proxyOwnerRequest(req, res, `/api/studio/blog/articles/${encodeURIComponent(req.params.id)}`),
);
router.delete('/blog/articles/:id', (req, res) =>
  proxyOwnerRequest(req, res, `/api/studio/blog/articles/${encodeURIComponent(req.params.id)}`),
);
router.post(
  '/blog/media',
  express.raw({
    limit: '6mb',
    type: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'],
  }),
  (req, res) => proxyOwnerRequest(req, res, '/api/studio/blog/media', {
    contentType: req.headers['content-type'],
  }),
);
router.get('/blog/media/:filename', (req, res) =>
  proxyOwnerRequest(
    req,
    res,
    `/api/studio/blog/media/${encodeURIComponent(req.params.filename)}`,
  ),
);

module.exports = router;
