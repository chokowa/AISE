import os
import uuid
import torch
import time
import soundfile as sf
from typing import List, Optional
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Field, SQLModel, create_engine, Session, select

# モデル用ライブラリ
from audiocraft.models import AudioGen
from audiocraft.data.audio import audio_write
from diffusers import StableAudioPipeline, AudioLDM2Pipeline

# --- データベース設定 ---
sqlite_file_name = "sounds.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
engine_db = create_engine(sqlite_url)

class AudioRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    engine_name: str = Field(default="audiogen") # エンジン名
    prompt: str
    duration: int
    temperature: float
    top_k: int
    top_p: float
    seed: int = Field(default=-1) # シード値
    filename: str
    created_at: datetime = Field(default_factory=datetime.now)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine_db)

# --- FastAPI 構成 ---
app = FastAPI(title="AudioGen Multi-Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("outputs", exist_ok=True)
app.mount("/audio", StaticFiles(directory="outputs"), name="audio")
# --- モデルキャッシュ管理 ---
MODELS = {
    "audiogen": None,
    "stable_audio_open": None,
    "audioldm2": None,
    "audioldm2_full": None
}

def get_audiogen():
    if MODELS["audiogen"] is None:
        print("Loading AudioGen (16kHz Mono)...")
        MODELS["audiogen"] = AudioGen.get_pretrained('facebook/audiogen-medium')
    return MODELS["audiogen"]

def get_stable_audio():
    if MODELS["stable_audio_open"] is None:
        print("Loading Stable Audio Open (48kHz Stereo)...")
        MODELS["stable_audio_open"] = StableAudioPipeline.from_pretrained(
            "stabilityai/stable-audio-open-1.0", 
            torch_dtype=torch.float16
        ).to("cuda")
    return MODELS["stable_audio_open"]

def get_audioldm2():
    if MODELS["audioldm2"] is None:
        print("Loading AudioLDM 2 (Commercial OK / Apache 2.0)...")
        MODELS["audioldm2"] = AudioLDM2Pipeline.from_pretrained(
            "cvssp/audioldm2", 
            torch_dtype=torch.float16
        ).to("cuda")
    return MODELS["audioldm2"]

def get_audioldm2_full():
    if MODELS["audioldm2_full"] is None:
        print("Loading AudioLDM 2 Full (Industrial Grade / Apache 2.0)...")
        MODELS["audioldm2_full"] = AudioLDM2Pipeline.from_pretrained(
            "cvssp/audioldm2-large", 
            torch_dtype=torch.float16
        ).to("cuda")
    return MODELS["audioldm2_full"]

# --- API エンドポイント ---

class GenerateRequest(BaseModel):
    engine: str = "audiogen" # "audiogen", "stable_audio_open", "audioldm2", or "audioldm2_full"
    prompt: str
    duration: int = 8
    temperature: float = 1.0
    top_k: int = 250
    top_p: float = 0.0
    seed: int = -1 # -1 はランダム生成

import numpy as np

def normalize_audio(audio_data, target_peak_db=-1.0):
    """
    音量を正規化してクリッピングを防ぐ。
    audio_data: numpy array
    """
    max_val = np.abs(audio_data).max()
    if max_val > 0:
        target_peak = 10 ** (target_peak_db / 20)
        return (audio_data / max_val) * target_peak
    return audio_data

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

@app.get("/history", response_model=List[AudioRecord])
def get_history():
    with Session(engine_db) as session:
        records = session.exec(select(AudioRecord).order_by(AudioRecord.created_at.desc())).all()
        return records

@app.post("/generate")
def generate(req: GenerateRequest):
    if not req.prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
        
    file_id = f"gen_{uuid.uuid4().hex}"
    final_filename = f"{file_id}.wav"
    full_path = os.path.join("outputs", final_filename)

    # シードの決定
    if req.seed is None or req.seed < 0:
        actual_seed = torch.randint(0, 2**32 - 1, (1,)).item()
    else:
        actual_seed = req.seed

    try:
        if req.engine == "audiogen":
            # AudioGen: torch.manual_seed を使用
            torch.manual_seed(actual_seed)
            model = get_audiogen()
            model.set_generation_params(
                duration=req.duration,
                temperature=req.temperature,
                top_k=req.top_k,
                top_p=req.top_p
            )
            wav = model.generate([req.prompt], progress=True)
            # AudioGen: 書き出し前の正規化
            audio_tensor = wav[0].cpu()
            max_abs = torch.abs(audio_tensor).max()
            if max_abs > 0:
                audio_tensor = audio_tensor / max_abs * 0.9 # 約 -1dB
            
            save_base = os.path.join("outputs", file_id)
            full_temp_path = audio_write(save_base, audio_tensor, model.sample_rate, strategy="peak", add_suffix=True)
            final_filename = os.path.basename(full_temp_path)

        elif req.engine == "stable_audio_open":
            pipe = get_stable_audio()
            # Generator によるシード固定
            generator = torch.Generator(device="cuda").manual_seed(actual_seed)
            output = pipe(
                prompt=req.prompt,
                negative_prompt="low quality, noise",
                audio_end_in_s=req.duration,
                num_inference_steps=100,
                guidance_scale=7.0,
                generator=generator
            )
            audio_array = output.audios[0]
            # 正規化
            audio_array = normalize_audio(audio_array.T.cpu().numpy().astype('float32'))
            sf.write(full_path, audio_array, 48000)

        elif req.engine == "audioldm2":
            pipe = get_audioldm2()
            # Generator によるシード固定
            generator = torch.Generator(device="cuda").manual_seed(actual_seed)
            output = pipe(
                prompt=req.prompt,
                audio_length_in_s=req.duration,
                num_inference_steps=50,
                guidance_scale=7.5,
                generator=generator
            )
            audio_array = output.audios[0]
            # 正規化
            audio_array = normalize_audio(audio_array)
            sf.write(full_path, audio_array, 16000)
        elif req.engine == "audioldm2_full":
            pipe = get_audioldm2_full()
            # Generator によるシード固定
            generator = torch.Generator(device="cuda").manual_seed(actual_seed)
            output = pipe(
                prompt=req.prompt,
                audio_length_in_s=req.duration,
                num_inference_steps=100,
                guidance_scale=8.0,
                generator=generator
            )
            audio_array = output.audios[0]
            # 正規化
            audio_array = normalize_audio(audio_array)
            sf.write(full_path, audio_array, 16000)

        # データベースに記録
        record = AudioRecord(
            engine_name=req.engine,
            prompt=req.prompt,
            duration=req.duration,
            temperature=req.temperature,
            top_k=req.top_k,
            top_p=req.top_p,
            seed=actual_seed,
            filename=final_filename
        )
        with Session(engine_db) as session:
            session.add(record)
            session.commit()
            session.refresh(record)
            
        return {"status": "success", "record": record}
        
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- 画像解析用：BLIP-Large (高品質・安定版) ---
from PIL import Image
from transformers import BlipProcessor, BlipForConditionalGeneration
from fastapi import UploadFile, File
import io

# 必要なときだけロード
VISION_MODELS = {"processor": None, "model": None}

def get_vision_model():
    if VISION_MODELS["model"] is None:
        print("Loading Image Analysis Engine (BLIP-Large)...")
        model_id = "Salesforce/blip-image-captioning-large"
        VISION_MODELS["processor"] = BlipProcessor.from_pretrained(model_id)
        VISION_MODELS["model"] = BlipForConditionalGeneration.from_pretrained(
            model_id, torch_dtype=torch.float16
        ).to("cuda")
    return VISION_MODELS["processor"], VISION_MODELS["model"]

def expand_to_audio_prompt(caption: str) -> str:
    """
    AIが提示した短い説明を、AudioGen/Stable Audio用のリッチな音響プロンプトに拡張。
    """
    prompt = f"Field recording of {caption}"
    
    # 状況に応じた音のディテールを自動補完
    if any(k in caption.lower() for k in ["ship", "boat", "ferry", "water", "sea", "ocean"]):
        prompt += ", vibrating engine rumble, heavy splashing water waves, metallic resonance, sea wind"
    elif any(k in caption.lower() for k in ["car", "traffic", "city", "street", "road"]):
        prompt += ", distant traffic hum, car tires on asphalt, city ambience, occasional horn"
    elif any(k in caption.lower() for k in ["forest", "tree", "bird", "park", "nature"]):
        prompt += ", rustling leaves, chirping birds, distant breeze, organic textures"
    elif any(k in caption.lower() for k in ["rain", "storm", "thunder"]):
        prompt += ", heavy rain drops on surfaces, low frequency thunder rumble, wet splash"
    
    # 品質向上タグを追加
    return f"{prompt}, immersive audio, high resolution, detailed ambience, binaural"

@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    try:
        # 画像の読み込み
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert('RGB')
        
        # モデルの準備 (Lazy Loading)
        processor, model = get_vision_model()
        
        # 解析（画像キャプション生成）
        inputs = processor(image, return_tensors="pt").to("cuda", torch.float16)
        out = model.generate(**inputs, max_new_tokens=60, num_beams=3)
        caption = processor.decode(out[0], skip_special_tokens=True)
        
        # プロンプトの拡張
        final_prompt = expand_to_audio_prompt(caption)
        
        return {"status": "success", "prompt": final_prompt}
    except Exception as e:
        print(f"Vision Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/history/{record_id}")
def delete_record(record_id: int):
    with Session(engine_db) as session:
        record = session.get(AudioRecord, record_id)
        if not record:
            raise HTTPException(status_code=404, detail="Record not found")
            
        file_path = os.path.join("outputs", record.filename)
        if os.path.exists(file_path):
            try: os.remove(file_path)
            except: pass
            
        session.delete(record)
        session.commit()
        return {"status": "deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
