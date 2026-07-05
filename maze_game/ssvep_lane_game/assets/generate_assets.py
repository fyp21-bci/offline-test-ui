"""
generate_assets.py
Generates all PNG assets needed for the SSVEP Lane Game:
  - arrow_left.png   (white filled left triangle, 512x512, transparent bg)
  - arrow_right.png  (white filled right triangle, 512x512, transparent bg)
  - player.png       (glowing blue car-like rectangle)
  - lane_stripe.png  (dashed centre-line tile for road scroll)
"""

from PIL import Image, ImageDraw, ImageFilter
import os

OUT = os.path.dirname(__file__)   # same folder as this script

# ── Helpers ────────────────────────────────────────────────────────────────────

def new(size=512, mode="RGBA"):
    return Image.new(mode, (size, size), (0, 0, 0, 0))

def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path)
    print(f"  Saved: {path}")


# ══ 1. LEFT ARROW ════════════════════════════════════════════════════════════
def make_arrow(direction="left", size=512):
    img = new(size)
    draw = ImageDraw.Draw(img)

    pad = int(size * 0.08)
    cx = size // 2
    cy = size // 2

    if direction == "left":
        # Triangle: tip at left, base at right
        pts = [
            (pad,          cy),           # tip
            (size - pad,   pad),          # top-right
            (size - pad,   size - pad),   # bottom-right
        ]
    else:
        pts = [
            (size - pad,   cy),           # tip
            (pad,          pad),          # top-left
            (pad,          size - pad),   # bottom-left
        ]

    # Soft glow layer (slightly larger, blurred)
    glow = new(size)
    gdraw = ImageDraw.Draw(glow)
    gdraw.polygon(pts, fill=(255, 255, 255, 180))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=18))

    # Sharp white triangle
    draw.polygon(pts, fill=(255, 255, 255, 255))

    # Compose: glow under the sharp arrow
    result = Image.alpha_composite(glow, img)
    return result

save(make_arrow("left"),  "arrow_left.png")
save(make_arrow("right"), "arrow_right.png")


# ══ 2. PLAYER SPRITE ═════════════════════════════════════════════════════════
def make_player(w=80, h=120):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Main body — vibrant blue rounded rect
    body_color  = (50,  140, 255, 255)
    glow_color  = (50,  140, 255, 80)
    shine_color = (180, 220, 255, 200)

    # Glow halo
    draw.rounded_rectangle([-8, -8, w+8, h+8], radius=18, fill=glow_color)
    # Body
    draw.rounded_rectangle([4, 4, w-4, h-4], radius=12, fill=body_color)
    # Windshield shine
    draw.ellipse([14, 10, w-14, 38], fill=shine_color)
    # Headlight dots
    draw.ellipse([8,  h-22, 24, h-8],  fill=(255, 240, 180, 255))
    draw.ellipse([w-24, h-22, w-8, h-8], fill=(255, 240, 180, 255))

    return img

save(make_player(), "player.png")


# ══ 3. LANE STRIPE TILE ══════════════════════════════════════════════════════
def make_stripe(w=8, h=80):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # White dash occupying top half of tile
    draw.rectangle([0, 0, w, 36], fill=(200, 200, 208, 160))
    return img

save(make_stripe(), "lane_stripe.png")

print("\nAll assets generated successfully.")
