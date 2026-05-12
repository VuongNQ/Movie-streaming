# Movie-streaming

Repository gồm 2 ứng dụng:

## 1) Android app (`/android-app`)

- Viết bằng Kotlin (module `android-core`)
- Mô hình dữ liệu phim theo danh mục/tag, link stream m3u8/hls
- Đăng nhập username/password đơn giản
- Theo dõi phim đã xem theo user
- Hỗ trợ lọc phim theo category/tag
- Hỗ trợ load-more/pagination và refresh data
- Có logic kiểm tra highlight update + force update theo version policy
- Có logic chọn link stream nhanh nhất theo thời gian phản hồi
- Có contract repository để tích hợp Firestore

### Chạy test Android core

```bash
cd /home/runner/work/Movie-streaming/Movie-streaming/android-app
./gradlew test
```

## 2) Manager app (`/manager-app`)

- Tauri desktop app
- FE: React + React Router + Tailwind + React Query
- BE: Rust (Tauri commands)
- Đăng nhập Google OAuth (`@react-oauth/google`)
- Kết nối Firestore để quản lý:
  - Danh mục phim
  - Tag phim
  - Movie metadata (title, description, thumbnail, stream link, subtitle)
  - Chính sách version Android (latest/force/highlight)
  - User + lịch sử xem

### Chạy manager app

```bash
cd /home/runner/work/Movie-streaming/Movie-streaming/manager-app
npm install
npm run build
npm run dev
```

> Đặt các biến môi trường Firebase/Google OAuth trong `.env` của `manager-app`:
>
> - `VITE_FIREBASE_API_KEY`
> - `VITE_FIREBASE_AUTH_DOMAIN`
> - `VITE_FIREBASE_PROJECT_ID`
> - `VITE_GOOGLE_CLIENT_ID`
