# Harmony Staging API Setup

This guide configures the FO3 Ticketing backend on Ubuntu to connect securely
to the Harmony staging API hosted at `172.31.32.64:96`.

## Background

The Harmony staging service on port `96` requires HTTPS. Its TLS certificate is
valid for `*.dswd.gov.ph`, not for the IP address `172.31.32.64`. Therefore, the
backend must connect using the certificate-compatible hostname:

```text
fo3-valid.dswd.gov.ph
```

The remote server also sends an incomplete TLS certificate chain: it sends the
`*.dswd.gov.ph` server certificate but omits the `GlobalSign RSA OV SSL CA 2018`
intermediate certificate. Browsers and `curl` may still succeed, but Node.js can
fail with:

```text
unable to verify the first certificate
```

Because the remote server is not under our control, the missing public
intermediate certificate is supplied to Node.js on the Ubuntu ticketing server.

## Final configuration

The backend environment must contain:

```env
HARMONY_API_URL=https://fo3-valid.dswd.gov.ph:96/api/v1/integrations
HARMONY_API_TOKEN=<staging-api-token>
```

Do not put Markdown link syntax, brackets, or quotes around the URL.

## 1. Configure hostname resolution

The preferred solution is an internal DNS `A` record:

```text
fo3-valid.dswd.gov.ph    A    172.31.32.64
```

If internal DNS is unavailable, add this entry to `/etc/hosts` on the Ubuntu
ticketing server:

```text
172.31.32.64 fo3-valid.dswd.gov.ph
```

Verify resolution:

```bash
getent hosts fo3-valid.dswd.gov.ph
```

Expected output includes:

```text
172.31.32.64    fo3-valid.dswd.gov.ph
```

## 2. Install the missing GlobalSign intermediate certificate

Download the intermediate certificate referenced by the remote server's
certificate:

```bash
curl -fsSLo /tmp/gsrsaovsslca2018.crt \
  http://secure.globalsign.com/cacert/gsrsaovsslca2018.crt
```

The downloaded certificate is DER encoded. Convert it to PEM:

```bash
openssl x509 -inform DER \
  -in /tmp/gsrsaovsslca2018.crt \
  -out /tmp/gsrsaovsslca2018.pem
```

Verify its identity before installing it:

```bash
openssl x509 \
  -in /tmp/gsrsaovsslca2018.pem \
  -noout -subject -issuer -dates -fingerprint -sha256
```

The subject must be:

```text
C=BE, O=GlobalSign nv-sa, CN=GlobalSign RSA OV SSL CA 2018
```

The expected SHA-256 fingerprint is:

```text
B6:76:FF:A3:17:9E:88:12:09:3A:1B:5E:AF:EE:87:6A:E7:A6:AA:F2:31:07:8D:AD:1B:FB:21:CD:28:93:76:4A
```

Do not install the certificate if the subject or fingerprint differs.

Install the verified public certificate:

```bash
sudo mv /tmp/gsrsaovsslca2018.pem /etc/ssl/certs/
sudo chmod 0644 /etc/ssl/certs/gsrsaovsslca2018.pem
rm -f /tmp/gsrsaovsslca2018.crt
```

No private key from the Harmony server is required. Never request or copy its
`.key` file.

## 3. Test HTTPS from Node.js

Run:

```bash
NODE_EXTRA_CA_CERTS=/etc/ssl/certs/gsrsaovsslca2018.pem \
node -e "require('https').get(\
'https://fo3-valid.dswd.gov.ph:96/api/v1/integrations/auth/employees',\
r => { console.log('HTTP status:', r.statusCode); r.resume(); }\
).on('error', error => { console.error(error.message); process.exitCode = 1; })"
```

Expected result:

```text
HTTP status: 401
```

The `401` is expected because this diagnostic request does not send the Harmony
API token. It confirms that hostname resolution, connectivity, HTTPS, and TLS
certificate validation are working.

## 4. Update the backend environment

Edit `/var/www/fo3_ticketing/backend/.env` and set:

```env
HARMONY_API_URL=https://fo3-valid.dswd.gov.ph:96/api/v1/integrations
```

Keep the existing staging `HARMONY_API_TOKEN`. Do not commit `.env` or expose
the token in screenshots, logs, or documentation.

## 5. Restart the backend through PM2

Pass the additional CA file to the PM2-managed Node process:

```bash
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/gsrsaovsslca2018.pem
pm2 restart 0 --update-env
pm2 save
```

If the backend is not PM2 process `0`, find its ID or name first:

```bash
pm2 list
```

Then restart it using the displayed ID or process name.

## 6. Verify the running application

Review the logs:

```bash
pm2 logs 0 --lines 50
```

The startup output should include:

```text
[Harmony API] Initialized with URL: https://fo3-valid.dswd.gov.ph:96/api/v1/integrations
```

Attempt a normal application login. The following errors should no longer
appear:

```text
You're speaking plain HTTP to an SSL-enabled server port
getaddrinfo ENOTFOUND fo3-valid.dswd.gov.ph
unable to verify the first certificate
```

If Harmony returns `401` after the TLS error is resolved, check that
`HARMONY_API_TOKEN` is the correct active staging token. An authenticated
application request returning `401` indicates a token or authorization issue,
not a TLS issue.

## Troubleshooting

### Plain HTTP sent to the SSL port

Error:

```text
You're speaking plain HTTP to an SSL-enabled server port
```

Confirm that `HARMONY_API_URL` begins with `https://`, then restart PM2.

### Hostname cannot be resolved

Error:

```text
getaddrinfo ENOTFOUND fo3-valid.dswd.gov.ph
```

Check:

```bash
getent hosts fo3-valid.dswd.gov.ph
```

Restore the internal DNS record or `/etc/hosts` entry if no address is returned.

### Node cannot verify the certificate

Error:

```text
unable to verify the first certificate
```

Check that the certificate file exists and that PM2 received the environment
variable:

```bash
test -r /etc/ssl/certs/gsrsaovsslca2018.pem && echo readable
pm2 env 0 | grep NODE_EXTRA_CA_CERTS
```

If the variable is absent, export it and restart with `--update-env` again.

### Direct API probe

This probe verifies DNS, networking, and TLS without exposing the API token:

```bash
curl -i \
  https://fo3-valid.dswd.gov.ph:96/api/v1/integrations/auth/employees
```

An unauthenticated `401` response containing `No token provided` is expected.

## Security requirements

- Never set `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Never configure Axios with `rejectUnauthorized: false`.
- Never copy or request the Harmony server's private `.key` file.
- Never commit `HARMONY_API_TOKEN` or other `.env` secrets.
- Validate the intermediate certificate fingerprint before installation.

## Rollback

To remove the client-side CA configuration from the running PM2 process:

```bash
unset NODE_EXTRA_CA_CERTS
pm2 restart 0 --update-env
pm2 save
```

After confirming that no other service uses the downloaded certificate, remove
it if required:

```bash
sudo rm /etc/ssl/certs/gsrsaovsslca2018.pem
```

Restore the previous `HARMONY_API_URL` only if the Harmony service endpoint has
also been intentionally rolled back.
