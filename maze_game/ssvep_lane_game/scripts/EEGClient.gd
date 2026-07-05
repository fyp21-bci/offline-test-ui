## EEGClient.gd
## Handles all HTTP communication with the SSVEP backend API.
extends Node

signal recording_started()
signal result_received(decision: String)
signal poll_error(message: String)

const BASE_URL       := "http://localhost:8000"
const START_ENDPOINT := "/stream/questionnaire/start"
const RESULT_ENDPOINT:= "/stream/questionnaire/result"
const POLL_INTERVAL  := 0.5
const FREQ_LEFT      := 10.0
const FREQ_RIGHT     := 12.0

# ── Configurable (set via configure() before starting) ────────────────────────
var _board_id:          int   = -1
var _recording_length:  float = 5.0
var _channel_names:     Array = []   # empty = don't send field (backend uses default)

var _http_start: HTTPRequest
var _http_poll:  HTTPRequest
var _polling:    bool = false

func _ready() -> void:
	_http_start = HTTPRequest.new()
	_http_poll  = HTTPRequest.new()
	add_child(_http_start)
	add_child(_http_poll)
	_http_start.request_completed.connect(_on_start_completed)
	_http_poll.request_completed.connect(_on_poll_completed)

# Call this from the start-screen before the first recording ──────────────────
func configure(board_id: int, rec_length: float, channels: Array) -> void:
	_board_id         = board_id
	_recording_length = rec_length
	_channel_names    = channels

func start_recording() -> void:
	_polling = false
	var body: Dictionary = {
		"serial_port":          "/dev/ttyUSB0",
		"board_id":             0 if _board_id == -1 else _board_id,
		"recording_length":     _recording_length,
		"candidate_frequencies": [FREQ_LEFT, FREQ_RIGHT]
	}
	if _channel_names.size() > 0:
		body["channel_names"] = _channel_names

	var err := _http_start.request(
		BASE_URL + START_ENDPOINT,
		["Content-Type: application/json"],
		HTTPClient.METHOD_POST,
		JSON.stringify(body)
	)
	if err != OK:
		push_error("[EEGClient] start request failed: %d" % err)

func stop_polling() -> void:
	_polling = false

func _on_start_completed(_r, code, _h, _b) -> void:
	if code != 200:
		push_error("[EEGClient] start returned %d" % code)
		return
	emit_signal("recording_started")
	_polling = true
	_do_poll()

func _do_poll() -> void:
	if not _polling:
		return
	_http_poll.request(BASE_URL + RESULT_ENDPOINT)

func _on_poll_completed(_r, code, _h, body: PackedByteArray) -> void:
	if not _polling:
		return
	if code != 200:
		emit_signal("poll_error", "HTTP %d" % code)
		_schedule_next_poll()
		return
	var data = JSON.parse_string(body.get_string_from_utf8())
	if data == null:
		emit_signal("poll_error", "Bad JSON")
		_schedule_next_poll()
		return
	if data.has("done") and data["done"] == true:
		_polling = false
		var freq: float = float(data.get("result", {}).get("majority_frequency", 0.0))
		emit_signal("result_received", _map(freq))
	else:
		_schedule_next_poll()

func _schedule_next_poll() -> void:
	if not _polling:
		return
	await get_tree().create_timer(POLL_INTERVAL).timeout
	_do_poll()

func _map(freq: float) -> String:
	if is_equal_approx(freq, FREQ_LEFT):  return "left"
	if is_equal_approx(freq, FREQ_RIGHT): return "right"
	return "none"
