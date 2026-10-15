const net = require('net');

function normalizeIp(value) {
  if (!value) return '';

  let ip = String(value).trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

function ipv4ToNumber(ip) {
  if (net.isIP(ip) !== 4) return null;
  return ip.split('.').reduce((value, octet) => ((value << 8) | Number(octet)) >>> 0, 0);
}

function matchesEntry(ip, entry) {
  const normalizedEntry = normalizeIp(entry);
  if (!normalizedEntry) return false;

  if (!normalizedEntry.includes('/')) return ip === normalizedEntry;

  const [network, prefixText] = normalizedEntry.split('/');
  const prefix = Number(prefixText);
  const ipNumber = ipv4ToNumber(ip);
  const networkNumber = ipv4ToNumber(network);

  if (ipNumber === null || networkNumber === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipNumber & mask) === (networkNumber & mask);
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getClientIp(req, trustedProxies) {
  const peerIp = normalizeIp(req.socket?.remoteAddress);
  const peerIsTrusted = trustedProxies.some((entry) => matchesEntry(peerIp, entry));

  if (!peerIsTrusted) return peerIp;

  const realIp = normalizeIp(req.get('x-real-ip'));
  if (net.isIP(realIp)) return realIp;

  const forwardedIp = normalizeIp(String(req.get('x-forwarded-for') || '').split(',')[0]);
  return net.isIP(forwardedIp) ? forwardedIp : peerIp;
}

function createIpAllowlist(options = {}) {
  const envName = options.envName || 'PUBLIC_MONITORING_ALLOWED_IPS';
  const trustedProxyEnvName = options.trustedProxyEnvName || 'TRUSTED_PROXY_IPS';

  return function ipAllowlist(req, res, next) {
    const allowedIps = parseList(process.env[envName]);
    const trustedProxies = parseList(process.env[trustedProxyEnvName] || '127.0.0.1,::1');
    const clientIp = getClientIp(req, trustedProxies);

    // Fail closed when no allowlist has been configured.
    if (!allowedIps.length || !allowedIps.some((entry) => matchesEntry(clientIp, entry))) {
      console.warn(`[IP allowlist] Denied ${req.method} ${req.originalUrl} from ${clientIp || 'unknown'}`);
      return res.status(403).json({ error: 'This monitoring page is not available from your IP address.' });
    }

    req.clientIp = clientIp;
    return next();
  };
}

module.exports = { createIpAllowlist, normalizeIp, matchesEntry, getClientIp };
