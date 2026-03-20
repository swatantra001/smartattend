import torch
import numpy as np
from fastapi import APIRouter
from sentence_transformers import SentenceTransformer
from transformers import AutoModel, AutoTokenizer, AutoModelForCausalLM, pipeline
from sklearn.cluster import AgglomerativeClustering
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import normalize
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/assignments", tags=["Assignments"])

# ─── GLOBAL PROGRESS TRACKER ──────────────────────────────────────────────────
# This stores the real-time progress of any assignment currently evaluating
evaluation_progress = {}

# ─── PRE-LOAD MODELS ──────────────────────────────────────────────────────────
# sbert_model = SentenceTransformer('all-mpnet-base-v2')
# 🟢 NEW: Powered by your PAWS-Trained Plagiarism Catcher!
sbert_model = SentenceTransformer('./models/text_embedder')
unixcoder_tokenizer = AutoTokenizer.from_pretrained("microsoft/unixcoder-base")
unixcoder_model = AutoModel.from_pretrained("microsoft/unixcoder-base")
# 🟢 UPDATE: Point to the extracted folder
# This model now replaces BOTH Unixcoder and the generic SBERT for code tasks
ast_model = SentenceTransformer('./models/ast_god_mode')
# roberta_ai_detector = pipeline("text-classification", model="roberta-base-openai-detector")
# 🟢 FIX: Upgraded to a model trained on modern LLM outputs!
# roberta_ai_detector = pipeline("text-classification", model="Hello-SimpleAI/chatgpt-detector-roberta")
# 🟢 NEW: Powered by Swatantra's Custom RoBERTa Model!
roberta_ai_detector = pipeline("text-classification", model="./models/ai_detector")
codegen_tokenizer = AutoTokenizer.from_pretrained("Salesforce/codegen-350M-mono")
codegen_model = AutoModelForCausalLM.from_pretrained("Salesforce/codegen-350M-mono") # codgen_ were replace by ai_code_detector
#🟢 NEW: Powered by your Custom CodeBERT Model (Programming Files)
code_ai_detector = pipeline("text-classification", model="./models/ai_code_detector")

class Submission(BaseModel):
    id: str
    text_content: Optional[str] = ""
    code_content: Optional[str] = ""
    timestamp: str

class EvaluationPayload(BaseModel):
    assignment_id: str # 🟢 NEW: Required to track progress
    submissions: List[Submission]

# def get_code_embedding(code_string: str) -> np.ndarray:
#     if not code_string.strip():
#         return np.zeros(768)
#     tokens = unixcoder_tokenizer(code_string, return_tensors="pt", max_length=512, truncation=True)
#     with torch.no_grad():
#         output = unixcoder_model(**tokens)
#     # Extract CLS token and flatten
#     return output.last_hidden_state[0][0].numpy()
def get_code_embedding(code_string: str) -> np.ndarray:
    if not code_string.strip():
        return np.zeros(768)
    
    # Your God-Mode model converts raw code into an AST-aware vector
    with torch.no_grad():
        # normalize=True ensures the cosine similarity works perfectly later
        return ast_model.encode(code_string, normalize_embeddings=True)

def calculate_perplexity(code_string: str) -> float:
    if not code_string.strip(): return 0.0
    encodings = codegen_tokenizer(code_string, return_tensors="pt", truncation=True, max_length=512)
    max_length = codegen_model.config.n_positions
    stride = 256
    nlls = []
    
    for i in range(0, encodings.input_ids.size(1), stride):
        begin_loc = max(i + stride - max_length, 0)
        end_loc = min(i + stride, encodings.input_ids.size(1))
        trg_len = end_loc - i
        input_ids = encodings.input_ids[:, begin_loc:end_loc]
        target_ids = input_ids.clone()
        target_ids[:, :-trg_len] = -100

        with torch.no_grad():
            outputs = codegen_model(input_ids, labels=target_ids)
            nlls.append(outputs.loss)

    if not nlls: return 0.0
    return torch.exp(torch.stack(nlls).mean()).item()


