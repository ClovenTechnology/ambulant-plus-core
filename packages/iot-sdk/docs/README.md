# Ambulant+ IoMT Adapter Pattern
Each device has a single adapter file that exposes:
- `start(deviceId, streams, onData)` -> returns `stop()`

To plug a new device:
1. Drop a new adapter in `packages/iot-sdk/adapters/<vendor>/adapter.ts` (copy from `adapters/mock/stream.ts`).
2. Add a device entry to `packages/iot-sdk/devices.json` with:
   - `id`, `vendor`, `name`, `group` (e.g., smartwatch, smartring), `active`, `mode` (`mock` or `live`), `streams`.
3. No UI changes required; Admin `/sdk` and Patient `/vitals` pick it up automatically.
