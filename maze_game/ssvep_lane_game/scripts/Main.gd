## Main.gd
## Key game-logic rules:
##   - Decision window OPENS when an obstacle spawns at the top of the screen.
##   - Obstacles and road NEVER pause — they keep moving during decision.
##   - Obstacle speed is slow enough (75 px/s) that the EEG has ~7 s to complete
##     before the obstacle reaches the player (travel = 540 px / 75 px/s = 7.2 s).
##   - Game does not start until the Start screen is dismissed.

extends Node2D

# ── Node refs ─────────────────────────────────────────────────────────────────
@onready var player:        Node2D      = $Game/Player
@onready var road:          Node2D      = $Game/Road
@onready var eeg:           Node        = $EEGClient
@onready var left_arrow:    TextureRect = $UI/LeftArrow
@onready var right_arrow:   TextureRect = $UI/RightArrow
@onready var progress_bar:  ProgressBar = $UI/ProgressBar
@onready var timer_label:   Label       = $UI/GameTimerLabel
@onready var phase_label:   Label       = $UI/PhaseLabel
@onready var score_label:   Label       = $UI/ScoreLabel
@onready var end_overlay:   ColorRect   = $UI/EndOverlay
@onready var end_label:     Label       = $UI/EndOverlay/EndLabel

@onready var start_screen:   CanvasLayer = $StartScreen
@onready var channels_input: LineEdit    = $StartScreen/Panel/ChannelsInput
@onready var board_input:    LineEdit    = $StartScreen/Panel/BoardInput
@onready var reclen_input:   LineEdit    = $StartScreen/Panel/RecLenInput
@onready var start_button:   Button      = $StartScreen/Panel/StartBtn

# ── Constants ─────────────────────────────────────────────────────────────────
const GAME_DURATION:   float = 60.0
const PLAYER_Y:        float = 490.0
const BASE_ROAD_SPEED: float = 110.0
const SURGE_SPEED:     float = 480.0
const SURGE_DURATION:  float = 0.55
const LANE_X           := [455.0, 640.0, 825.0]

# Obstacle: slow enough that 5 s EEG finishes before obstacle reaches player
# Travel = (PLAYER_Y - spawn_y) / OBS_SPEED = (490+50)/75 = 7.2 s  ✓
const OBS_SPEED:     float = 75.0
const OBS_W:         float = 80.0
const OBS_H:         float = 35.0
const OBS_SPAWN_INT: float = 10.0   # seconds between obstacle/decision cycles
const HIT_ZONE:      float = 42.0

# ── State ─────────────────────────────────────────────────────────────────────
var game_started:      bool  = false
var game_over:         bool  = false
var in_decision_phase: bool  = false
var flicker_active:    bool  = false
var time_left:         float = GAME_DURATION
var elapsed_recording: float = 0.0
var _road_offset:      float = 0.0
var _road_speed:       float = BASE_ROAD_SPEED
var _surge_timer:      float = 0.0
var _spawn_timer:      float = 3.0   # first obstacle after 3 s
var _obstacles:        Array[Node2D] = []
var score:             int   = 0
var hits:              int   = 0

# ─────────────────────────────────────────────────────────────────────────────
func _ready() -> void:
	end_overlay.visible = false
	left_arrow.visible  = false
	right_arrow.visible = false
	progress_bar.value  = 0.0
	timer_label.text    = "60"
	phase_label.text    = "Configure and Start"
	score_label.text    = "Avoided: 0  |  Hits: 0"

	eeg.recording_started.connect(_on_recording_started)
	eeg.result_received.connect(_on_result_received)
	eeg.poll_error.connect(_on_poll_error)
	start_button.pressed.connect(_on_start_pressed)

	_create_road_dashes()
	# Show start screen; _process is gated on game_started
	start_screen.visible = true

# ── Start screen handler ──────────────────────────────────────────────────────
func _on_start_pressed() -> void:
	# Parse channels: "1,2,3" → [1, 2, 3]
	var ch_text  := channels_input.text.strip_edges()
	var channels : Array = []
	if ch_text != "":
		for part in ch_text.split(","):
			part = part.strip_edges()
			if part.is_valid_int():
				channels.append(int(part))

	var board_id  := int(board_input.text)  if board_input.text.is_valid_int()   else -1
	var rec_len   := float(reclen_input.text) if reclen_input.text.is_valid_float() else 5.0

	eeg.configure(board_id, rec_len, channels)
	start_screen.visible = false
	game_started = true
	phase_label.text = "Get Ready..."

# ── Road dashes ───────────────────────────────────────────────────────────────
func _create_road_dashes() -> void:
	for dx in [519.0, 759.0]:
		for i in range(16):
			var dash := ColorRect.new()
			dash.color         = Color(0.55, 0.55, 0.65, 0.85)
			dash.offset_left   = dx - 2.0
			dash.offset_right  = dx + 2.0
			dash.offset_top    = i * 80.0 - 640.0
			dash.offset_bottom = i * 80.0 - 610.0
			road.add_child(dash)

