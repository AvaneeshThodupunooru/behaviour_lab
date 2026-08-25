$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8000'
$pass = 0; $fail = 0
function Check($name, $cond, $detail) {
  if ($cond) { Write-Output ("PASS  {0}" -f $name); $script:pass++ }
  else { Write-Output ("FAIL  {0} :: {1}" -f $name, $detail); $script:fail++ }
}

# 1. health (either store mode is valid)
$h = Invoke-RestMethod "$base/api/health"
Check "GET /api/health" ($h.status -eq 'ok' -and ($h.store -eq 'memory' -or $h.store -eq 'mongodb')) ($h | ConvertTo-Json -Compress)

# 2. create session
$s = Invoke-RestMethod -Method Post -Uri "$base/api/sessions" -ContentType 'application/json' -Body '{"participant_id":"TEST-001","name":"Smoke Test"}'
$sid = $s.session_id
Check "POST /api/sessions" ($sid -match '^EVT-\d{4}-\d{5}$' -and $s.participant.participant_id -eq 'TEST-001') ($s | ConvertTo-Json -Compress)

# 3. get session
$g = Invoke-RestMethod "$base/api/sessions/$sid"
Check "GET /api/sessions/{id}" ($g.session_id -eq $sid -and $g.games.timer.status -eq 'pending') "session fetch"

# 4-7. submit four game results
$timer = '{"rounds":[],"gazeSamples":[],"timerVisits":[],"metrics":{"accuracy":0.83,"meanReactionTimeMs":912.4,"stddevReactionTimeMs":140.2,"checksPerMinute":6.3,"attentionSwitchesPerMinute":4.1,"pressureIndex":57}}'
$r1 = Invoke-RestMethod -Method Post -Uri "$base/api/sessions/$sid/games/timer" -ContentType 'application/json' -Body $timer
Check "POST games/timer" ($r1.status -eq 'ok') ($r1 | ConvertTo-Json -Compress)

$gaze = '{"imageCount":4,"sampleCount":1180}'
$r2 = Invoke-RestMethod -Method Post -Uri "$base/api/sessions/$sid/games/gaze" -ContentType 'application/json' -Body $gaze
Check "POST games/gaze" ($r2.status -eq 'ok') ($r2 | ConvertTo-Json -Compress)

$ww = '{"available":true,"wobble_score":42.1,"mean_deviation_pct":18.4,"max_deviation_pct":51.0,"path_efficiency_pct":81.2,"direction_changes":3,"drift_direction":"left","walk_duration_seconds":9.2,"walk_distance_body_widths":5.1,"tracked_frames":240,"route":[],"measurement_unit":"percent of shoulder width"}'
$r3 = Invoke-RestMethod -Method Post -Uri "$base/api/sessions/$sid/games/wobblewalk" -ContentType 'application/json' -Body $ww
Check "POST games/wobblewalk" ($r3.status -eq 'ok') ($r3 | ConvertTo-Json -Compress)

$dp = '{"laughCount":4,"peakScorePct":78,"durationSeconds":60,"mode":"timed","log":[],"capturedAt":"2026-08-25T00:00:00Z"}'
$r4 = Invoke-RestMethod -Method Post -Uri "$base/api/sessions/$sid/games/deadpan" -ContentType 'application/json' -Body $dp
Check "POST games/deadpan" ($r4.status -eq 'ok') ($r4 | ConvertTo-Json -Compress)

# duplicate submission must not corrupt
Invoke-RestMethod -Method Post -Uri "$base/api/sessions/$sid/games/deadpan" -ContentType 'application/json' -Body $dp | Out-Null
$dup = Invoke-RestMethod "$base/api/sessions/$sid"
Check "duplicate submission idempotent" ($dup.games.deadpan.result.laughCount -eq 4) ($dup.games.deadpan | ConvertTo-Json -Compress)

# negative checks
try { Invoke-RestMethod -Method Post -Uri "$base/api/sessions/$sid/games/chess" -ContentType 'application/json' -Body '{}'; $bad=$false } catch { $bad = $true }
Check "unknown game rejected (400)" $bad "expected HTTP error"
try { Invoke-RestMethod "$base/api/sessions/EVT-9999-99999" -ErrorAction SilentlyContinue; $nf=$false } catch { $nf = $true }
Check "missing session 404" $nf "expected HTTP error"

# 8. report
$rep = Invoke-RestMethod "$base/api/sessions/$sid/report"
Check "GET report has 4 games" ($rep.games_completed.Count -eq 4 -and $rep.summary.gaze.imagesViewed -eq 4 -and $rep.summary.deadpan.laughCount -eq 4) ($rep | ConvertTo-Json -Depth 6 -Compress)

# 9. complete
$c = Invoke-RestMethod -Method Post -Uri "$base/api/sessions/$sid/complete"
Check "POST complete" ($null -ne $c.completed_at) ($c | ConvertTo-Json -Compress)

Write-Output ("RESULT: {0} passed, {1} failed" -f $pass, $fail)
if ($fail -gt 0) { exit 1 }
