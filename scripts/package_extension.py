import os
import zipfile

dist_dir = r"C:\Users\boosa\.gemini\antigravity\scratch\mangaverse\dist"
output_zip = r"C:\Users\boosa\.gemini\antigravity\scratch\mangaverse\mangaverse-extension-v1.0.0.zip"

print(f"Packaging {dist_dir} into {output_zip}...")

with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(dist_dir):
        for file in files:
            full_path = os.path.join(root, file)
            # relative path inside zip must NOT have dist/ prefix
            rel_path = os.path.relpath(full_path, dist_dir)
            zipf.write(full_path, rel_path)

print(f"Extension packaged successfully! Size: {os.path.getsize(output_zip) / 1024:.1f} KB")
