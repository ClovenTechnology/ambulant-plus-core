# CarePort Demo Seed + Smoke Test

This is the recommended approach: deterministic seed script + API smoke scripts.

## Copy files

```powershell
New-Item -ItemType Directory ".\scripts\careport" -Force | Out-Null
Copy-Item ".\seed-careport-demo.ts" ".\scripts\careport\seed-careport-demo.ts" -Force
Copy-Item ".\smoke-careport-pickup.ts" ".\scripts\careport\smoke-careport-pickup.ts" -Force
Copy-Item ".\smoke-careport-delivery.ts" ".\scripts\careport\smoke-careport-delivery.ts" -Force
```

## Start api-gateway

```powershell
$env:NODE_OPTIONS="--max-old-space-size=12288"
pnpm --filter api-gateway dev
```

Expected base:

```txt
http://localhost:3010
```

## Seed CarePort demo data

```powershell
$env:NODE_OPTIONS="--max-old-space-size=12288"
$env:APIGW_BASE="http://localhost:3010"
pnpm exec tsx .\scripts\careport\seed-careport-demo.ts
```

## Run pickup smoke test first

```powershell
$env:APIGW_BASE="http://localhost:3010"
pnpm exec tsx .\scripts\careport\smoke-careport-pickup.ts
```

Expected final line:

```txt
[PASS] CarePort pickup flow completed end to end.
```

## Run delivery smoke test second

```powershell
$env:APIGW_BASE="http://localhost:3010"
pnpm exec tsx .\scripts\careport\smoke-careport-delivery.ts
```

Expected final line:

```txt
[PASS/PARTIAL] Delivery flow reached dispatch/location stage.
```

Delivery may reveal rider-assignment runtime gaps. Pickup should pass first.
