import jwt from 'jsonwebtoken';
import { config } from '../config';

// Google's public x509 certs for Firebase ID tokens. Verifying against these
// lets us trust a client OTP login without a Firebase service-account key.
const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let certCache: { certs: Record<string, string>; exp: number } = { certs: {}, exp: 0 };

async function getCerts(): Promise<Record<string, string>> {
  if (Date.now() < certCache.exp && Object.keys(certCache.certs).length) return certCache.certs;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error('Could not fetch Firebase signing certificates');
  const certs = (await res.json()) as Record<string, string>;
  const m = (res.headers.get('cache-control') || '').match(/max-age=(\d+)/);
  const ttl = m ? parseInt(m[1], 10) * 1000 : 3600_000;
  certCache = { certs, exp: Date.now() + ttl };
  return certs;
}

export interface FirebaseIdentity {
  uid: string;
  phoneNumber: string | null;
}

/** Verify a Firebase ID token (RS256, Google-signed) and return its identity.
 *  Checks signature, audience (= project id), issuer and expiry. */
export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity> {
  const projectId = config.firebase.projectId;
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header?.kid) {
    throw new Error('Malformed ID token');
  }
  const cert = (await getCerts())[decoded.header.kid];
  if (!cert) throw new Error('Unknown token signing key');

  const payload = jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  }) as any;

  return { uid: payload.sub || payload.user_id, phoneNumber: payload.phone_number || null };
}
