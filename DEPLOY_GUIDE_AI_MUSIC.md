# AI Music Tool 部署清单

## 前端仓库（Vercel）
放这些文件：
- `src/`
- `index.html`
- `package.json`
- `vite.config.ts`
- `postcss.config.mjs`
- `src/styles/`
- `vercel.json`

环境变量：
- `VITE_API_BASE_URL=https://你的后端.onrender.com`

## 后端仓库（Render）
放这些文件：
- `app.py`
- `requirements.txt`
- `.python-version`
- `model_assets/a4_cnn_multilabel_best.pt`
- `model_assets/a4_label_maps_v1.json`

文件来源：
- `MyDrive/PAT564_ai_music_tool/outputs/a4_baseline/a4_cnn_multilabel_best.pt`
- `MyDrive/PAT564_ai_music_tool/data/metadata/a4_label_maps_v1.json`

Render 建议：
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
- 环境变量：
  - `PYTHON_VERSION=3.11.11`
  - `CORS_ORIGINS=https://你的前端.vercel.app`
