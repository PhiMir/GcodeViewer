# GitHub Pages 배포 가이드

## 🚀 빠른 배포 (5분 완성)

### 1단계: GitHub 저장소 생성
```bash
# 프로젝트 폴더에서
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/gcode-3d-viewer.git
git push -u origin main
```

### 2단계: GitHub Pages 설정
1. GitHub 저장소 페이지에서 **Settings** 클릭
2. 왼쪽 메뉴에서 **Pages** 선택
3. **Source**를 **GitHub Actions**로 변경
4. 저장!

### 3단계: 자동 배포 확인
- main 브랜치에 푸시하면 자동으로 배포됨
- **Actions** 탭에서 배포 진행 상황 확인
- 완료되면 `https://yourusername.github.io/gcode-3d-viewer/` 에서 확인

---

## ⚙️ 저장소 이름이 다른 경우

만약 저장소 이름을 `my-gcode-viewer`로 만들었다면:

**vite.config.js 수정:**
```javascript
base: process.env.NODE_ENV === 'production' ? '/my-gcode-viewer/' : './',
```

저장소 이름과 base 경로가 **반드시 일치**해야 합니다!

---

## 🔧 문제 해결

### 페이지가 404 에러
- Settings → Pages에서 Source가 "GitHub Actions"인지 확인
- Actions 탭에서 배포가 성공했는지 확인
- vite.config.js의 base 경로가 저장소 이름과 일치하는지 확인

### CSS/JS 파일이 안 로드됨
- vite.config.js의 base 경로를 다시 확인
- 저장소 이름: `gcode-3d-viewer`
- base 경로: `/gcode-3d-viewer/`
- **슬래시(/) 위치가 정확해야 함!**

### 캐싱 문제
- 브라우저 캐시 삭제 (Ctrl + Shift + R 또는 Cmd + Shift + R)
- 시크릿 모드에서 테스트

---

## 📦 수동 배포 방법 (대안)

GitHub Actions를 사용하지 않고 수동으로 배포:

```bash
# 1. gh-pages 패키지 설치 (이미 포함됨)
npm install

# 2. 빌드 및 배포
npm run deploy
```

이 방법은 gh-pages 브랜치를 자동으로 생성하고 배포합니다.
Settings → Pages에서 Source를 "Deploy from a branch"로 설정하고
Branch를 "gh-pages"로 선택하세요.

---

## ✅ 배포 완료 체크리스트

- [ ] GitHub 저장소 생성 및 코드 푸시
- [ ] Settings → Pages → Source를 "GitHub Actions"로 설정
- [ ] vite.config.js의 base 경로 확인
- [ ] Actions 탭에서 배포 성공 확인
- [ ] 배포된 URL 접속 테스트
- [ ] Gcode 파일 업로드 테스트

배포 후 URL: `https://yourusername.github.io/gcode-3d-viewer/`

문제가 생기면 Actions 탭의 로그를 확인하세요!
