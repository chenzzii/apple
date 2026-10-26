# 《果園危機》Project Orchard Panic — GDD v0.1
日期：2026-10-26
性質：1981 年 Apple Panic 玩法的「精神重製」研究規格；公開發行採原創名稱、美術及音效。

## 0. 目標與範圍
- 核心承諾：操作是水平移動、爬梯、朝左右挖洞、敲擊填洞；沒有跳躍；以陷阱使敵人連續向下掉落消滅。
- 核心手感：可以預測怪物路徑、控制洞穴位置與敲擊時機；畫質升級不得模糊精確判定。
- 美術：高清 2D 手繪卡通，遊戲物件的輪廓、占用格與碰撞判定清楚可辨。
- 第一階段：單機、靜態部署、可完整玩一個示範關卡 + 進階怪物測試關卡。保留三種敵人規則，不聲稱已重現原版全部關卡。
- 非目標：多人排名、登入、AI API、商城、完整劇情、手機優先、正式原版資產重發行。

## 1. 玩法與原典核對
原版 Apple II 說明書：I/J/K/M 分別上/左/右/下；A 向面朝方向挖洞；S 填洞/敲擊受困敵人；三條命；蘋果掉一層、綠蝴蝶兩層、藍面具三層；這些層數需要在同一段連續落下過程達成。玩家可安全穿過洞。原版基礎計分為每層紅蘋果 100、綠蝴蝶 200、藍面具 300；清屏速度決定額外獎勵。
原版玩家攻略記載每洞約需 6 次挖掘、敲出受困敵人約 6 次敲擊；視為參考，請透過影片/實機另行調校動畫速度與判定範圍。
原典：
- https://mirrors.apple2.org.za/ftp.apple.asimov.net/documentation/applications/misc/apple-panic-folder.pdf
- https://gamefaqs.gamespot.com/appleii/582047-apple-panic/faqs/52445

## 2. 首版使用者旅程
1. 開場畫面「開始遊戲 / 控制說明 / 設定」。
2. 選擇現代預設操作或原典鍵位，速度預設 1.25x（非宣稱原版準確值）。
3. 進入關卡，顯示目標：消滅敵人、保住三條命、在倒數內完成。
4. 挖洞（六次敲擊/長按六段）、敵人掉入、於逃脫前六次敲擊使其向下穿落；連續對齊洞為高級怪物提供 2–3 層下落。
5. 清除敵人：顯示通關、分數、剩餘時間獎勵；死亡三次：Game Over，提供重試；暫停/重開可操作。
6. 另設 Debug/Test 關卡，一鍵生成各怪物及 1、2、3 層連續洞穴，供開發與測試，不列入正式排名。

## 3. 地圖、邏輯格與視覺座標
- 外部設計畫布：1280 × 720（16:9）；世界舞台 960 × 576，居中呈現，保留左右 UI/裝飾邊界。
- 舞台邏輯格寬度：40 px，24 個水平格。五條可行走平台依 Level JSON 提供 `floorY`，建議相鄰高差 92 px，留足攀梯與掉落動畫空間。
- 「地板可挖格」與「梯子連接點」分離表示。洞占用單一格，嚴格限制相同水平列（column）才能串聯連續掉落。不要用圖片透明區域推算。
- 地面/平台採明確 collision/topology model；視覺特效絕不可改變碰撞資料。
- 基本地圖校驗：玩家與敵人出生點在可到達地面；有梯可連接可走層；不可在梯子占位格挖洞；上下洞對齊判定嚴格一致。
- 角色碰撞寬約 26–30 px、移動視覺寬可較大；足底與梯子中心用可配置 snap tolerance。
- 最下層是否允許穿洞及處理邊界、原版關卡地形生成模式，需要參照原版錄影確認；首版以清楚、可測試的 Level JSON 規則實作，明確標記近似處。

