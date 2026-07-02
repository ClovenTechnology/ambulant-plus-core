from __future__ import annotations

from typing import AsyncIterable, Optional

import numpy as np

from .config import CaptionWorkerConfig


class AwsTranscribeMedicalProvider:
    """
    Provider boundary for AWS Transcribe Medical.

    The next patch wires the streaming call and result handler here. Keeping this
    isolated prevents LiveKit room logic, persistence, and UI event contracts from
    depending on AWS SDK details.
    """

    def __init__(self, cfg: CaptionWorkerConfig) -> None:
        self.cfg = cfg

    async def transcribe_pcm_stream(self, pcm_chunks: AsyncIterable[np.ndarray]) -> AsyncIterable[dict]:
        raise NotImplementedError("AWS Transcribe Medical streaming provider will be wired in Sweep 5B2")
