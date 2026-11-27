# TASK NPC-SK1 Progress

- [x] Đọc `docs/CODEMAP.md` & lưu `docs/tasks/NPC-SK1.md`
- [x] ITEM 0: Sửa 2 test fail sẵn trong `src/components/__tests__/battleFxFix.test.tsx` (prestage PREP-1a) và 2 test đầu trong `src/engine/__tests__/suppliesCs1.test.ts` (số lượng/giá sau `sup_scan_t1`)
- [x] ITEM 1: Export & cập nhật `buildNpcSkillLoadout` trong `src/engine/combat.ts` theo danh sách ưu tiên vai trò, tối đa `MAX_ACTIVE_SKILL_BAR` (6), bù bằng skill normal còn lại, fallback `CLASS_STARTER_SKILLS`
- [x] ITEM 2: Đọc `chooseAiDecision` / `usableSkills` trong `src/engine/combat.ts` và ghi báo cáo kiểm tra `sup_flux_transfer`, `sup_lidar_sweep`, `sup_war_hymn`, `int_mach_surge`
- [x] Viết 3 test nhỏ (`src/engine/__tests__/npcRoleSkillsNpcSk1.test.ts`), chạy `tsc --noEmit` + `battleFxFix`, `suppliesCs1`, `npcRoleSkillsNpcSk1` (`--reporter=dot`), cập nhật `docs/CODEMAP.md` & `docs/tasks/NPC-SK1.report.md`