## 4. 動作、輸入、數值初值（可調，不宣稱等於原版）
- 控制：方向鍵/WASD 移動；`J` 挖洞、`K` 填洞/擊打（避免 WASD 和原版 S 衝突）；Enter 確認、Esc 暫停、R 重開。
- 原版鍵位配置：I/J/K/M 移動；A 挖、S 填/擊；UI 中顯示鍵位。兩套配置不可同時啟用以免衝突。
- 行為：移動中或站在合法站位時面朝方向挖一格；一次挖洞分 6 個 progress steps；填洞/攻擊受困敵人亦 6 步。支援按鍵連打與長按自動週期發動；每次動作有音/視覺反饋。
- 玩家移動速度建議 120px/遊戲秒；敵人 80px/遊戲秒；爬梯 88px/遊戲秒；每次挖掘有效脈衝間隔 110ms/遊戲秒；受困時間初值 5.0 遊戲秒；受傷無敵 1.0 遊戲秒。
- 調速 1.0, 1.25, 1.5, 2.0；全部遊戲邏輯時間使用 game clock：敵人移動、受困逃脫、行為冷卻、倒數、遊戲難度一起按倍率推進；UI、音量設定和 UI 動畫可使用 real time。
- 生命 3，怪物碰撞失去一命；存活時不受跳躍規則影響（無跳躍）。復活後按關卡規則重設敵人/地形，需寫測試。
- 積分：按實際連續落下層數 × 物種基礎分數；掉落層數不足則存活。掉落與得分需在同一狀態轉移中計算一次，防止重覆計分。
- 倒數及額外生命機制做成 levelConfig，第一版示範值可合理化而不能宣稱是原版精準值。

## 5. FSM 與事件規格
### 玩家 `PlayerState`
`IDLE`, `WALKING`, `CLIMBING`, `DIGGING`, `POUNDING`, `FALLING`, `HURT`, `DEAD`, `RESPAWNING`
- IDLE -> WALKING：水平輸入且路徑可行；-> CLIMBING：在梯心且上/下輸入；-> DIGGING / POUNDING：附近有合法目標。
- WALKING/CLIMBING -> FALLING：失去支撐，包括自己穿過洞；FALLING -> IDLE：碰到可站平台。
- 任意非無敵狀態 -> HURT：怪物接觸；失去最後一命 -> DEAD；其餘 -> RESPAWNING -> IDLE。
- DIGGING/POUNDING 一個動作脈衝完成後回 IDLE 或持續接下一個脈衝；不中斷碰撞判定；動畫不可阻塞輸入超過設定值。

### 洞穴 `HoleState`
`SOLID`, `DIGGING`, `OPEN`, `OCCUPIED`, `POUNDING`, `REFILLING`
- SOLID -> DIGGING：有可挖平台 tile、非梯位、站位合法；每次脈衝增加 1，6 次進 OPEN。
- OPEN -> OCCUPIED：敵人從上方跌入；記錄 `trappedEnemyId`、倒數。
- OCCUPIED -> POUNDING：玩家在附近、面向合法且啟動敲擊；6 次有效敲擊時移除受困狀態並觸發敵人 `FALLING`；檢查對齊下方是否有下一個開口。
- OCCUPIED -> OPEN：敵人超時 ESCAPING 返回平台，洞仍保持開口（此行為可配置以匹配錄影）。
- OPEN/DIGGING -> REFILLING：玩家填洞；6 次完成 SOLID；不可強行讓被困敵人和地板重疊。
- POUNDING 的更新即使按鍵連打，也不能跳過 6 步；同一個洞只能有一位受困敵人，其他碰撞按規則處理。

### 怪物 `EnemyState`
`PATROL`, `CLIMBING`, `FALLING`, `TRAPPED`, `ESCAPING`, `DEFEATED`
- PATROL：左右移動，於岔路/梯口按可重現的 seeded RNG 決定行動；不需要全知追蹤主角。
- 接觸有效洞緣 -> FALLING -> TRAPPED，啟動受困時計。
- 被玩家敲落 -> FALLING，記錄本次**連續**跌落跨越的層數；若落在實心平台，依怪物 `requiredFallFloors` 判定 DEFEATED 或繼續存活。
- 紅蘋果 `requiredFallFloors=1`，綠色 `=2`，藍色 `=3`。
- 達受困期限 -> ESCAPING -> PATROL。視覺爬出洞、碰撞恢復的時間點需一致。
- 每隻敵人完成 `DEFEATED` 只發一次 `enemy-defeated` 事件；全部清除觸發 `level-cleared`。