# 1. 🟢 NEW: Mean-Pooling Embedding (Evaluates 100% of the Document)
def get_document_embedding(text: str, assignment_id: str = None, start_pct: float = 0, end_pct: float = 0) -> np.ndarray:
    if not text.strip():
        return np.zeros(768)
    
    chunk_size = 1500 
    chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
    
    chunk_embeddings = []
    # Loop through chunks to provide micro-progress updates!
    for j, chunk in enumerate(chunks):
        chunk_embeddings.append(sbert_model.encode(chunk))
        if assignment_id:
            current_pct = start_pct + ((j + 1) / len(chunks)) * (end_pct - start_pct)
            evaluation_progress[assignment_id] = int(current_pct)
            
    return np.mean(chunk_embeddings, axis=0)


def get_ai_probability_chunked(text: str, assignment_id: str = None, start_pct: float = 0, end_pct: float = 0) -> float:
    if not text or len(text) < 50:
        return 0.0
    
    words = text.split()
    chunk_size = 200
    chunks = [' '.join(words[i : i + chunk_size]) for i in range(0, len(words), chunk_size)]
    
    ai_scores = []
    for j, chunk in enumerate(chunks):
        if len(chunk.split()) < 20: 
            continue
        try:
            det = roberta_ai_detector(chunk, truncation=True, max_length=512)[0]
            label = str(det['label']).lower()
            score = det['score']
            
            # print(f"--- CHUNK {j+1}/{len(chunks)} --- PREDICTION: {label} ({score})")
            
            if label in ['chatgpt', 'fake', 'label_1', '1', 'ai', 'machine']:
                ai_scores.append(score)
            else:
                ai_scores.append(1.0 - score)
        except Exception:
            continue
            
        # 🟢 MICRO-PROGRESS UPDATE!
        if assignment_id:
            current_pct = start_pct + ((j + 1) / len(chunks)) * (end_pct - start_pct)
            evaluation_progress[assignment_id] = int(current_pct)
            
    final_score = max(ai_scores) if ai_scores else 0.0
    print(f"👉 FINAL AI SCORE: {final_score}\n")
    return final_score


def get_code_ai_probability_chunked(code_string: str) -> float:
    if not code_string or len(code_string) < 20:
        return 0.0
    
    # Split code by lines to maintain logical syntax chunks
    lines = code_string.split('\n')
    chunk_size = 50 # 50 lines of code at a time
    chunks = ['\n'.join(lines[i : i + chunk_size]) for i in range(0, len(lines), chunk_size)]
    
    ai_scores = []
    for chunk in chunks:
        if len(chunk.strip()) < 10: 
            continue
        try:
            # Pass the chunk to your newly trained model!
            det = code_ai_detector(chunk, truncation=True, max_length=512)[0]
            label = str(det['label']).lower()
            score = det['score']
            
            # Label 1 is AI, Label 0 is Human (based on our Kaggle training)
            if label in ['label_1', '1', 'ai']:
                ai_scores.append(score)
            else:
                ai_scores.append(1.0 - score)
        except Exception:
            continue
            
    # Return the highest probability found in the code file
    final_score = max(ai_scores) if ai_scores else 0.0
    print(f"👉 FINAL CODE AI SCORE: {final_score}\n")
    return final_score


# 🟢 NEW: Route to check progress
@router.get("/progress/{assignment_id}")
async def check_progress(assignment_id: str):
    return {"progress": evaluation_progress.get(assignment_id, 0)}

