# Jo bridge HTTP API (for plugin authors)

X-Dispatch polls a small JSON HTTP server that the **Jo** companion (or JoinFS add-on) should expose on the simulator machine.

Default base URL: `http://127.0.0.1:9570`

## `GET /v1/status`

```json
{
  "ok": true,
  "sessionConnected": true,
  "sessionName": "My formation flight",
  "hubName": "Public Hub #3",
  "aircraftCount": 12
}
```

## `GET /v1/aircraft`

```json
{
  "updatedAt": "2026-05-26T20:00:00.000Z",
  "aircraft": [
    {
      "id": "node-abc:42",
      "callsign": "F-GABC",
      "latitude": 48.723,
      "longitude": 2.379,
      "altitude": 3500,
      "heading": 270,
      "groundspeed": 145,
      "aircraftType": "A320",
      "owner": "PilotOne",
      "isUser": false
    }
  ]
}
```

Only aircraft in the **current JoinFS session** (or hub scope the user joined) should be listed.

## X-Plane plugin layout

Install the platform plugin as:

`X-Plane/Resources/plugins/Jo/mac.xpl` (macOS)  
`X-Plane/Resources/plugins/Jo/win.xpl` (Windows)  
`X-Plane/Resources/plugins/Jo/lin.xpl` (Linux)

Legacy `Resources/plugins/JoinFS/` is detected but users are encouraged to migrate to `Jo/`.
