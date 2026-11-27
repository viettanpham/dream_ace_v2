# BÁO CÁO — NPC-SK1

## 1. Đã hoàn thành
- **ITEM 0 (`battleFxFix.test.tsx`, `suppliesCs1.test.ts`)**: Gỡ cổng `prestage` (`prestage: { active: false, appliedByUnit: {} }`) trong 2 test cũ của `battleFxFix.test.tsx`; cập nhật test 1–2 của `suppliesCs1.test.ts` từ 15 lên 16 mẫu (`sup_scan_t1` `utility`, cooldown 4, perBattleLimit 2, `consumableBase.utility: 50`, giá `50`).
- **ITEM 1 (`src/engine/combat.ts`)**: Export `NPC_ROLE_SKILL_PRIORITY` và `buildNpcSkillLoadout(classId, level)`: lọc `category === 'normal'` đã mở khoá ở `level`, lấy đúng thứ tự ưu tiên theo class tối đa `MAX_ACTIVE_SKILL_BAR` (6), bù phần còn thiếu bằng `normal` đã mở khoá theo thứ tự `SKILLS_LIST`, nếu rỗng fallback `CLASS_STARTER_SKILLS`; giữ nguyên cấp skill `clamp(ceil(level/5), 1, 5)`.
- **ITEM 2 (Kiểm tra `chooseAiDecision` tại `src/engine/combat.ts:4544-4677`, không sửa logic AI)**:
  - `sup_flux_transfer`: **Dùng được** qua nhánh riêng (`fluxSkill` -> `pickFluxCount` theo luật khẩn cấp & giữ SP của B2c).
  - `sup_lidar_sweep`: **Dùng được** qua nhánh riêng `pickLidarCast(..., { role: 'npc' })` (ST-A2).
  - `sup_war_hymn`: **Dùng được** trong `tacticalSkills` (`targetType === 'all_allies'` -> `targetId: null`, `rng() < 0.55`, chạy sau `healSkill`/`pickLidarCast`/`fluxSkill`, không check đồng minh đã có `atk_up` chưa).
  - `int_mach_surge`: **Dùng được** trong `tacticalSkills` (`targetType === 'self'` -> `targetId: null`, `rng() < 0.55`, không check bản thân đã có `spd_up` chưa).
  - **Chỗ AI bỏ qua loại skill mới**: nhánh `tacticalSkills` (`combat.ts:4641`) lọc `!s.isToggle`, nên **Siege NPC bỏ qua hoàn toàn `sge_anchor_protocol` (`toggle_siege_mode`) và `sge_bastion_lock` (`toggle_siege_defense`)**; ngoài ra `healSkill` chỉ bắt `heal_single`/`heal_field_hot`/`full_recovery_elite` (chưa xử lý `sup_aegis_field` `energize_shield_field` theo ngưỡng khiên — chỉ roll ngẫu nhiên trong `tacticalSkills`).

## 2. File thay đổi
- Mới: `src/engine/__tests__/npcRoleSkillsNpcSk1.test.ts`, `docs/tasks/NPC-SK1.md`, `docs/tasks/NPC-SK1.progress.md`, `docs/tasks/NPC-SK1.report.md`
- Sửa: `src/engine/combat.ts`, `src/components/__tests__/battleFxFix.test.tsx`, `src/engine/__tests__/suppliesCs1.test.ts`, `docs/CODEMAP.md`

## 3. Kiểm thử
`npx tsc --noEmit` & `npx vitest run --reporter=dot src/components/__tests__/battleFxFix.test.tsx src/engine/__tests__/suppliesCs1.test.ts src/engine/__tests__/npcRoleSkillsNpcSk1.test.ts` PASS (3 files, 20/20 tests).

## 4. Trạng thái trình duyệt
**CHƯA chạy trình duyệt thật.**
