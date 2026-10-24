# Passkey Authentication (WebAuthn / FIDO2)

This Flask application uses WebAuthn passkeys for phishing-resistant authentication. In a team-restricted test deployment, OTP sign-in and Dev OTP can also be enabled temporarily for testing; those OTP modes are not phishing-resistant.

## Authentication flows

- **New account:** enter a name and email, verify the emailed OTP (or use Dev OTP in a test deployment), then create a passkey on this site's real origin. The account remains unauthenticated until the server verifies the WebAuthn registration response.
- **Sign in:** use a discoverable passkey with user verification or request an emailed OTP. When `DEV_LOGIN_ENABLED=true`, a Dev OTP button is also available without sending email.
OTP is not cryptographically origin-bound. Keep the app restricted to your team and disable OTP test mode before making the site public or using real user accounts. The HTTP `Origin` header check is an additional browser control, not cryptographic proof, because non-browser clients can forge it.

## Server configuration

Configure SMTP credentials only in the server environment (local `.env` or your hosting provider's secret/environment settings). They are no longer accepted or changed through a public web form or API. Supported variables are listed in `.env.example`.

The UI shows the version set in `APP_VERSION` (default `1.0.0`). Email OTP sign-in is available independently of `DEV_LOGIN_ENABLED`. Set `DEV_LOGIN_ENABLED=true` only for a private, team-restricted test deployment to show the additional **Dev OTP** button on the login and registration screens. Dev OTP generates a short-lived OTP on the server without sending email, fills it into the normal OTP form, and uses the same OTP verification endpoint. It bypasses mailbox ownership checks for both actions, so do not enable it on a public site or use it with real accounts. Set it to `false` before production use.

Configure WebAuthn trust values on the server; never derive these from request headers or client input. For local development:

```env
WEBAUTHN_ORIGIN=http://localhost:5000
WEBAUTHN_RP_ID=localhost
SECRET_KEY=use-a-private-random-value-at-least-32-characters
```

In production, use HTTPS and set `WEBAUTHN_ORIGIN` to the exact public origin (scheme, hostname, and non-default port if any; no path or trailing slash), and `WEBAUTHN_RP_ID` to exactly that hostname. For example:

```env
WEBAUTHN_ORIGIN=https://your-service.onrender.com
WEBAUTHN_RP_ID=your-service.onrender.com
SECRET_KEY=use-a-private-random-value-at-least-32-characters
```

Generate a private session key with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

The server pins the configured origin and RP ID during both registration and authentication verification. A page served under a proxy's different hostname cannot produce WebAuthn client data for the configured origin, so its credential response is rejected. Do not expose the app through an untrusted reverse proxy or configure the RP ID as a broad parent domain.

## Run locally

```bash
python -m pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000` with the matching local WebAuthn configuration. In production, use the exact HTTPS origin configured above.

## WebAuthn implementation

`app.py` provides these endpoints:

1. `POST /api/passkeys/register/options` generates a one-time registration challenge for a signed-in user or a short-lived email-verified enrollment session.
2. `POST /api/passkeys/register/verify` consumes the challenge, verifies the configured origin/RP ID and user verification, stores the credential (and creates a new account atomically, when applicable), and only then promotes a pending enrollment to an authenticated session.
3. `POST /api/passkeys/authenticate/options` creates an anonymous discoverable-credential challenge.
4. `POST /api/passkeys/authenticate/verify` consumes the challenge, verifies the assertion signature and origin/RP ID, updates the authenticator counter, and creates the authenticated session.

The browser uses `navigator.credentials.create()` and `navigator.credentials.get()`. OTP and passkey requests use `FormData`; the serialized WebAuthn credential is appended as a form field. Challenges are short-lived and atomically consumed once.

SQLite stores user records, passkey credential IDs, public keys, signature counters, and ceremony challenges. The server never accepts a login public key from the browser and never establishes a login session based only on an OTP.
