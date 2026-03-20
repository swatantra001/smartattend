import os
import asyncio
import numpy as np
from PIL import Image     #TODO: these two are added
from transformers import pipeline
import cv2
import structlog
from insightface.app import FaceAnalysis
from insightface.data import get_image as ins_get_image
from typing import Optional
from app.config import settings

logger = structlog.get_logger()


class FaceService:
    """
    Wraps InsightFace FaceAnalysis (ArcFace buffalo_l model).
    Handles:
      - Face detection
      - Embedding extraction (512-dim ArcFace)
      - Cosine similarity matching
      - Enrollment quality validation
    """

    def __init__(self):
        self._app: Optional[FaceAnalysis] = None
        self._lock = asyncio.Lock()

    async def initialize(self):
        """Load InsightFace model. Called once at startup."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._load_model)

    def _load_model(self):
        """Blocking model load — runs in thread pool."""
        os.makedirs(settings.MODEL_DIR, exist_ok=True)

        self._app = FaceAnalysis(
            name=settings.INSIGHTFACE_MODEL,
            root=settings.MODEL_DIR,
            providers=["CPUExecutionProvider"]
            if settings.INSIGHTFACE_CTX_ID == -1
            else ["CUDAExecutionProvider", "CPUExecutionProvider"],
        )

        # det_size: (640, 640) for best accuracy
        self._app.prepare(
            ctx_id=settings.INSIGHTFACE_CTX_ID,
            det_size=(640, 640),
        )

        # Warmup inference to JIT-compile ONNX graph
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        self._app.get(dummy)

        # 2. 🟢 NEW: Load your Custom Anti-Spoofing Model!
        # device=0 uses GPU if available, -1 uses CPU
        device_id = 0 if settings.INSIGHTFACE_CTX_ID >= 0 else -1
        self.liveness_detector = pipeline(
            "image-classification", 
            model="./models/liveness_model", 
            device=device_id
        )

        logger.info("InsightFace & Liveness models loaded successfully!")

        # logger.info(
        #     "InsightFace model loaded",
        #     model=settings.INSIGHTFACE_MODEL,
        #     device="GPU" if settings.INSIGHTFACE_CTX_ID >= 0 else "CPU",
        # )

    # ── DETECT FACES ─────────────────────────────────────────────────────────
    def _detect(self, img_bgr: np.ndarray) -> list:
        """
        Returns list of face objects from InsightFace.
        Each face has: .bbox, .det_score, .embedding, .kps
        """
        if self._app is None:
            raise RuntimeError("FaceService not initialized")
        return self._app.get(img_bgr)

    # ── EXTRACT SINGLE EMBEDDING ─────────────────────────────────────────────
    async def extract_embedding(
        self, img_bgr: np.ndarray
    ) -> tuple[Optional[np.ndarray], float, Optional[list]]:
        """
        Detect largest face and extract 512-dim ArcFace embedding.

        Returns:
            (embedding, det_score, bbox) or (None, 0.0, None) if no face
        """
        loop = asyncio.get_event_loop()

        def _run():
            faces = self._detect(img_bgr)
            if not faces:
                return None, 0.0, None

            # Pick face with highest detection score
            face = max(faces, key=lambda f: f.det_score)

            if face.det_score < settings.FACE_MIN_DETECTION_SCORE:
                return None, float(face.det_score), None

            embedding = face.embedding  # shape: (512,)
            # L2-normalize the embedding
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm

            bbox = face.bbox.tolist()  # [x1, y1, x2, y2]
            return embedding, float(face.det_score), bbox

        return await loop.run_in_executor(None, _run)

    # ── EXTRACT MULTIPLE EMBEDDINGS (enrollment) ──────────────────────────────
    async def extract_embeddings_batch(
        self, images_bgr: list[np.ndarray]
    ) -> list[tuple[Optional[np.ndarray], float]]:
        """
        Extract embeddings from multiple enrollment photos.
        Returns list of (embedding, det_score) per image.
        """
        results = []
        for img in images_bgr:
            embedding, score, _ = await self.extract_embedding(img)
            results.append((embedding, score))
        return results

    # ── COMPUTE AVERAGE EMBEDDING ─────────────────────────────────────────────
    @staticmethod
    def average_embeddings(embeddings: list[np.ndarray]) -> np.ndarray:
        """
        Average multiple embeddings and re-normalize.
        More robust than a single enrollment photo.
        """
        stacked = np.stack(embeddings, axis=0)   # (N, 512)
        avg = np.mean(stacked, axis=0)            # (512,)
        norm = np.linalg.norm(avg)
        if norm > 0:
            avg = avg / norm
        return avg

    # ── COSINE SIMILARITY ────────────────────────────────────────────────────
    @staticmethod
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        """
        Cosine similarity between two L2-normalized embeddings.
        Range: -1 to 1 (higher = more similar).
        Embeddings must already be L2-normalized.
        """
        sim = float(np.dot(a, b))
        # Clamp to [0, 1] — negative similarity means definitely different person
        return max(0.0, min(1.0, sim))

    # ── ENROLLMENT QUALITY SCORE ──────────────────────────────────────────────
    @staticmethod
    def enrollment_quality(
        embeddings: list[np.ndarray],
        det_scores: list[float],
    ) -> float:
        """
        Quality score for an enrollment batch.
        Considers:
        - Average detection score (face visibility)
        - Embedding consistency (similar poses = consistent embeddings)
        """
        if not embeddings:
            return 0.0

        avg_det = sum(det_scores) / len(det_scores)

        # Pairwise cosine similarities — high variance = bad enrollment
        sims = []
        for i in range(len(embeddings)):
            for j in range(i + 1, len(embeddings)):
                s = FaceService.cosine_similarity(embeddings[i], embeddings[j])
                sims.append(s)

        avg_consistency = sum(sims) / len(sims) if sims else 1.0

        # Quality = weighted combination
        quality = 0.5 * avg_det + 0.5 * avg_consistency
        return round(float(quality), 4)

    # ── LIVENESS FRAME VALIDATION ─────────────────────────────────────────────
    # async def validate_liveness_frame(
    #     self, img_bgr: np.ndarray
    # ) -> tuple[bool, float, Optional[list]]:
    #     """
    #     Quick check: does the frame contain a valid face?
    #     Used to validate the liveness capture before heavy processing.
    #     Returns (is_valid, det_score, bbox)
    #     """
    #     embedding, score, bbox = await self.extract_embedding(img_bgr)
    #     is_valid = embedding is not None and score >= settings.FACE_MIN_DETECTION_SCORE
    #     return is_valid, score, bbox
    # ── LIVENESS FRAME VALIDATION (UPGRADED) ──────────────────────────────────
    async def validate_liveness_frame(
        self, img_bgr: np.ndarray
    ) -> tuple[bool, float, Optional[list]]:
        """
        Gatekeeper check: 
        1. Does a face exist? 
        2. Is it a REAL 3D face, or a spoofed photo/screen?
        """
        # Step 1: Extract the face (Your existing logic)
        embedding, det_score, bbox = await self.extract_embedding(img_bgr)
        
        if embedding is None or det_score < settings.FACE_MIN_DETECTION_SCORE:
            return False, det_score, None, None
        

        # Step 2: 🟢 The Anti-Spoofing Check!
        loop = asyncio.get_event_loop()
        
        def _run_liveness():
            # Convert OpenCV BGR array to a PIL Image for Hugging Face
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(img_rgb)
            
            # Run the AI
            result = self.liveness_detector(pil_img)
            
            # HuggingFace returns a list of dicts sorted by highest score
            # Label '0' or 'LABEL_0' is our Fake/Spoof class based on the dataset
            top_prediction = result[0]
            predicted_label = str(top_prediction['label']).upper()
            
            return predicted_label, top_prediction['score']

        label, liveness_score = await loop.run_in_executor(None, _run_liveness)
        
        # If the AI says it's a Fake/Spoof (Label 0), reject the frame!
        if label in ['0', 'LABEL_0', 'FAKE', 'SPOOF']:
            logger.warning(f"🚨 SPOOF DETECTED! AI Confidence: {liveness_score:.2f}")
            return False, det_score, bbox, None # 🟢 ADDED None
            
        logger.info(f"✅ Real Face Confirmed! Liveness Score: {liveness_score:.2f}")
        return True, det_score, bbox, embedding # 🟢 ADDED embedding


# ── Singleton ─────────────────────────────────────────────────────────────────
face_service = FaceService()