# ─────────────────────────────────────────────────────────────────────────────
func _process(delta: float) -> void:
	if not game_started or game_over:
		return

	# ── Countdown ─────────────────────────────────────────────────────────────
	time_left -= delta
	timer_label.text = str(ceili(max(time_left, 0.0)))
	if time_left <= 0.0:
		_end_game()
		return

	# ── Road scroll (always runs — no pause during decision) ──────────────────
	if _surge_timer > 0.0:
		_surge_timer -= delta
		_road_speed = lerp(_road_speed, BASE_ROAD_SPEED, delta * 4.0)
	else:
		_road_speed = BASE_ROAD_SPEED
	_road_offset      += _road_speed * delta
	road.position.y    = fmod(_road_offset, 80.0)

	# ── Flicker ────────────────────────────────────────────────────────────────
	_tick_flicker()

	# ── Progress bar ──────────────────────────────────────────────────────────
	if in_decision_phase:
		elapsed_recording += delta
		progress_bar.value = minf((elapsed_recording / eeg._recording_length) * 100.0, 100.0)

	# ── Obstacle spawn — decision is triggered AT spawn time ──────────────────
	if not in_decision_phase:
		_spawn_timer -= delta
		if _spawn_timer <= 0.0:
			_spawn_obstacle()          # ← also calls _start_decision_phase()
			_spawn_timer = OBS_SPAWN_INT

	# ── Obstacle movement (always runs — they keep approaching during decision)
	_update_obstacles(delta)

# ── Flicker ────────────────────────────────────────────────────────────────────
func _tick_flicker() -> void:
	if not flicker_active:
		left_arrow.visible  = false
		right_arrow.visible = false
		return
	var fc := Engine.get_frames_drawn()
	left_arrow.visible  = (fc % 6) < 3
	var sp := fc % 10
	right_arrow.visible = ((fc % 5) < 3) if (sp < 5) else ((fc % 5) < 2)

# ── Obstacles ─────────────────────────────────────────────────────────────────
func _spawn_obstacle() -> void:
	var lane := randi() % 3
	# Slightly bias away from player's current lane so avoidance is achievable
	if lane == player.current_lane and randf() > 0.3:
		lane = (lane + 1) % 3

	var obs := Node2D.new()
	obs.position = Vector2(LANE_X[lane], -50.0)
	obs.set_meta("lane",    lane)
	obs.set_meta("counted", false)

	var body := ColorRect.new()
	body.color         = Color(0.92, 0.18, 0.12, 1)
	body.offset_left   = -OBS_W * 0.5
	body.offset_right  =  OBS_W * 0.5
	body.offset_top    = -OBS_H * 0.5
	body.offset_bottom =  OBS_H * 0.5
	obs.add_child(body)
	$Game.add_child(obs)
	_obstacles.append(obs)

	# Decision window opens the moment the obstacle appears at the top
	_start_decision_phase()

func _update_obstacles(delta: float) -> void:
	for obs: Node2D in _obstacles.duplicate():
		obs.position.y += OBS_SPEED * delta

		if not obs.get_meta("counted"):
			var dy: float = abs(obs.position.y - PLAYER_Y)
			if dy < HIT_ZONE:
				obs.set_meta("counted", true)
				if obs.get_meta("lane") == player.current_lane:
					hits += 1
					_update_score_label()
					player.flash_hit()
					_shake_screen()
				else:
					score += 1
					_update_score_label()

		if obs.position.y > 800.0:
			_obstacles.erase(obs)
			obs.queue_free()

func _update_score_label() -> void:
	score_label.text = "Avoided: %d  |  Hits: %d" % [score, hits]

func _shake_screen() -> void:
	var t := create_tween()
	t.tween_property($Game, "position:x",  8.0, 0.04)
	t.tween_property($Game, "position:x", -8.0, 0.04)
	t.tween_property($Game, "position:x",  4.0, 0.04)
	t.tween_property($Game, "position:x",  0.0, 0.04)

# ── Decision phase ────────────────────────────────────────────────────────────
func _start_decision_phase() -> void:
	if game_over or in_decision_phase:
		return
	in_decision_phase  = true
	elapsed_recording  = 0.0
	progress_bar.value = 0.0
	flicker_active     = true
	_set_phase("Focus on your target!", Color(1.0, 0.9, 0.2))
	eeg.start_recording()

func _on_recording_started() -> void:
	_set_phase("Recording EEG...", Color(0.4, 0.9, 1.0))

func _on_result_received(decision: String) -> void:
	flicker_active     = false
	in_decision_phase  = false
	progress_bar.value = 100.0
	_set_phase("-> " + decision.to_upper(), Color(0.2, 1.0, 0.5))
	player.apply_decision(decision)
	_road_speed  = SURGE_SPEED
	_surge_timer = SURGE_DURATION
	player.surge()
	get_tree().create_timer(1.5).timeout.connect(
		func(): _set_phase("Avoid the obstacles!", Color(0.8, 0.8, 0.8))
	)

func _on_poll_error(msg: String) -> void:
	_set_phase("Error: " + msg, Color(1.0, 0.35, 0.35))

func _set_phase(text: String, color: Color) -> void:
	phase_label.text     = text
	phase_label.modulate = color

# ── End game ──────────────────────────────────────────────────────────────────
func _end_game() -> void:
	game_over      = true
	flicker_active = false
	eeg.stop_polling()
	for obs in _obstacles:
		obs.queue_free()
	_obstacles.clear()
	left_arrow.visible  = false
	right_arrow.visible = false
	end_overlay.visible = true
	var lane_names := ["Left Lane", "Centre Lane", "Right Lane"]
	end_label.text = "Time's Up!\n\nAvoided: %d  |  Hits: %d\n\nFinished in %s" % [
		score, hits, lane_names[player.current_lane]
	]
