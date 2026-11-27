B2b — Truyền năng lượng tự động (Flux auto) cho người chơi

RESUME PROTOCOL: lưu prompt này vào docs/tasks/B2b.md, checklist docs/tasks/B2b.progress.md (tick từng mục), báo cáo cuối docs/tasks/B2b.report.md rồi in ra.

TOKEN SAVING: đọc docs/CODEMAP.md trước, grep theo symbol, file >300 dòng chỉ mở đúng khoảng dòng, làm từng mục một, KHÔNG chạy full vitest, KHÔNG build, chỉ test file liên quan với --reporter=dot + tsc, append dòng vào CODEMAP, không bật Firebase.

MỤC TIÊU: AutoTacticsModal có thêm mục "Truyền năng lượng tự động" (chỉ có ý nghĩa với GEAR Support có skill sup_flux_transfer), mirror y hệt cách làm của Lidar auto.

ITEM 0 (test cũ): src/engine/__tests__/moduleItemsExt2a1.test.ts test (4) dòng ~90-104 còn assert "shop không có module" (đúng trước EXT2b, giờ shop bán 1 module/lần làm mới). Sửa lại: un-templated generateItemInstance và drop khi moduleDrop factor = 0 không chứa module (bỏ 2 expect về shop). Chỉ chạy file này.

ITEM 1 (engine, file mới src/engine/fluxAuto.ts, mirror src/engine/lidarAuto.ts):
- type FluxAutoConfig { enabled: boolean; mode: 'smart' | 'fixed'; allySpBelowPct: number (default 25, 0..100); keepSelfPct: number (default 50, 0..100) } đặt cạnh LidarAutoConfig trong src/types/game.ts (~:711) + SimpleTacticsConfig.fluxAuto?: FluxAutoConfig (~:725).
- DEFAULT_FLUX_AUTO_CONFIG = { enabled: true, mode: 'smart', allySpBelowPct: 25, keepSelfPct: 50 }; sanitizeFluxAutoConfig(raw) làm tròn + clamp 0..100, giá trị sai => default.
- pickFluxAutoCount(units, actor, { fluxAuto, adminConfig, step2UsedSoFar, turnLockedSkillIds }, rng): trả số đích (>0) hoặc 0.
  * enabled=false => 0. Actor phải có sup_flux_transfer trong thanh skill và canUnitUseSkill; tôn trọng canCastAsStep2 / step2UsedSoFar / turnLockedSkillIds giống pickLidarCast (nếu Flux không phải step 2 thì coi như hành động chính, đọc turnPhase.ts để chắc).
  * mode 'smart' = đúng logic NPC: gọi pickFluxCount(units, actor.id, { ...sanitizeFluxTransferConfig(adminConfig?.fluxTransfer), spEconomy: adminConfig?.spEconomy }, computeFluxBattlePressure(units, actor.side), rng) (combat.ts ~:4445: giữ SP cho heal/shield/revive, giữ 15% khi đang thua).
  * mode 'fixed' = gọi pickFluxCount nhưng ghi đè allySpBelowPct và keepSelfPct bằng giá trị trong fluxAuto (dùng bản cfg đã sanitize, KHÔNG sửa adminConfig gốc), bỏ qua phần giảm keepSelf khi đang thua.
- Không đổi hành vi NPC (combat.ts ~:4662 giữ nguyên).

ITEM 2 (nối vào auto của người chơi):
- src/engine/tactics.ts: presets (~:688-750) thêm fluxAuto: { ...DEFAULT_FLUX_AUTO_CONFIG } cạnh lidarAuto; sanitize simple config (~:824-834) thêm fluxAuto = sanitizeFluxAutoConfig(obj.fluxAuto). Save cũ không có fluxAuto => default, KHÔNG tăng CURRENT_SAVE_VERSION.
- src/store/useGameStore.ts ~:3860-3925 (chooseNextDecision trong resolveMultiStepTurn): ngay sau khối pickLidarCast, trước chooseAction: nếu pickFluxAutoCount(...) > 0 trả { action:'skill', targetId:null, skillId:'sup_flux_transfer', transferCount: count, matchedRuleIndex:null }. Khối cũ (~:3896-3936) khi luật tactics chọn sp_transfer giữ nguyên làm fallback, nhưng nếu fluxAuto.enabled=false thì KHÔNG được tự cast Flux từ luật (rơi xuống đánh thường như nhánh count=0 hiện có).

ITEM 3 (UI, src/components/AutoTacticsModal.tsx, ngay SAU mục Lidar ~:702-800, cùng style):
- Chỉ hiện khi GEAR là Support (giống điều kiện của mục Lidar). data-testid="auto-flux-section".
- Tiêu đề "Truyền năng lượng tự động" (vi) / "Auto Flux Transfer" (en); công tắc ON/OFF data-testid="auto-flux-toggle".
- 2 nút chọn chế độ [Thông minh] [Theo %] (testid auto-flux-mode-smart / auto-flux-mode-fixed), mặc định ON + Thông minh. Dòng mô tả Thông minh: "Giữ SP để hồi máu/khiên/hồi sinh, khi đang thua thì chỉ giữ 15%."
- Khi Theo %: 2 ô số (0-100): "Chỉ truyền khi đồng minh dưới [25] % SP" (testid auto-flux-ally-sp-input) và "Giữ lại ít nhất [50] % SP của mình" (testid auto-flux-keep-self-input). Gõ tự do, áp dụng khi blur/Enter, giá trị sai thì trả về giá trị cũ. Lưu bằng applySimpleTactics({ fluxAuto }).
- Khi OFF hoặc Thông minh: ẩn 2 ô số. Chuỗi mới có đủ vi.ts VÀ en.ts. Màn hình hẹp 320-390px không tràn ngang, không đặt gì ở x<8.

TESTS (tối đa 4-5, file mới src/engine/__tests__/fluxAutoB2b.test.ts + 1 test UI nhỏ nếu đã có test AutoTacticsModal):
1) sanitizeFluxAutoConfig: rác => default, clamp 0..100.
2) pickFluxAutoCount enabled=false => 0.
3) smart: có đồng minh SP < 25%, support đủ SP và không có heal sẵn sàng => >0; có heal khả dụng => 0.
4) fixed với allySpBelowPct 60: đồng minh 50% SP => >0 (smart thì 0).
5) (UI) toggle + mode + 2 input gọi applySimpleTactics đúng.

CHECKS: vitest chạy riêng fluxAutoB2b + moduleItemsExt2a1 + test lidarAuto/tactics liên quan (--reporter=dot) + npx tsc --noEmit. Không full vitest, không build.

REPORT (ngắn, <=15 dòng): từng ITEM xong/chưa, kết quả tests + tsc, ghi rõ "CHƯA chạy trình duyệt thật".
