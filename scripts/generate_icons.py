import os
from PIL import Image, ImageDraw, ImageFont

icons_dir = r"C:\Users\boosa\.gemini\antigravity\scratch\mangaverse\public\icons"
os.makedirs(icons_dir, exist_ok=True)

sizes = [16, 32, 48, 128]

for s in sizes:
    # Create image with RGBA
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw rounded rectangle background with gradient effect
    radius = max(2, s // 4)
    draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=(147, 51, 234, 255), outline=(192, 132, 252, 255), width=max(1, s // 24))
    
    # Draw stylized 'M'
    margin = s * 0.22
    w = s - (margin * 2)
    h = s - (margin * 2)
    
    points = [
        (margin, s - margin),
        (margin, margin),
        (s / 2, s * 0.58),
        (s - margin, margin),
        (s - margin, s - margin)
    ]
    
    line_width = max(2, int(s * 0.12))
    draw.line([points[0], points[1]], fill=(255, 255, 255, 255), width=line_width)
    draw.line([points[1], points[2]], fill=(255, 255, 255, 255), width=line_width)
    draw.line([points[2], points[3]], fill=(255, 255, 255, 255), width=line_width)
    draw.line([points[3], points[4]], fill=(255, 255, 255, 255), width=line_width)
    
    out_path = os.path.join(icons_dir, f"icon{s}.png")
    img.save(out_path, 'PNG')
    print(f"Generated {out_path}")

print("All icons successfully generated!")
