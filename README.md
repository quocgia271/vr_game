# VR Color Circle — Đồ án VR

WebXR + [A-Frame 1.6](https://aframe.io/): phân loại màu theo 3 cấp (Primary / Secondary / Tertiary), gắn bi vào đúng vị trí trên bánh xe 12 màu.

## Chạy demo

1. Mở thư mục project trong HTTP server (bắt buộc vì trình duyệt chặn `file://` cho một số API).

   ```bash
   npx --yes serve . -p 8080
   ```

2. Truy cập `http://localhost:8080` (máy tính) hoặc `https://<IP-máy>:8080` (Meta Quest cùng mạng LAN).

3. **Meta Quest Browser**: WebXR thường yêu cầu **HTTPS**. Cách nhanh:

   - Dùng [ngrok](https://ngrok.com/) hoặc `mkcert` + proxy HTTPS trỏ tới cổng 8080, rồi mở URL HTTPS trên kính; hoặc
   - Phát triển trên PC, bấm **Vào VR** khi đã có chứng chỉ hợp lệ.

4. **Âm thanh**: nhấp vào màn hình một lần (hoặc **Bắt đầu**) để trình duyệt bật AudioContext.

### Test trên web (máy tính, không cần kính)

- Chạy `npx --yes serve . -p 8080`, mở `http://localhost:8080`.
- Dùng chuột **kéo nhìn** (click giữ + di) để xoay camera, **nhìn thẳng vào bi** rồi **giữ chuột trái** trên bi để “cầm”, **thả** gần ô sáng trên vòng để gắn.
- Đây là chế độ **2D màn hình**; nút **Vào VR** chỉ hữu ích khi có headset / trình duyệt hỗ trợ WebXR.

### Vật lý (Cannon / aframe-physics-system)

- **Hiện tắt:** bản `aframe-physics-system` 4.x **không tương thích** A-Frame 1.6 + Three.js r164 (lỗi `getMaterial`, driver). Game dùng **snap theo khoảng cách** ngay khi thả chuột — ổn định, nhẹ.
- Nếu sau này có fork physics tương thích, có thể bật lại và nối `releaseBall` / `dynamic-body`.

## Điều khiển

- **Desktop**: nhìn bi → giữ / thả chuột trái để gắn vào vòng (ô sáng là ô đang cần cho cấp hiện tại).
- **VR**: tia tay + trigger cầm / thả bi.
- **Trong kính**: dùng nút 3D **Bắt đầu** / **Chế độ** nếu không bấm được panel HTML.

## Cấu trúc mã

- `index.html` — scene A-Frame, UI 2D + menu VR.
- `js/colors.js` — thứ tự 12 màu trên vòng và cấu hình 3 level.
- `js/game.js` — logic cấp, bắt / thả, snap, timer Hard.
- `js/audio.js` — nhạc nền và SFX (Web Audio, không cần file ngoài).
- `assets/wheel-reference.png` — ảnh tham chiếu đề.

