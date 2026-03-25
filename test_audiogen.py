import torch
from audiocraft.models import AudioGen
from audiocraft.data.audio import audio_write
import time

def generate_environment_sound():
    print(f"CUDA status: {'Available' if torch.cuda.is_available() else 'Not Available'}")
    if torch.cuda.is_available():
        print(f"Current Device: {torch.cuda.get_device_name(0)}")

    print("Loading AudioGen model (facebook/audiogen-medium)...")
    try:
        model = AudioGen.get_pretrained('facebook/audiogen-medium')
        model.set_generation_params(duration=10)
        
        descriptions = ['gentle sea waves hitting the shore calmly']
        
        print(f"Generating audio for: {descriptions[0]}")
        start_time = time.time()
        
        # 実際に生成実行
        wav = model.generate(descriptions)
        
        end_time = time.time()
        print(f"Generation completed in {end_time - start_time:.2f} seconds.")

        # ファイル書き出し
        output_filename = 'waves_test'
        audio_write(output_filename, wav[0].cpu(), model.sample_rate, strategy="loudness")
        print(f"Audio saved to {output_filename}.wav")
        
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    generate_environment_sound()
