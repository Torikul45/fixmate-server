import { createRemoteJWKSet, jwtVerify } from "jose";

const authURL = process.env.BETTER_AUTH_URL;

if (!authURL) {
  throw new Error("BETTER_AUTH_URL is missing from environment variables");
}

const JWKS = createRemoteJWKSet(
  new URL("/api/auth/jwks", authURL),
);

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Unauthorized. Please login first.",
      });
    }

    const token = authHeader.split(" ")[1];

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authURL,
      audience: authURL,
    });

    if (!payload.sub) {
      return res.status(401).json({
        message: "Invalid token payload",
      });
    }

    req.user = {
      id: payload.sub,
      ...payload,
    };

    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export default verifyToken;
