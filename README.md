# Web Admin ShopFood

Web admin nay dung truc tiep API tu backend `BackEnd\foodshop-api`.

## Chay local

1. Chay backend ShopFood truoc, mac dinh o `http://localhost:3000`.
2. Mo terminal tai thu muc `web_admin`.
3. Chay:

```powershell
npm start
```

4. Mo trinh duyet tai `http://localhost:4173`.

Khi frontend chay tren `localhost` hoac `127.0.0.1`, app tu dong dung API local trong `assets/config.js`:

```js
localApiBase: "http://localhost:3000"
```

## Deploy Vercel

1. Day thu muc `web_admin` len GitHub.
2. Vao Vercel -> Add New -> Project -> import repository.
3. Cau hinh project:
   - Root Directory: `web_admin` neu repo goc la `C:\DoAn_VuQuangNgan`
   - Framework Preset: `Other`
   - Build Command: de trong
   - Output Directory: `.`
   - Install Command: de trong hoac `npm install`
4. Deploy.

Khi frontend chay tren domain Vercel, app tu dong dung API production trong `assets/config.js`:

```js
productionApiBase: "https://backend-shopfood.onrender.com"
```

Neu backend doi domain, chi can sua `productionApiBase`, commit va deploy lai.

## Deploy bang Vercel CLI

```powershell
cd C:\DoAn_VuQuangNgan\web_admin
vercel
vercel --prod
```

Neu chay CLI tu repo goc, khi Vercel hoi directory thi nhap `web_admin`.

## Luu y

- Backend phai co URL public thi web tren Vercel moi goi duoc API.
- Neu backend chan CORS, them domain Vercel vao danh sach origin duoc phep.
- API base URL duoc luu rieng theo tung domain bang `localStorage`, nen deploy production khong lam hong cau hinh local.
