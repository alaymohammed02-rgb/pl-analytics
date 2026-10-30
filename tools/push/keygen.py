"""Makes the keys of the browser notifications (Web Push) and prints nothing secret to the screen.

    python3 tools/push/keygen.py SECRET_FILE        (writes data/push.json and the secret to SECRET_FILE, which must be OUTSIDE the repository)

Two P-256 key pairs:
  vapid - the sender's identity (RFC 8292): the push services only accept messages signed with it; the browser subscribes against its public half.
  box   - the mailbox key: the browser seals each device's subscription (and the teams it follows) to the public half, so that it can be dropped in a public
          ntfy topic and kept in the public repository without anyone but the sync being able to read it.
The public halves go to data/push.json (committed). The private halves go to SECRET_FILE as JSON {"vapid": ..., "box": ...}: its text is what the repository
secret PUSH_KEYS must hold (GitHub: Settings > Secrets and variables > Actions > New repository secret). Never commit it; a new run makes new keys, which
makes every device's old subscription unreadable, so run it once.
"""
import sys, os, json, base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

b64u = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def pair():
    k = ec.generate_private_key(ec.SECP256R1())
    raw = k.private_numbers().private_value.to_bytes(32, "big")
    pub = k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    return b64u(raw), b64u(pub)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    secret = os.path.abspath(sys.argv[1])
    root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
    if secret.startswith(root + os.sep):
        sys.exit("SECRET_FILE must be outside the repository")
    out = os.path.join(root, "data", "push.json")
    if os.path.exists(out) or os.path.exists(secret):
        sys.exit("keys already exist (data/push.json or the secret file): refusing to make new ones")
    (vs, vp), (bs, bp) = pair(), pair()
    with open(secret, "w") as f:
        json.dump({"vapid": vs, "box": bs}, f, separators=(",", ":"))
    os.chmod(secret, 0o600)
    with open(out, "w") as f:
        json.dump({"v": 1, "vapid": vp, "box": bp}, f, separators=(",", ":"))
    print("wrote", out, "and", secret)
