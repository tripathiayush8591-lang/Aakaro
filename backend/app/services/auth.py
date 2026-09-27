import threading
from dataclasses import dataclass

import firebase_admin
from fastapi import Header, Request
from firebase_admin import auth, credentials, exceptions
from google.auth.exceptions import GoogleAuthError

from app.core.config import Settings, configured
from app.core.errors import AppError, configuration_error


@dataclass(frozen=True)
class Identity:
    uid: str


class FirebaseIdentity:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.app = None
        self.lock = threading.Lock()

    def verify(self, token: str) -> Identity:
        if not configured(self.settings.firebase_project_id):
            raise configuration_error()
        try:
            with self.lock:
                if self.app is None:
                    credential = (
                        credentials.Certificate(
                            self.settings.google_application_credentials
                        )
                        if self.settings.google_application_credentials
                        else credentials.ApplicationDefault()
                    )
                    self.app = firebase_admin.initialize_app(
                        credential,
                        {
                            "projectId": self.settings.firebase_project_id,
                            "httpTimeout": 10,
                        },
                        name=f"aakaro-{id(self)}",
                    )
            claims = auth.verify_id_token(token, app=self.app, check_revoked=True)
            return Identity(uid=claims["uid"])
        except auth.ExpiredIdTokenError:
            raise AppError(
                401, "TOKEN_EXPIRED", "Your session expired. Sign in again."
            ) from None
        except (
            auth.InvalidIdTokenError,
            auth.RevokedIdTokenError,
            auth.UserDisabledError,
            auth.UserNotFoundError,
        ):
            raise AppError(
                401, "INVALID_TOKEN", "Your session is invalid. Sign in again."
            ) from None
        except auth.CertificateFetchError:
            raise AppError(
                503,
                "AUTH_UNAVAILABLE",
                "Sign-in verification is temporarily unavailable. Try again.",
                True,
            ) from None
        except (GoogleAuthError, OSError, ValueError):
            raise configuration_error() from None
        except exceptions.FirebaseError:
            raise AppError(
                503,
                "AUTH_UNAVAILABLE",
                "Sign-in verification is temporarily unavailable. Try again.",
                True,
            ) from None

    def close(self) -> None:
        if self.app:
            firebase_admin.delete_app(self.app)


def require_identity(
    request: Request, authorization: str | None = Header(default=None)
) -> Identity:
    # TODO(auth-resume): TEMPORARY development-only accommodation for the deferred
    # Firebase setup. Active only when DEV_AUTH_ENABLED=true (default false) and
    # must be removed together with that setting when Firebase verification is
    # re-enabled. Production deployments must never set DEV_AUTH_ENABLED.
    if request.app.state.settings.dev_auth_enabled:
        return Identity(uid="dev-local")
    # A sync dependency runs Firebase's blocking certificate/revocation I/O in FastAPI's threadpool.
    if not authorization:
        raise AppError(401, "AUTH_REQUIRED", "Sign in with Google to continue.")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip() or len(token) > 16384:
        raise AppError(401, "INVALID_TOKEN", "Your session is invalid. Sign in again.")
    return request.app.state.identity.verify(token)
