#!/usr/bin/env python3
"""
AI background removal worker.
Usage: python3 rembg_worker.py <input.png> <output.png>
"""
import sys, os

input_path  = sys.argv[1]
output_path = sys.argv[2]
model = os.environ.get('REMBG_MODEL', 'isnet-general-use')

from rembg import remove, new_session
from PIL import Image

session = new_session(model)
img = Image.open(input_path).convert('RGBA')
result = remove(img, session=session)
result.save(output_path, format='PNG')
