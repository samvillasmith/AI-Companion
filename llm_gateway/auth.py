import os
from fastapi import Header, HTTPException
from jose import jwt, JWTError

JWT_ALG = "HS256"
JWT_AUD = "llm-gateway"
JWT_SECRET = os.getenv("GATEWAY_JWT_SECRET")

def require_api_key(authorization: str = Header(default="")) -> dict:
    """
    Accepts Authorization: Bearer <jwt>
    Required claims:
      - sub: key owner (user id or 'service')
      - aud: 'llm-gateway'
      - exp: expiry (unix seconds)
      - scopes: list[str], must include 'chat:invoke'
    """
    # Dev-safety: allow bypass only if secret is unset (local dev)
    if not JWT_SECRET:
        return {"sub": "dev-bypass", "scopes": ["chat:invoke"]}

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG], audience=JWT_AUD)
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    scopes = payload.get("scopes") or []
    if "chat:invoke" not in scopes:
        raise HTTPException(status_code=403, detail="Insufficient scope")

    return {"sub": payload.get("sub"), "scopes": scopes, "jti": payload.get("jti")}
