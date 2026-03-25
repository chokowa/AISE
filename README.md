# Multi-Engine Audio Generation Studio (AISE)

RTX 3060 (12GB VRAM) 以上のローカル環境で動作する、プロフェッショナル向け AI 音響制作スタジオです。
4つの強力な音声生成エンジンを統合しており、高品質なサウンド・エフェクト（SFX）から環境音まで、自由自在に生成・管理することが可能です。

## 🚀 主な特徴

- **4つの統合エンジン**:
  - **AudioGen**: 足音や雷など、具体的なサウンド・エフェクト（SFX）の生成。
  - **Stable Audio (Open 1.0)**: 商用利用可能な高品質・長尺オーディオの生成。
  - **AudioLDM 2 (Base)**: 汎用的な音響生成とバリエーション。
  - **AudioLDM 2 (Large/Industrial)**: 指向性の強い、プロ向けの重厚な音響制作。
- **再現性の追求 (Seed Control)**: 
  - 生成時のシード値を固定・記録。気に入った音をベースにプロンプトを微調整し、理想の音へ追い込むワークフローをサポート。
- **インテリジェント・プロンプト**: 
  - 画像解析（BLIP）機能を搭載。手持ちの画像から最適な音響プロンプトを自動生成します。
- **プロ仕様の音質制御**: 
  - 全エンジンにピーク正規化（-1.0dB）を実装。デジタル上限を超える音割れ（クリッピング）を自動的に排除します。
- **洗練されたユーザーインターフェース**: 
  - Next.js (TypeScript) を採用。リアルタイムの履歴管理と、直感的なパラメータ調整が可能なモダンなダッシュボード。

## 🛠 セットアップ手順

本システムは NVIDIA GPU（CUDA）環境での動作を前提としています。

### 1. 前提条件
- **OS**: Windows 10/11
- **GPU**: NVIDIA RTX 3060 (12GB VRAM) 以上推奨
- **Python**: 3.10.11
- **Node.js**: v18 以上

### 2. バックエンドのインストール

```bash
# リポジトリをクローン
git clone https://github.com/chokowa/AISE.git
cd AISE/AudioGen

# 仮想環境の作成
python -m venv venv
venv\Scripts\activate

# 依存パッケージのインストール
pip install -r requirements.txt
```

### 3. フロントエンドのインストール

```bash
cd audiogen-web
npm install
```

## ⚡ 起動方法

ルートディレクトリにある `launch.bat` をダブルクリックするだけで、バックエンドサーバーとフロントエンド UI が一括起動します。

```text
launch.bat
```

起動後、ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 📝 基本的な使い方

1. **エンジンの選択**: 左側のサイドバーから生成モデルを選択します。
2. **プロンプトの入力**: 生成したい音を英語で入力します（「お風呂の音」など、具体的なイメージ）。
3. **パラメータ調整**: 
   - `Duration`: 生成する秒数（10秒〜20秒程度を推奨）。
   - `Seed`: `-1` でランダム、固定値で再現生成。
4. **生成 (Generate)**: 生成された音は `outputs/` に保存され、右側の履歴パネルに表示されます。履歴をクリックすると、その時のシード値を再利用できます。

## 📜 ライセンスとクレジット

本プロジェクトは複数のオープンソースモデルを利用しています。各モデルのライセンスを遵守してご利用ください。

- **AudioLDM 2**: Apache 2.0
- **Stable Audio Open 1.0**: Stability AI Non-Commercial
- **AudioGen**: MIT (Code) / CC-BY-NC (Weights)

---
Developed by Chokowa & AI Assistant.
