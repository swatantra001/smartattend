import base64
import io
import numpy as np
import cv2
from PIL import Image


def base64_to_numpy(b64_string: str) -> np.ndarray:
    """Decode base64 JPEG/PNG → OpenCV BGR numpy array."""
    # Strip data URL prefix if present
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]

    img_bytes = base64.b64decode(b64_string)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Failed to decode image from base64")

    return img


def numpy_to_base64(img: np.ndarray, quality: int = 85) -> str:
    """Convert OpenCV BGR numpy array → base64 JPEG string."""
    success, buffer = cv2.imencode(
        ".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality]
    )
    if not success:
        raise ValueError("Failed to encode image to JPEG")
    return base64.b64encode(buffer).decode("utf-8")


def pil_to_numpy(pil_img: Image.Image) -> np.ndarray:
    """Convert PIL RGB → OpenCV BGR numpy array."""
    rgb = np.array(pil_img)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def numpy_to_pil(img: np.ndarray) -> Image.Image:
    """Convert OpenCV BGR → PIL RGB image."""
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def resize_for_display(img: np.ndarray, max_dim: int = 640) -> np.ndarray:
    """Resize image keeping aspect ratio — used for thumbnail generation."""
    h, w = img.shape[:2]
    if max(h, w) <= max_dim:
        return img
    scale = max_dim / max(h, w)
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def remove_face_region(
    img: np.ndarray,
    bbox: list[float],
    padding_ratio: float = 0.3
) -> np.ndarray:
    """
    Black out the face region in an image for scene feature extraction.
    This ensures scene features come from background, not face.
    bbox: [x1, y1, x2, y2] in pixel coords
    """
    img_copy = img.copy()
    h, w = img_copy.shape[:2]

    x1, y1, x2, y2 = [int(v) for v in bbox]

    # Add padding around face box
    pad_x = int((x2 - x1) * padding_ratio)
    pad_y = int((y2 - y1) * padding_ratio)

    x1 = max(0, x1 - pad_x)
    y1 = max(0, y1 - pad_y)
    x2 = min(w, x2 + pad_x)
    y2 = min(h, y2 + pad_y)

    # Black out face region
    img_copy[y1:y2, x1:x2] = 0

    return img_copy