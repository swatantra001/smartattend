import asyncio
import requests
from PIL import Image
from io import BytesIO
import numpy as np

# Import your shiny new ViT service
from app.services.scene_service import scene_service

async def run_proxy_test():
    print("🚀 Booting up the ViT Proxy Detection Test (Live URL Mode)...\n")
    
    # Initialize your custom Places365 model
    await scene_service.initialize()

    # Using Unsplash images - their servers do not block Python scripts!
    urls = {
        "Lecture_Hall_1": "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=640",
        "Lecture_Hall_2": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=640",
        "Hostel_Proxy": "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=640"
    }

    vectors = {}
    for name, url in urls.items():
        print(f"📸 Downloading & Extracting 768-dim features for {name}...")
        
        # Simple request, no fake headers needed for Unsplash
        response = requests.get(url)
        
        # 🟢 THE FIX: This ensures we actually got a 200 OK before trying to open it!
        response.raise_for_status()
        
        img = Image.open(BytesIO(response.content)).convert("RGB")
        
        # Extract the ViT brainwave
        vec = await scene_service.extract_features(img)
        vectors[name] = vec

    print("\n📊 --- PAIRWISE SIMILARITY MATRIX ---")
    names = list(vectors.keys())
    
    # Compare everyone to everyone else
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            # Calculate Cosine Similarity between the two rooms
            sim = scene_service.cosine_similarity(vectors[names[i]], vectors[names[j]])
            print(f"   {names[i]}  vs  {names[j]}:  {sim:.4f}")

    print("\n🚨 EXPECTED CONCLUSION:")
    print("1. The two Lecture Hall images should have a high similarity score.")
    print("2. The Hostel Proxy should have a drastically lower score when compared to the lecture halls.")

if __name__ == "__main__":
    asyncio.run(run_proxy_test())