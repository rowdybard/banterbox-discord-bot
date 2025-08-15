import nacl from 'tweetnacl';

/**
 * Verifies Discord interaction requests using Ed25519 signature verification
 */
export function verifyDiscordRequest(req: any, publicKey: string): boolean {
  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');
  const body = req.rawBody || JSON.stringify(req.body);

  if (!signature || !timestamp) {
    return false;
  }

  try {
    const isValid = nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, 'hex'),
      Buffer.from(publicKey, 'hex')
    );
    return isValid;
  } catch (error) {
    console.error('Discord signature verification error:', error);
    return false;
  }
}