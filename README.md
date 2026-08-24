# SLNA Fantasy PL 2026-2027

Website tĩnh theo dõi giải Classic League theo team (10 team x 4 đội FPL), dữ liệu điểm
lấy tự động mỗi giờ từ FPL API qua GitHub Actions, hiển thị bằng HTML/CSS/JS thuần trên
GitHub Pages.

## Cấu trúc

- `index.html`, `round.html`, `teams.html`, `rules.html` — các trang frontend.
- `assets/` — CSS + JS dùng chung.
- `data/teams.json` — chia đội (static, sinh 1 lần từ file CSV gốc).
- `data/scores.json`, `data/standings.json` — dữ liệu điểm/xếp hạng, được
  `scripts/fetch_scores.py` cập nhật tự động.
- `scripts/fetch_scores.py` — gọi FPL API, tính điểm league, ghi ra `data/*.json`.
- `.github/workflows/update-scores.yml` — chạy `fetch_scores.py` mỗi giờ và tự commit.

## Chạy thử local

```bash
python -m http.server 8000
```

rồi mở `http://localhost:8000`.

Cập nhật dữ liệu thủ công:

```bash
pip install -r scripts/requirements.txt
python scripts/fetch_scores.py
```

## Deploy lên GitHub Pages

1. Tạo repo GitHub mới, push toàn bộ project lên branch `main`.
2. Vào **Settings → Pages**, chọn Source = branch `main`, thư mục `/ (root)`.
3. Vào **Settings → Actions → General → Workflow permissions**, chọn "Read and write
   permissions" để workflow `update-scores.yml` có quyền commit lại `data/*.json`.
4. Sau vài phút, site sẽ có ở `https://<username>.github.io/<repo>/`.
