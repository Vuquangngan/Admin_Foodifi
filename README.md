# Web Admin ShopFood

Web admin này được đặt tại `C:\DoAn_VuQuangNgan\Web_Admin` và dùng trực tiếp API từ backend `BackEnd\foodshop-api`.

## Chạy nhanh

1. Chạy backend ShopFood trước, mặc định ở `http://localhost:3000`.
2. Mở terminal tại thư mục này.
3. Chạy:

```powershell
node server.js
```

4. Mở trình duyệt tại `http://localhost:4173`.

## Chức năng hiện có

- Đăng nhập admin hoặc staff bằng JWT.
- Dashboard tổng quan.
- Quản lý danh mục.
- Quản lý sản phẩm.
- Theo dõi và cập nhật trạng thái đơn hàng phổ biến.

## Ghi chú

- Nếu backend không chạy ở cổng `3000`, đổi `API base URL` ngay tại màn hình đăng nhập.
- Frontend này không dùng thư viện ngoài, nên có thể chạy ngay không cần `npm install`.
