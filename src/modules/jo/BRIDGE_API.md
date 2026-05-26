# JFS4XD bridge HTTP API

X-Dispatch embeds this bridge in the main process when the **JFS4XD** module is enabled.

Default base URL: `http://127.0.0.1:9570`

The network client (shipped with the external JFS4XD module as `bin/jfs4xd-client`) pushes session traffic via `POST /v1/ingest`. X-Dispatch reads status and aircraft for the map overlay.

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

## `POST /v1/ingest`

Used by the JFS4XD network client to update session state:

```json
{
  "sessionConnected": true,
  "sessionName": "My formation flight",
  "hubName": "Public Hub #3",
  "aircraft": [
    /* same shape as GET /v1/aircraft */
  ]
}
```

## X-Plane plugin layout

Install the platform plugin as:

`X-Plane/Resources/plugins/Jo/mac.xpl` (macOS)  
`X-Plane/Resources/plugins/Jo/win.xpl` (Windows)  
`X-Plane/Resources/plugins/Jo/lin.xpl` (Linux)

Legacy `Resources/plugins/JoinFS/` is detected but users are encouraged to migrate to `Jo/`.
