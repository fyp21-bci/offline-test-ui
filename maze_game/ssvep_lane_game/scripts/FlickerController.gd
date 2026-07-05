## FlickerController.gd
## ─────────────────────────────────────────────────────────────────────────────
## STANDALONE flicker utility — NOT used in Main.gd (flicker is embedded there).
## Provided for reference or if you want to split flicker into its own node.
##
## ┌──────────────────────────────────────────────────────────────────────────┐
## │  FLICKER MATH (60 Hz display, 0.5 duty cycle, frame-count ONLY)          │
## │                                                                           │
## │  Left  Arrow → 10 Hz                                                     │
## │    60 / 10 = 6 frames/cycle  (integer — exact!)                          │
## │    Exact 50%: 3 ON / 3 OFF  →  10 Hz, 50% duty  ✓                        │
## │                                                                           │
## │  Right Arrow → 12 Hz                                                     │
## │    60 / 12 = 5 frames/cycle (integer, but 2.5 ON non-integer)            │
## │    Best exact-50%: 10-frame superperiod                                   │
## │      sub-cycle A (0-4):  3 ON → sub-cycle B (5-9): 2 ON                 │
## │      Average = 2.5/5 = 50% duty at 12 Hz                                 │
## └──────────────────────────────────────────────────────────────────────────┘

extends Node

# Public: set to true to enable flicker, false to hide arrows
var flicker_active: bool = false

# Node paths — set these after adding FlickerController to your scene
@export var left_arrow_path:  NodePath
@export var right_arrow_path: NodePath

var _left:  Node
var _right: Node
var _fc:    int = 0   # frame counter

func _ready() -> void:
	_left  = get_node(left_arrow_path)
	_right = get_node(right_arrow_path)

func _process(_delta: float) -> void:
	_fc += 1

	if not flicker_active:
		_left.visible  = false
		_right.visible = false
		return

	# Left: 6-frame cycle, 3/3 — exact 10 Hz, exact 50%
	_left.visible = (_fc % 6) < 3

	# Right: 10-frame superperiod
	var sp: int = _fc % 10
	var f5: int = _fc % 5
	_right.visible = (f5 < 3) if (sp < 5) else (f5 < 2)

func reset() -> void:
	_fc = 0