# ─── HYBRID CLUSTERING ALGORITHM ──────────────────────────────────────────────
@router.post("/evaluate")
def evaluate_assignments(payload: EvaluationPayload):
    # 🟢 FIX 1: Extract the assignment_id and total_subs right here!
    assignment_id = payload.assignment_id
    submissions = [s.dict() for s in payload.submissions]
    total_subs = len(submissions)
    
    # We need at least 2 submissions to find copying!
    if len(submissions) < 2: 
        return {"status": "success", "clusters": []}
    
    combined_texts = []
    dense_vectors = []

    ai_scores = {}
    # 1. Feature Extraction (Dense & Sparse Prep)
    for i, sub in enumerate(submissions):
        # Calculate the progress slice for this specific student
        base_pct = (i / total_subs) * 90
        next_pct = ((i + 1) / total_subs) * 90
        slice_size = next_pct - base_pct
        
        # Give 30% of the time to semantic embeddings, and 70% to AI detection
        embed_end_pct = base_pct + (slice_size * 0.3)
        ai_end_pct = base_pct + (slice_size * 1.0)
        
        text_data = (sub.get('text_content') or "").strip()
        code_data = (sub.get('code_content') or "").strip()
        
        # Combine text and code for the Sparse Lexical pass
        combined_texts.append(text_data + " \n " + code_data)
        
       # 🟢 Pass the progress windows into the heavy lifters!
        t_vec = get_document_embedding(text_data, assignment_id, base_pct, embed_end_pct)
        c_vec = get_code_embedding(code_data) if code_data else np.zeros(768)
        
        # Concatenate and L2 Normalize the dense vectors
        raw_combined = np.hstack((t_vec, c_vec))
        norm_combined = normalize([raw_combined], norm='l2')[0]
        dense_vectors.append(norm_combined)

        # 🟢 NEW: Calculate AI generation probability for EVERY student
        ai_prob = 0.0
        
        if len(text_data) > 100:
            # Send the ENTIRE document to the chunker!
            ai_prob = get_ai_probability_chunked(text_data)
                
        if len(code_data) > 10: #TODO: elif
            # ppl = calculate_perplexity(code_data)
            code_ai_prob = get_code_ai_probability_chunked(code_data)
            # ai_prob = max(0.0, min(1.0, (2.5 - ppl) / 1.0))
            ai_prob = max(ai_prob, code_ai_prob)

            # 🟢 Route it straight to your custom AI Code Detector!
            #ai_prob = get_code_ai_probability_chunked(code_data)
            
        ai_scores[sub['id']] = round(ai_prob, 4)

        # Ensure we hit the exact target before moving to the next student
        evaluation_progress[assignment_id] = int(next_pct)

    dense_matrix = np.array(dense_vectors)

    # 2. Compute Dense Similarity Matrix
    S_dense = cosine_similarity(dense_matrix)

    # 3. Compute Sparse Lexical Matrix (N-grams)
    # This catches copy-pasting even if words are scrambled
    vectorizer = TfidfVectorizer(ngram_range=(1, 3), stop_words='english')
    try:
        sparse_matrix = vectorizer.fit_transform(combined_texts)
        S_sparse = cosine_similarity(sparse_matrix)
    except ValueError:
        # Failsafe if all texts are completely empty
        S_sparse = np.zeros_like(S_dense)

    # 4. Matrix Fusion (The Core Mathematical Model)
    # Alpha = 0.6 means we weigh semantic meaning slightly heavier than exact wording
    alpha = 0.6
    S_final = (alpha * S_dense) + ((1 - alpha) * S_sparse)

    # Convert Similarity to Distance (Ensure no negative values due to floating point math)
    Distance_Matrix = np.clip(1.0 - S_final, 0.0, 1.0)

    # 5. Agglomerative Clustering on the precomputed distance matrix
    # distance_threshold of 0.15 means they must be 85% identical across BOTH metrics to cluster
    clustering = AgglomerativeClustering(
        n_clusters=None, 
        metric='precomputed', 
        linkage='average', 
        distance_threshold=0.15
    )
    labels = clustering.fit_predict(Distance_Matrix)
    
    # Group by labels
    temp_clusters = {}
    for idx, label in enumerate(labels):
        temp_clusters.setdefault(label, []).append((submissions[idx], idx))
        
    results = []
    for cluster_id, items in temp_clusters.items():
        # 🟢 CRITICAL FIX: Ignore "clusters" of 1 person. 
        # Someone cannot copy themselves!
        if len(items) < 2:
            continue
            
        # Sort by timestamp to find the "Leader" (the original source)
        items.sort(key=lambda x: x[0]['timestamp'])
        cluster_subs = [x[0] for x in items]
        leader = cluster_subs[0]
        
        # Calculate the internal cluster cohesion (Average match probability)
        indices = [x[1] for x in items]
        sub_matrix = S_final[np.ix_(indices, indices)]
        # Average of upper triangle gives the average similarity of the copying ring
        match_prob = float(np.mean(sub_matrix[np.triu_indices(len(indices), k=1)]))
        
       # 🟢 FIX: We DELETED the old broken logic and just grab the pre-calculated score!
        ai_prob = ai_scores.get(leader['id'], 0.0)

        results.append({
            "leader_submission_id": leader['id'],
            # We pass the calculated mathematical similarity score to the frontend!
            "ai_generated_probability": round(match_prob, 4), 
            "copied_submission_ids": [s['id'] for s in cluster_subs[1:]]
        })
    # 100% Complete!
    evaluation_progress[assignment_id] = 100
    return {"status": "success", "clusters": results, "ai_scores": ai_scores}