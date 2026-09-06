# WINBD-PRO integration contract

## Provider catalogue
`GET /api/provider/games`

Response:
```json
{
  "success": true,
  "data": {
    "provider": "provider-name",
    "games": [
      {
        "id": "external-game-id",
        "name": "Game Name",
        "category": "slots",
        "thumbnailUrl": "https://...",
        "enabled": true
      }
    ]
  }
}
```

## Game launch
`POST /api/provider/launch`

Request:
```json
{
  "gameId": "external-game-id",
  "returnUrl": "https://win-pro-com-lgmh.onrender.com/"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "not_configured",
    "launchUrl": null
  }
}
```

A licensed provider's official server-side API can later implement the adapter without changing the frontend contract.

## Game history
`GET /api/provider/history?limit=50`

Returns provider-neutral session/history records. Settlement/wager logic is deliberately outside this contract.

## Sandbox payment
The existing SSLCOMMERZ module remains sandbox-only and requires `SSLCOMMERZ_MODE=sandbox`, Store ID and Store Password in Render secrets. Never commit credentials.

## Mobile
The frontend now includes a web-app manifest and service-worker shell. This makes the site installable as a PWA where supported. A signed Android APK/AAB still requires an Android build pipeline and signing key; those are not committed to this repository.
