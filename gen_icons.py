import math
from PIL import Image, ImageDraw

def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * 0.22)  # corner radius
    # gradient background
    top = (37, 99, 235)
    bot = (79, 134, 247)
    for y in range(size):
        t = y / (size - 1)
        c = (int(top[0] + (bot[0] - top[0]) * t),
             int(top[1] + (bot[1] - top[1]) * t),
             int(top[2] + (bot[2] - top[2]) * t))
        d.line([(0, y), (size, y)], fill=c)
    # rounded corners: punch out corners
    corner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cd = ImageDraw.Draw(corner)
    cd.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=(255, 255, 255, 255))
    img = Image.composite(img, Image.new("RGBA", (size, size), (0, 0, 0, 0)), corner)

    # clock face
    cx = cy = size / 2
    rad = size * 0.30
    d = ImageDraw.Draw(img)
    d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(255, 255, 255, 255))
    lw = max(3, int(size * 0.045))
    # minute hand (pointing up-right)
    ang_m = math.radians(-60)
    d.line([cx, cy, cx + rad * 0.72 * math.sin(ang_m), cy - rad * 0.72 * math.cos(ang_m)],
           fill=(37, 99, 235, 255), width=lw, joint="curve")
    # hour hand (pointing up)
    ang_h = math.radians(-30)
    d.line([cx, cy, cx + rad * 0.5 * math.sin(ang_h), cy - rad * 0.5 * math.cos(ang_h)],
           fill=(249, 115, 22, 255), width=int(lw * 1.3), joint="curve")
    # center dot
    cr = max(4, int(size * 0.03))
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(37, 99, 235, 255))
    return img

for s in (192, 512):
    make_icon(s).save(f"/Users/zw/WorkBuddy/01/kaoyan-app/icons/icon-{s}.png")
# apple touch icon standard 180x180
make_icon(180).save("/Users/zw/WorkBuddy/01/kaoyan-app/icons/apple-touch-icon.png")
print("icons generated")