### 遊戲狀態 `GameState`
`MENU`, `READY`, `PLAYING`, `PAUSED`, `LIFE_LOST`, `LEVEL_CLEAR`, `GAME_OVER`
- 暫停時 game clock、怪物、倒數、動畫中的遊戲事件一律停止；UI 可響應。
- 切換分頁時自動暫停，回來後不得把長時間背景 elapsed 直接加到累加器。

### 領域事件（Typed union）
`hole-dig-progress`, `hole-opened`, `enemy-trapped`, `hole-pound-progress`, `enemy-fall-started`, `enemy-defeated`, `enemy-escaped`, `player-hit`, `life-lost`, `level-cleared`, `game-over`。

## 6. 邏輯更新與畫面更新
- 使用 Phaser 4.2.1 + TypeScript + Vite，部署 Cloudflare Pages 或 GitHub Pages。
- **單一權威模擬層**：碰撞、挖洞、跨樓層落下、怪物 FSM 採純 TypeScript `GameSimulation`；Phaser Scene 做輸入/渲染/音效。不要同時使用 Arcade Physics 和自製物理各自修改同一位置。
- Fixed logical delta `STEP_MS = 1000/60`；瀏覽器每次 `requestAnimationFrame` 中累加 `clamp(realDelta,0,100ms) * speedMultiplier`，每個邏輯步扣 16.667ms，最大 catch-up 5 步；若落後捨棄超量累加、紀錄掉幀以避免死亡螺旋。
- 透過上一幀/下一幀座標插值渲染；要有辦法從 60、120、144Hz 螢幕驗證邏輯速度一致。
- 60 FPS 為設計目標而非硬體保證；高更新率裝置允許更頻繁渲染但不影響模擬。
- Speed factor 改變遊戲時計：所有怪物行為、逃脫、技能冷卻和限制時間同步改變，不只是改角色 velocity。
- 首版 `render.pixelArt=false`、`antialias=true`、`scale: FIT`，1600/2160 等尺寸時以 DPR 與資產解析度考量銳利度，避免每一幀生成紋理。
- 優先於 desktop Chrome/Edge 測試；Safari/Firefox 次之。

## 7. 美術與素材製作規格（HD 2D 卡通）
- 風格：清晰粗輪廓、鮮明但不刺眼、溫暖色彩、少量柔和陰影；復古關卡幾何形狀不被華麗背景干擾。
- 角色：原創小小園丁，背心、工具帶、鏟子；畫面中約 44–54px 高，製作 2x/3x 解析度 sprite sheet；原點使用足底中點。
- 園丁動畫：idle 6、run 8、climb 6、dig 6、pound 6、fall 3、hurt 4、defeat 6 張基準影格（可由補間與重用影格實作，非第一階段硬需求）。
- 敵人剪影區分：紅蘋果矮圓、綠蝴蝶寬翼、藍面具高瘦；除了顏色，也有形狀與花紋差異，避免僅依色彩辨識。
- 敵人動畫：patrol、climb、fall、trapped、escape、defeat，每種可以使用少量 frame，MVP 可用程式繪製向量形狀與 tween。
- 地形：平台保留單格寬度；可挖地板有明顯磚縫；梯子用高對比紫色或淺色高對比線條；洞內用深暗但保留邊緣亮線，以利觀察位置。
- 介面：生命、目前分數、關卡、倒數、速度倍率、暫停及手把/按鍵提示；與遊戲物件不要重疊。
- VFX：挖磚碎屑、洞口裂痕 6 階段、落下動態拉伸、怪物暈眩提示、消滅數字跳字；不產生阻礙判定的全螢幕光效。
- SFX：每次挖洞脈衝、洞完成、敵人落洞、敲擊、連續落下、消滅、受傷、過關。先用 Web Audio 合成音/原創合成器音，後再置換。
- Sprite 介面需能無痛改為 PNG/WebP atlas；MVP 不允許依賴尚未製作的圖檔阻塞可玩性。
- 畫面中的原版商品標誌/圖像/音效不得直接複製，參考核心玩法但使用自行創作素材。

