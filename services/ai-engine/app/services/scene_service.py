
import asyncio
import json
import numpy as np
import structlog
import torch
# import torchvision.transforms as T
# from torchvision.models import mobilenet_v3_large, MobileNet_V3_Large_Weights
# 🟢 ADD THIS INSTEAD:
from transformers import ViTImageProcessor, ViTModel
from PIL import Image
from typing import Optional

from app.config import settings
from app.redis_client import get_redis

logger = structlog.get_logger()

class SceneService:
    """
    Scene/background verification using MobileNetV3-Large.
    
    Upgraded Multi-Cluster Logic:
    1. Remove face region from frame.
    2. Extract 960-dim feature vector.
    3. Store EVERY student's vector in a Redis Hash Map.
    4. Build a Pairwise Similarity Matrix to find the main classroom cluster.
    5. Flag anyone mathematically isolated from the main cluster as a proxy.
    """

    def __init__(self):
        self._model: Optional[torch.nn.Module] = None
        self._transform: Optional[T.Compose] = None
        self._device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

    async def initialize(self):
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._load_model)

    """def _load_model(self):
        logger.info("Initializing SceneService MobileNetV3...")
        weights = MobileNet_V3_Large_Weights.IMAGENET1K_V2
        model = mobilenet_v3_large(weights=weights)

        model.classifier = torch.nn.Identity()
        model.eval()
        model.to(self._device)

        self._model = model

        self._transform = T.Compose([
            T.Resize((224, 224)),
            T.ToTensor(),
            T.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
        ])

        dummy = torch.zeros(1, 3, 224, 224).to(self._device)
        with torch.no_grad():
            self._model(dummy)

        logger.info(
            "Scene model loaded successfully",
            model="MobileNetV3-Large (Feature Extractor)",
            device=str(self._device),
        )
        """
    def _load_model(self):
        logger.info("Initializing Custom ViT SceneService...")
        
        # 🟢 Load your custom fine-tuned processor and model!
        self._processor = ViTImageProcessor.from_pretrained("./models/scene_embedder")
        self._model = ViTModel.from_pretrained("./models/scene_embedder")
        
        self._model.eval()
        self._model.to(self._device)

        logger.info(
            "Custom Scene model loaded successfully",
            model="Places365-ViT (Feature Extractor)",
            device=str(self._device),
        )

    """async def extract_features(self, pil_img: Image.Image) -> np.ndarray:
        loop = asyncio.get_event_loop()

        def _run():
            tensor = self._transform(pil_img).unsqueeze(0).to(self._device)
            with torch.no_grad():
                features = self._model(tensor)
            vec = features.squeeze().cpu().numpy()
            
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            return vec.astype(np.float32)

        return await loop.run_in_executor(None, _run)
        """
    async def extract_features(self, pil_img: Image.Image) -> np.ndarray:
        loop = asyncio.get_event_loop()

        def _run():
            # The ViTProcessor handles all the 224x224 resizing and RGB normalization automatically!
            inputs = self._processor(images=pil_img, return_tensors="pt").to(self._device)
            
            with torch.no_grad():
                outputs = self._model(**inputs)
                
            # 🟢 Grab the [CLS] token (the 768-dimensional spatial map of the room)
            vec = outputs.last_hidden_state[0, 0, :].cpu().numpy()
            
            # L2 Normalize the vector so your Redis cosine similarity works perfectly
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            return vec.astype(np.float32)

        return await loop.run_in_executor(None, _run)

    @staticmethod
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        sim = float(np.dot(a, b))
        return max(0.0, min(1.0, sim))

    # ── 1. SAVE INDIVIDUAL VECTOR ─────────────────────────────────────────────
    async def save_student_vector(self, session_id: str, student_id: str, vector: np.ndarray):
        """Saves the student's background signature in a Redis Hash Map for this session."""
        redis = get_redis()
        key = f"scene_vectors:{session_id}"
        await redis.hset(key, student_id, json.dumps(vector.tolist()))
        await redis.expire(key, 7200) # Expire after 2 hours

    # ── 2. CROWD CONSENSUS & OUTLIER DETECTION (The Magic) ────────────────────
    async def evaluate_crowd(self, session_id: str) -> dict:
        """
        Builds a Pairwise Similarity Matrix of all students.
        Finds the main classroom cluster and identifies hostel outliers.
        """
        try:
            redis = get_redis()
            key = f"scene_vectors:{session_id}"
            
            # Because your redis uses decode_responses=True, this is a dict of STRINGS
            raw_data = await redis.hgetall(key)

            if not raw_data or len(raw_data) < 4:
                # Not enough students to form a mathematical consensus yet. Give benefit of doubt.
                return {"outliers": [], "scores": {}}

            students = []
            vectors = []
            
            for sid_str, vec_str in raw_data.items():
                students.append(sid_str)
                vectors.append(np.array(json.loads(vec_str), dtype=np.float32))

            # Calculate how many "Peers" each student has in the background space
            threshold = 0.70 # Similarity required to be in the same room angle
            peer_counts = []
            
            for i in range(len(vectors)):
                peers = 0
                for j in range(len(vectors)):
                    if i != j:
                        if self.cosine_similarity(vectors[i], vectors[j]) >= threshold:
                            peers += 1
                peer_counts.append(peers)

            max_peers = max(peer_counts) if peer_counts else 0
            outliers = []
            scores = {}

            # If the largest cluster has at least 2 people, it is the true "Classroom"
            if max_peers >= 2:
                for i, count in enumerate(peer_counts):
                    # Calculate a dynamic score based on connection to the crowd
                    score = count / max_peers 
                    scores[students[i]] = round(score, 4)
                    
                    # If a student has practically no peers compared to the main crowd -> Hostel!
                    if count <= (max_peers * 0.25) and count < 2:
                        outliers.append(students[i])
            else:
                # Total chaos, everyone is in different locations (online class?)
                for s in students: scores[s] = 1.0

            logger.info(f"[SCENE CONSENSUS] Session {session_id} evaluated. Outliers found: {len(outliers)}")
            return {"outliers": outliers, "scores": scores}

        except Exception as e:
            logger.error(f"[SCENE CONSENSUS ERROR] Failed to evaluate crowd: {str(e)}", exc_info=True)
            # Fail open gracefully so Node.js doesn't crash
            return {"outliers": [], "scores": {}}


# ── Singleton ─────────────────────────────────────────────────────────────────
scene_service = SceneService()