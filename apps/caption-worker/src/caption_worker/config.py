import os
from dataclasses import dataclass


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class CaptionWorkerConfig:
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    aws_region: str
    api_gateway_url: str
    worker_id: str
    provider: str
    language: str
    enable_medical: bool
    persist: bool
    bot_name: str
    medical_specialty: str
    medical_type: str

    @classmethod
    def from_env(cls) -> "CaptionWorkerConfig":
        cfg = cls(
            livekit_url=os.getenv("LIVEKIT_URL") or os.getenv("LIVEKIT_WS_URL") or "",
            livekit_api_key=os.getenv("LIVEKIT_API_KEY", ""),
            livekit_api_secret=os.getenv("LIVEKIT_API_SECRET", ""),
            aws_region=os.getenv("AWS_REGION", "eu-west-1"),
            api_gateway_url=os.getenv("API_GATEWAY_URL", "").rstrip("/"),
            worker_id=os.getenv("CAPTION_WORKER_ID", "caption-worker"),
            provider=os.getenv("CAPTION_PROVIDER", "aws-transcribe-medical"),
            language=os.getenv("CAPTION_LANGUAGE", "en-US"),
            enable_medical=_bool_env("CAPTION_ENABLE_MEDICAL", True),
            persist=_bool_env("CAPTION_PERSIST", True),
            bot_name=os.getenv("CAPTION_BOT_NAME", "AmbulantCaptionWorker"),
            medical_specialty=os.getenv("CAPTION_MEDICAL_SPECIALTY", "PRIMARYCARE"),
            medical_type=os.getenv("CAPTION_MEDICAL_TYPE", "CONVERSATION"),
        )
        cfg.validate()
        return cfg

    def validate(self) -> None:
        missing = []
        if not self.livekit_url:
            missing.append("LIVEKIT_URL")
        if not self.livekit_api_key:
            missing.append("LIVEKIT_API_KEY")
        if not self.livekit_api_secret:
            missing.append("LIVEKIT_API_SECRET")
        if missing:
            raise RuntimeError("Missing required caption-worker env: " + ", ".join(missing))

        if self.provider == "aws-transcribe-medical" and self.language != "en-US":
            raise RuntimeError("aws-transcribe-medical requires CAPTION_LANGUAGE=en-US")

        if self.persist and not self.api_gateway_url:
            raise RuntimeError("CAPTION_PERSIST=true requires API_GATEWAY_URL")