### 資產清單
| Key | 內容 | 第一階段 | 正式美術階段 |
|---|---|---|---|
| player | 園丁角色 | 程式繪製 | Spritesheet 2x/3x |
| apple_red | 紅蘋果怪 | 程式繪製 | 動態表情 spritesheet |
| butterfly_green | 綠翅怪 | 程式繪製 | 動態翅膀 spritesheet |
| mask_blue | 藍面具怪 | 程式繪製 | 動態面具 spritesheet |
| floor/ladder/hole | 地形與洞穴狀態 | 程式繪製 | 高清地形 atlas |
| background | 果園層次背景 | 漸層 + 色塊 | 1920x1080 以上分層圖 |
| HUD/icons | UI 與生命圖示 | Phaser text/vector | SVG/WebP |
| SFX/music | 挖洞/落下/過關 | 簡易合成音 | 原創音效音樂 |

## 8. 專案目錄
```text
orchard-panic/
  public/
    assets/                 # 日後正式圖像/音效
  src/
    main.ts
    game/
      GameConfig.ts
      scenes/BootScene.ts
      scenes/MenuScene.ts
      scenes/GameScene.ts
      scenes/HudScene.ts
    core/
      Simulation.ts
      types.ts
      InputCommands.ts
      FixedStepClock.ts
      LevelLoader.ts
      MapGrid.ts
      PlayerSystem.ts
      HoleSystem.ts
      EnemySystem.ts
      CollisionSystem.ts
      ScoringSystem.ts
      EventBus.ts
      rng.ts
    levels/
      level01.json
      mechanics-test.json
    rendering/
      VectorArt.ts
      AnimationPresenter.ts
      Effects.ts
    ui/
      Settings.ts
      ControlsHelp.ts
  tests/
    hole.test.ts
    fall-chain.test.ts
    enemy.test.ts
    clock.test.ts
    game-state.test.ts
  package.json
  tsconfig.json
  vite.config.ts
  README.md
  LICENSE
```

## 9. 測試與驗收清單
- T01：沒有跳躍鍵；上下只能在梯子有效範圍內進行（已挖洞下落例外）。
- T02：面向有效可挖格執行 6 次動作，洞從 SOLID → OPEN；第 5 次仍未全開。
- T03：在梯子格、場外、不可挖格無法開洞。
- T04：紅怪落下連續 1 層可消滅、綠怪 1 層不能消滅、2 層可消滅、藍怪 2 層不能消滅、3 層可消滅。
- T05：上下洞有 1 格水平錯位時，不可誤算 2/3 層連續落下。
- T06：受困敵人超時逃脫；在逃脫前敲擊 6 次可落下；不重覆計分。
- T07：玩家自身穿過洞，不會被當成受困怪物或因穿洞受傷。
- T08：接觸敵人扣 1 命，無敵時間內不重覆扣命，3 命後 Game Over。
- T09：最後敵人消失觸發 LEVEL_CLEAR，沒有額外殘留或重覆觸發。
- T10：暫停/切後台再回來不會跳過受困倒數/瞬間 Game Over。
- T11：速度 1x vs 2x 同樣 10s 真實時間，邏輯事件在 2x 約發生兩倍；30/60/144 FPS 渲染不改變邏輯結果。
- T12：Chrome/Edge 1080p 常見桌機在單一示範場景目標 60 FPS；未達時以記錄真實測得 fps 與瓶頸，不謊報。
- T13：`npm run build`, `npm run typecheck`, `npm run test` 均成功；無 missing assets、console errors；支援本機 `npm run dev` 啟動。

## 10. 風險與未驗證原版細節
- 未經原版錄影校正的：實際移速、敵人出現位置及完整 32 關、挖/填動作連打時距、碰撞容差、受困秒數、最後一層邊界、失去生命後重置策略、分數獎勵倒數的精確演算法。
- 處理：將這些差異記錄於 `docs/legacy-parity.md`；任何自行設計的值標註為「暫定」；初版忠實的是規則結構，不宣稱逐影格還原。
- 需釐清的是原版版權、商標、原始圖像與音樂使用權；公開版本全部採原創視覺與音效。

## 11. 建議第二階段
- 校準與原版錄影比對、更多關卡與難度曲線。
- 製作高清圖像 atlas、角色逐格動畫、原創配樂與音效。
- 可選經典視覺模式、新怪物及關卡編輯器；新規則嚴格隔離於現代／進化模式。
- 手把、手機虛擬按鈕與可存取性設定。
