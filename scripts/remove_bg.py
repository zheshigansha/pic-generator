"""
RMBG-1.4 Background Removal Script
Usage: python remove_bg.py <input_image_path> <output_image_path> [model_path]

Depends on: numpy, pillow, onnxruntime
Install: pip install numpy pillow onnxruntime
"""

import sys
import os
import base64
import json

# Determine python executable
PYTHON = os.environ.get('PYTHON', sys.executable)


def get_python():
    """Find the correct Python with required packages."""
    # Try current python first
    try:
        import numpy
        import onnxruntime
        return sys.executable
    except ImportError:
        pass

    # Try Python313
    python313 = r'C:\Users\Administrator\AppData\Local\Programs\Python\Python313\python.exe'
    if os.path.exists(python313):
        try:
            import subprocess
            r = subprocess.run([python313, '-c', 'import numpy; import onnxruntime'],
                             capture_output=True)
            if r.returncode == 0:
                return python313
        except:
            pass
    return sys.executable


def remove_background(input_path: str, output_path: str, model_path: str = None) -> str:
    """
    Remove background from image using RMBG-1.4 model.
    Returns path to output PNG with transparency.
    """
    if model_path is None:
        model_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'models', 'onnx', 'model.onnx'
        )

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input image not found: {input_path}")

    # Create temp dir for output if needed
    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)

    # Build the inference script
    script = f'''
import sys
import os
import numpy as np
from PIL import Image
import onnxruntime as ort

model_path = r"{model_path}"
input_path = r"{input_path}"
output_path = r"{output_path}"

# Load model
session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
input_name = session.get_inputs()[0].name
output_name = session.get_outputs()[0].name

# Load and preprocess image
img = Image.open(input_path).convert("RGB")
orig_size = img.size  # (w, h)

# Resize to 1024x1024 for model input
img_resized = img.resize((1024, 1024), Image.BILINEAR)
img_np = np.array(img_resized).astype(np.float32)

# Normalize: (x / 255.0 - 0.5)  (mean=[0.5,0.5,0.5], std=[1.0,1.0,1.0])
img_normalized = img_np / 255.0 - 0.5

# CHW format, add batch dim
img_input = np.transpose(img_normalized, (2, 0, 1))[np.newaxis, ...]

# Run inference
result = session.run([output_name], {{input_name: img_input.astype(np.float32)}})
mask = result[0][0, 0]  # Shape: (1024, 1024)

# Postprocess: normalize mask to 0-255
mask_norm = (mask - mask.min()) / (mask.max() - mask.min() + 1e-8)
mask_img = Image.fromarray((mask_norm * 255).astype(np.uint8), mode="L")
mask_img = mask_img.resize(orig_size, Image.LANCZOS)

# Apply transparent background
img_rgba = img.convert("RGBA")
img_rgba.putalpha(mask_img)
img_rgba.save(output_path, "PNG")

print("OK:", output_path)
'''

    import subprocess
    python = os.environ.get('PYTHON', r'C:\Users\Administrator\AppData\Local\Programs\Python\Python313\python.exe')
    result = subprocess.run(
        [python, '-c', script],
        capture_output=True, text=True, timeout=120
    )

    if result.returncode != 0:
        raise RuntimeError(f"Background removal failed: {result.stderr}")

    output_line = result.stdout.strip()
    if not output_line.startswith('OK:'):
        raise RuntimeError(f"Background removal failed: {result.stdout} {result.stderr}")

    return output_path


def remove_background_from_base64(base64_data: str, output_path: str, model_path: str = None) -> str:
    """
    Remove background from a base64-encoded image.
    base64_data: data URL or raw base64 string (PNG/JPEG)
    """
    import base64

    # Parse data URL if present
    if ',' in base64_data:
        header, data = base64_data.split(',', 1)
        # header like "data:image/png;base64"
    else:
        data = base64_data

    image_bytes = base64.b64decode(data)

    # Save temp input
    temp_input = output_path + '.temp_input.png'
    with open(temp_input, 'wb') as f:
        f.write(image_bytes)

    try:
        return remove_background(temp_input, output_path, model_path)
    finally:
        if os.path.exists(temp_input):
            os.remove(temp_input)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python remove_bg.py <input_image_path> <output_image_path> [model_path]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    model_path = sys.argv[3] if len(sys.argv) > 3 else None

    try:
        result = remove_background(input_path, output_path, model_path)
        print(f"SUCCESS:{result}")
    except Exception as e:
        print(f"ERROR:{str(e)}")
        sys.exit(1)
