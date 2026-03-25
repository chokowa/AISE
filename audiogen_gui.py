import torch
import gradio as gr
from audiocraft.models import AudioGen
from audiocraft.data.audio import audio_write
import os
import uuid

# モデルのキャッシュ
MODEL = None

def load_model():
    global MODEL
    if MODEL is None:
        print("Loading AudioGen model...")
        MODEL = AudioGen.get_pretrained('facebook/audiogen-medium')
    return MODEL

def generate_audio(text, duration, top_k, top_p, temperature):
    model = load_model()
    model.set_generation_params(
        duration=duration,
        top_k=top_k,
        top_p=top_p,
        temperature=temperature
    )
    
    print(f"Generating: {text} ({duration}s)")
    wav = model.generate([text], progress=True)
    
    # 一時ファイルとして保存
    filename = f"out_{uuid.uuid4().hex}"
    path = audio_write(filename, wav[0].cpu(), model.sample_rate, strategy="loudness", add_suffix=True)
    
    return path

# UI構成
with gr.Blocks(title="AudioGen Web UI") as demo:
    gr.Markdown("""
    # 🎵 AudioGen Web UI
    テキストから環境音や効果音を生成します。
    """)
    
    with gr.Row():
        with gr.Column():
            prompt = gr.Textbox(label="Prompt (English)", placeholder="e.g. dog barking in the distance, heavy rain on a tin roof...", lines=3)
            duration = gr.Slider(minimum=1, maximum=30, value=5, step=1, label="Duration (seconds)")
            
            with gr.Accordion("Advanced Parameters", open=False):
                top_k = gr.Number(label="Top-k", value=250)
                top_p = gr.Number(label="Top-p", value=0)
                temperature = gr.Slider(minimum=0, maximum=2, value=1.0, step=0.1, label="Temperature")
            
            generate_btn = gr.Button("Generate Sound", variant="primary")
            
        with gr.Column():
            output_audio = gr.Audio(label="Generated Audio")

    generate_btn.click(
        fn=generate_audio,
        inputs=[prompt, duration, top_k, top_p, temperature],
        outputs=output_audio
    )
    
    gr.Examples(
        examples=[
            ["heavy thunderstorm with loud thunder cracks", 10, 250, 0, 1.0],
            ["busy city street with car horns and footsteps", 5, 250, 0, 1.0],
            ["forest birds chirping in the early morning", 8, 250, 0, 1.0],
            ["typing on a mechanical keyboard", 3, 250, 0, 1.0],
        ],
        inputs=[prompt, duration, top_k, top_p, temperature]
    )

if __name__ == "__main__":
    demo.launch(inbrowser=True)
