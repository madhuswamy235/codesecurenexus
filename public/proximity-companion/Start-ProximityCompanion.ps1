param(
  [int]$Port = 47853,
  [int]$DeviceWindowSeconds = 15,
  [int]$SessionTimeoutMinutes = 60
)

$ErrorActionPreference = 'Stop'
$originAllowList = @(
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://localhost:3000',
  'https://localhost:3001',
  'https://127.0.0.1:3000',
  'https://127.0.0.1:3001'
)
$listener = $null
$watcher = $null
$receivedToken = $null
$devices = [hashtable]::Synchronized(@{})
$state = [hashtable]::Synchronized(@{
  status = 'not-paired'
  error = ''
  sessionId = ''
  pairedAt = $null
  totalFound = 0
  attempts = 0
})

function New-RandomHex([int]$Length) {
  $bytes = New-Object byte[] ($Length / 2)
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Test-ConstantTimeString([string]$Expected, [string]$Actual) {
  if ($null -eq $Expected -or $null -eq $Actual) { return $false }
  $expectedBytes = [System.Text.Encoding]::UTF8.GetBytes($Expected)
  $actualBytes = [System.Text.Encoding]::UTF8.GetBytes($Actual)
  $difference = $expectedBytes.Length -bxor $actualBytes.Length
  $length = [Math]::Max($expectedBytes.Length, $actualBytes.Length)
  for ($index = 0; $index -lt $length; $index++) {
    $left = if ($index -lt $expectedBytes.Length) { $expectedBytes[$index] } else { 0 }
    $right = if ($index -lt $actualBytes.Length) { $actualBytes[$index] } else { 0 }
    $difference = $difference -bor ($left -bxor $right)
  }
  return $difference -eq 0
}

function Get-ActiveDevices {
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $cutoff = $now - ($DeviceWindowSeconds * 1000)
  $active = 0
  foreach ($address in @($devices.Keys)) {
    $entry = $devices[$address]
    if ($entry.seenAt -lt $cutoff) {
      $devices.Remove($address)
    } else {
      $active++
    }
  }
  return $active
}

function Start-BluetoothWatcher {
  if ($script:watcher) { return }
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $watcherType = [Windows.Devices.Bluetooth.Advertisement.BluetoothLEAdvertisementWatcher, Windows, ContentType=WindowsRuntime]
  $script:watcher = $watcherType::new()
  $script:watcher.ScanningMode = [Windows.Devices.Bluetooth.Advertisement.BluetoothLEScanningMode]::Active
  $script:watcher.AllowExtendedAdvertising = $true
  $devicesRef = $script:devices
  $stateRef = $script:state
  $script:receivedHandler = {
    param($sender, $eventArgs)
    try {
      $signal = [int]$eventArgs.RawSignalStrengthInDBm
      if ($signal -lt -70) { return }
      $address = [string]$eventArgs.BluetoothAddress
      if ([string]::IsNullOrWhiteSpace($address)) { return }
      $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      if (-not $devicesRef.ContainsKey($address)) {
        $stateRef.totalFound = [int]$stateRef.totalFound + 1
      }
      $devicesRef[$address] = @{ seenAt = $now }
    } catch {
      $stateRef.error = 'Bluetooth advertisement processing failed.'
    }
  }.GetNewClosure()
  $script:receivedToken = $script:watcher.add_Received($script:receivedHandler)
  try {
    $script:watcher.Start()
    $script:state.status = 'scanning'
    $script:state.error = ''
  } catch {
    $script:state.status = 'unavailable'
    $script:state.error = $_.Exception.Message
    throw
  }
}

function Stop-BluetoothWatcher {
  if ($script:watcher) {
    try { $script:watcher.Stop() } catch { }
    if ($script:receivedToken) {
      try { $script:watcher.remove_Received($script:receivedToken) } catch { }
    }
    $script:watcher = $null
    $script:receivedToken = $null
  }
}

function Send-JsonResponse($Context, [int]$StatusCode, $Payload, [string]$Origin) {
  $response = $Context.Response
  $response.StatusCode = $StatusCode
  $response.ContentType = 'application/json; charset=utf-8'
  $response.Headers['Cache-Control'] = 'no-store'
  $response.Headers['Access-Control-Allow-Origin'] = $Origin
  $response.Headers['Vary'] = 'Origin'
  $json = ConvertTo-Json -InputObject $Payload -Depth 6 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $response.ContentLength64 = $bytes.Length
  $response.OutputStream.Write($bytes, 0, $bytes.Length)
  $response.Close()
}

function Read-RequestJson($Request) {
  if ($Request.ContentLength64 -gt 4096) { throw 'Request body is too large.' }
  $reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
  try { $body = $reader.ReadToEnd() } finally { $reader.Dispose() }
  if ([string]::IsNullOrWhiteSpace($body)) { throw 'A JSON request body is required.' }
  return ConvertFrom-Json -InputObject $body
}

$pairingCode = New-RandomHex 24
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")

Write-Host ''
Write-Host 'SecureNexus Windows Bluetooth proximity companion' -ForegroundColor Cyan
Write-Host 'Pair this window with the candidate interview page. Do not share the code.' -ForegroundColor Yellow
Write-Host "Pairing code: $pairingCode" -ForegroundColor Green
Write-Host "Local service: http://127.0.0.1:$Port/"
Write-Host 'This scan observes Bluetooth LE advertisements only; it cannot identify non-advertising devices.'
Write-Host 'Close this window to stop scanning.'
Write-Host ''

try {
  $listener.Start()
} catch {
  Write-Error "Unable to start the local companion on port $Port. Close any existing companion window and try again. $($_.Exception.Message)"
  exit 1
}

$startedAt = [DateTimeOffset]::UtcNow
try {
  while ($listener.IsListening) {
    if (([DateTimeOffset]::UtcNow - $startedAt).TotalMinutes -gt $SessionTimeoutMinutes) {
      Write-Host 'Companion session expired.'
      break
    }

    $context = $listener.GetContext()
    $request = $context.Request
    $origin = [string]$request.Headers['Origin']
    $hostHeader = [string]$request.Headers['Host']
    $remoteAddress = [string]$request.RemoteEndPoint.Address
    $allowedHost = $hostHeader -in @("127.0.0.1:$Port", "localhost:$Port")

    if ($origin -notin $originAllowList -or -not $allowedHost -or $remoteAddress -notin @('127.0.0.1', '::1')) {
      Send-JsonResponse $context 403 @{ success = $false; message = 'Origin or host is not allowed.' } $origin
      continue
    }

    if ($request.HttpMethod -eq 'OPTIONS') {
      $context.Response.StatusCode = 204
      $context.Response.Headers['Access-Control-Allow-Origin'] = $origin
      $context.Response.Headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
      $context.Response.Headers['Access-Control-Allow-Headers'] = 'Content-Type'
      $context.Response.Headers['Access-Control-Max-Age'] = '300'
      $context.Response.Headers['Access-Control-Allow-Private-Network'] = 'true'
      $context.Response.Headers['Vary'] = 'Origin'
      $context.Response.Close()
      continue
    }

    $path = $request.Url.AbsolutePath.TrimEnd('/')
    if ($request.HttpMethod -eq 'GET' -and $path -eq '/health') {
      Send-JsonResponse $context 200 @{
        success = $true
        companion = 'SecureNexus Windows BLE'
        status = $state.status
      } $origin
      continue
    }

    if ($request.HttpMethod -eq 'POST' -and $path -eq '/pair') {
      if ($state.attempts -ge 6) {
        Send-JsonResponse $context 429 @{ success = $false; message = 'Pairing attempts exceeded. Restart the companion to generate a new code.' } $origin
        continue
      }
      $state.attempts = [int]$state.attempts + 1
      try {
        $body = Read-RequestJson $request
        $candidateCode = [string]$body.pairingCode
        $sessionId = [string]$body.sessionId
        if (-not (Test-ConstantTimeString $pairingCode $candidateCode)) {
          Send-JsonResponse $context 401 @{ success = $false; message = 'Pairing code is invalid.' } $origin
          continue
        }
        if ($sessionId -notmatch '^[a-zA-Z0-9_-]{8,128}$') {
          Send-JsonResponse $context 400 @{ success = $false; message = 'Interview session identifier is invalid.' } $origin
          continue
        }
        if ($state.status -ne 'not-paired') {
          Send-JsonResponse $context 409 @{ success = $false; message = 'This companion is already paired. Restart it to pair another interview.' } $origin
          continue
        }
        $state.sessionId = $sessionId
        $state.pairedAt = [DateTimeOffset]::UtcNow.ToString('o')
        $pairingCode = New-RandomHex 24
        $devices.Clear()
        $state.totalFound = 0
        try {
          Start-BluetoothWatcher
          Write-Host "Paired and scanning session $sessionId." -ForegroundColor Green
        } catch {
          Write-Warning "Pairing succeeded, but Bluetooth scanning could not start: $($_.Exception.Message)"
        }
        Send-JsonResponse $context 200 @{
          success = $true
          paired = $true
          status = $state.status
          error = $state.error
        } $origin
      } catch {
        Send-JsonResponse $context 400 @{ success = $false; message = $_.Exception.Message } $origin
      }
      continue
    }

    if ($request.HttpMethod -eq 'GET' -and $path -eq '/status') {
      $requestedSession = [string]$request.QueryString['sessionId']
      if ($state.status -eq 'not-paired' -or $requestedSession -ne $state.sessionId) {
        Send-JsonResponse $context 403 @{ success = $false; message = 'This companion is not paired with this interview.' } $origin
        continue
      }
      Send-JsonResponse $context 200 @{
        success = $true
        paired = $true
        status = $state.status
        activeDeviceCount = (Get-ActiveDevices)
        totalFound = [int]$state.totalFound
        windowSeconds = $DeviceWindowSeconds
        updatedAt = [DateTimeOffset]::UtcNow.ToString('o')
        error = $state.error
      } $origin
      continue
    }

    Send-JsonResponse $context 404 @{ success = $false; message = 'Not found.' } $origin
  }
} finally {
  Stop-BluetoothWatcher
  if ($listener) {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
  }
}
