class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, retryable: bool = False):
        self.status = status
        self.code = code
        self.message = message
        self.retryable = retryable


def configuration_error() -> AppError:
    return AppError(
        503,
        "CONFIGURATION_ERROR",
        "The server needs configuration. Ask the operator to check the setup guide.",
    )
