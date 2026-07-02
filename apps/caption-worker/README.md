# Ambulant+ Caption Worker

Long-running server-side LiveKit caption worker.

This is not a Vercel app and should not be deployed as serverless.

Recommended production runtime:

- AWS ECS Fargate task/service
- AWS App Runner for earlier staging
- EC2 + systemd/pm2 only for temporary testing

The worker joins LiveKit rooms as a service participant, subscribes to audio,
streams audio to the configured STT provider, publishes caption events back
to the room, and persists final transcript segments to api-gateway when enabled.

Required server-side environment:

```env
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

AWS_REGION=eu-west-1

API_GATEWAY_URL=
CAPTION_PROVIDER=aws-transcribe-medical
CAPTION_LANGUAGE=en-US
CAPTION_ENABLE_MEDICAL=true
CAPTION_PERSIST=true
```

Do not expose AWS credentials or LIVEKIT_API_SECRET to patient-app or clinician-app.
