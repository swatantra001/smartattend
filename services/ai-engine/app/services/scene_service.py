# import asyncio
# import json
# import numpy as np
# import structlog
# import torch
# import torchvision.transforms as T
# from torchvision.models import mobilenet_v3_large, MobileNet_V3_Large_Weights
# from PIL import Image
# from typing import Optional

# from app.config import settings
# from app.redis_client import get_redis, scene_baseline_key, scene_count_key

# logger = structlog.get_logger()


# class SceneService:
#     """
#     Scene/background verification using MobileNetV3-Large.

#     How it works:
#     1. Remove face region from frame (so features come from background)
#     2. Extract 960-dim feature vector from MobileNetV3 penultimate layer
#     3. Accumulate vectors from verified students → compute baseline
#     4. Compare each student's background to baseline via cosine similarity
#     5. Below threshold → suspicious (flag for professor, not auto-reject)
#     """

#     def __init__(self):
#         self._model: Optional[torch.nn.Module] = None
#         self._transform: Optional[T.Compose] = None
#         self._device = torch.device(
#             "cuda" if torch.cuda.is_available() else "cpu"
#         )

#     async def initialize(self):
#         loop = asyncio.get_event_loop()
#         await loop.run_in_executor(None, self._load_model)

#     def _load_model(self):
#         """Load MobileNetV3-Large, strip classifier, keep feature extractor."""
#         weights = MobileNet_V3_Large_Weights.IMAGENET1K_V2
#         model = mobilenet_v3_large(weights=weights)

#         # Remove the final classifier — keep features layer (960-dim output)
#         # MobileNetV3 architecture: features → avgpool → classifier
#         # We use output of avgpool = 960-dim
#         model.classifier = torch.nn.Identity()
#         model.eval()
#         model.to(self._device)

#         self._model = model

#         # Standard ImageNet normalization
#         self._transform = T.Compose([
#             T.Resize((224, 224)),
#             T.ToTensor(),
#             T.Normalize(
#                 mean=[0.485, 0.456, 0.406],
#                 std=[0.229, 0.224, 0.225]
#             ),
#         ])

#         # Warmup
#         dummy = torch.zeros(1, 3, 224, 224).to(self._device)
#         with torch.no_grad():
#             self._model(dummy)

#         logger.info(
#             "Scene model loaded",
#             model="MobileNetV3-Large",
#             device=str(self._device),
#         )

#     # ── EXTRACT SCENE FEATURES ────────────────────────────────────────────────
#     async def extract_features(
#         self, pil_img: Image.Image
#     ) -> np.ndarray:
#         """
#         Extract 960-dim background feature vector.
#         Input: PIL RGB image with face region already blacked out.
#         Returns: L2-normalized numpy array (960,)
#         """
#         loop = asyncio.get_event_loop()

#         def _run():
#             tensor = self._transform(pil_img).unsqueeze(0).to(self._device)
#             with torch.no_grad():
#                 features = self._model(tensor)
#             vec = features.squeeze().cpu().numpy()  # (960,)
#             # L2 normalize
#             norm = np.linalg.norm(vec)
#             if norm > 0:
#                 vec = vec / norm
#             return vec.astype(np.float32)

#         return await loop.run_in_executor(None, _run)

#     # ── COSINE SIMILARITY ─────────────────────────────────────────────────────
#     @staticmethod
#     def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
#         sim = float(np.dot(a, b))
#         return max(0.0, min(1.0, sim))

#     # ── UPDATE BASELINE ───────────────────────────────────────────────────────
#     async def update_baseline(
#         self, session_id: str, new_vector: np.ndarray
#     ) -> int:
#         """
#         Add a new scene vector to the running average baseline.
#         Returns current sample count.
#         Stored in Redis as JSON array for fast access.
#         """
#         redis = get_redis()
#         baseline_key = scene_baseline_key(session_id)
#         count_key = scene_count_key(session_id)

#         # Atomic increment count
#         count = await redis.incr(count_key)
#         await redis.expire(count_key, 7200)  # 2hr TTL

#         if count == 1:
#             # First sample — just store it
#             await redis.set(
#                 baseline_key,
#                 json.dumps(new_vector.tolist()),
#                 ex=7200
#             )
#         else:
#             # Running average: new_avg = old_avg + (new - old_avg) / count
#             existing_json = await redis.get(baseline_key)
#             if existing_json:
#                 old_avg = np.array(json.loads(existing_json), dtype=np.float32)
#                 new_avg = old_avg + (new_vector - old_avg) / count
#                 # Re-normalize
#                 norm = np.linalg.norm(new_avg)
#                 if norm > 0:
#                     new_avg = new_avg / norm
#                 await redis.set(
#                     baseline_key,
#                     json.dumps(new_avg.tolist()),
#                     ex=7200
#                 )

#         return count

#     # ── GET BASELINE ──────────────────────────────────────────────────────────
#     async def get_baseline(
#         self, session_id: str
#     ) -> tuple[Optional[np.ndarray], int]:
#         """
#         Returns (baseline_vector, sample_count) for a session.
#         Returns (None, 0) if no baseline yet.
#         """
#         redis = get_redis()

#         baseline_json = await redis.get(scene_baseline_key(session_id))
#         count_str = await redis.get(scene_count_key(session_id))

#         count = int(count_str) if count_str else 0

#         if not baseline_json or count == 0:
#             return None, 0

#         baseline = np.array(json.loads(baseline_json), dtype=np.float32)
#         return baseline, count

#     # ── COMPUTE SCENE SCORE ───────────────────────────────────────────────────
#     async def compute_scene_score(
#         self,
#         session_id: str,
#         student_vector: np.ndarray,
#     ) -> tuple[float, bool]:
#         """
#         Compare student's background to session baseline.

#         Returns:
#             (scene_score, is_suspicious)
#             - scene_score: cosine similarity 0-1
#             - is_suspicious: True if below threshold
#         """
#         baseline, count = await self.get_baseline(session_id)

#         # Not enough samples yet — give benefit of doubt
#         if baseline is None or count < settings.SCENE_MIN_SAMPLES:
#             return 1.0, False

#         score = self.cosine_similarity(student_vector, baseline)

#         # Lower threshold for small classes
#         threshold = settings.SCENE_MATCH_THRESHOLD
#         if count < 10:
#             threshold = max(0.45, threshold - 0.10)

#         is_suspicious = score < threshold
#         return round(float(score), 4), is_suspicious


# # ── Singleton ─────────────────────────────────────────────────────────────────
# scene_service = SceneService()



















import asyncio
import json
import numpy as np
import structlog
import torch
import torchvision.transforms as T
from torchvision.models import mobilenet_v3_large, MobileNet_V3_Large_Weights
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

    def _load_model(self):
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

    async def extract_features(self, pil_img: Image.Image) -> np.ndarray:
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