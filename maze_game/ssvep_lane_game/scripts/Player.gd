## Player.gd
extends Node2D

const LANE_X := [455.0, 640.0, 825.0]
var current_lane: int = 1
var _lane_tween: Tween = null   # tracked so we can kill it if a new decision arrives

signal lane_changed(new_lane: int)

func _ready() -> void:
	position = Vector2(LANE_X[current_lane], 490.0)

func apply_decision(direction: String) -> void:
	match direction:
		"left":  current_lane = max(0, current_lane - 1)
		"right": current_lane = min(2, current_lane + 1)

	# Kill any in-progress lane tween so the new position takes over immediately
	if _lane_tween and _lane_tween.is_running():
		_lane_tween.kill()

	_lane_tween = create_tween()
	_lane_tween.tween_property(self, "position:x", LANE_X[current_lane], 0.28)\
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	emit_signal("lane_changed", current_lane)

# Called after a successful EEG decision — brief forward lunge animation
func surge() -> void:
	var tween := create_tween()
	tween.tween_property($PlayerSprite, "scale", Vector2(1.0, 0.75), 0.08)\
		.set_ease(Tween.EASE_OUT)
	tween.tween_property($PlayerSprite, "scale", Vector2(1.05, 1.1), 0.15)\
		.set_ease(Tween.EASE_OUT)
	tween.tween_property($PlayerSprite, "scale", Vector2(1.0, 1.0), 0.18)\
		.set_ease(Tween.EASE_IN_OUT)

# Called on obstacle collision — red flash
func flash_hit() -> void:
	var sprite: TextureRect = $PlayerSprite
	var tween := create_tween()
	tween.tween_property(sprite, "modulate", Color(1.5, 0.2, 0.2, 1), 0.06)
	tween.tween_property(sprite, "modulate", Color.WHITE, 0.25)
