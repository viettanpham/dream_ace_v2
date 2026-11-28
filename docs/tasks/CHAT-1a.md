TASK CHAT-1a — NPC voice lines: lines data + trigger engine + log entry (NO Admin UI). Model: Hydrogen. If this prompt looks cut off, STOP and tell me.

STEP A: read docs/tasks/CHAT-1a.report.md, .progress.md, docs/tasks/CHAT-1a.md if they exist. If a report exists, show it and stop. If not, create docs/tasks/CHAT-1a.md (copy of this task) and .progress.md (tick each ITEM when done).
TOKEN SAVING: read docs/CODEMAP.md first, grep by symbol, read line ranges only.

GOAL: during a battle units sometimes "say" a short Vietnamese line, shown as one entry in the battle log.

ITEM 1 — data: src/data/voiceLines.json shape {"<trigger>":{"ally":[..],"player":[..],"enemy":[..]}} and src/data/voiceLines.ts with pickVoiceLine(trigger, side, rand01) -> string|null (null when missing/empty). Fill from the TABLE below (exact strings).
ITEM 2 — engine src/engine/voice.ts: emitVoice(state, trigger, unit). Rules (constants VOICE_DEFAULTS in src/data/balance.ts; Admin comes later): per-trigger chance %; a unit cannot speak again within 3 of its own actions; max 2 voice lines per round; lowHp only once per unit per battle; win/lose: ONE line per battle from one random unit of that side. Voice state lives in battle state only, NOT in the save (CURRENT_SAVE_VERSION stays 15). IMPORTANT: use a separate rng stream (derive from battle seed + a counter; grep for the existing rng helper) so the combat rng sequence and battle results do NOT change.
ITEM 3 — hooks: grep src/engine/combat.ts (and the file that resolves supply use / battle end) for where these are resolved and call emitVoice once at each: startTaunt, skillAttack, skillSupport, supplyUse, kill, crit, evade, lowHp (hp < 25%), shieldBreak, allyDown, win, lose. Minimal diff.
ITEM 4 — log: new log entry category "voice", text `${unitName}: "${line}"`. If the log renderer already has the pilot face icon component, show it before the text; otherwise text only. Do NOT add a filter UI now (CHAT-1b does); just keep the category separate so a filter can be added.

CHANCES (%): startTaunt 30 (enemy only) | skillAttack 15 | skillSupport 20 | supplyUse 25 | kill 40 | crit 30 | evade 25 | lowHp 60 | shieldBreak 35 | allyDown 40 | win 100 | lose 100.

TABLE (ally = AI wingmen/mercs, player = the player's own pilot, enemy = enemy NPC):
startTaunt | enemy: Hôm nay các ngươi không ra khỏi đây đâu! / Đồ bay lạc, chuẩn bị rơi đi! / Khóa mục tiêu. Nổ súng!
skillAttack | ally: Nhận này! / Hỏa lực yểm trợ! / Khóa mục tiêu, bắn! | player: Khai hỏa! / Tập trung hỏa lực! / Vào việc thôi! | enemy: Chết đi! / Cầm lấy món quà này! / Né được không?
skillSupport | ally: Giữ vững đội hình! / Em hỗ trợ đây! / Sửa chữa nhanh! | player: Giữ vững, anh em! / Bơm thêm sức đây. / Đội hình, tiếp tục! | enemy: Dồn lại, đừng để chúng thắng! / Chữa nhanh, tiếp tục! / Còn lâu mới hết!
supplyUse | ally: Dùng tạm bộ vật tư! / Hồi sức, tiếp tục chiến đấu. / Dự phòng vẫn còn! | player: Bộ vật tư, kích hoạt. / Còn trụ được! / Nạp lại! | enemy: Chúng ta còn nhiều lắm! / Bổ sung xong, tiếp! / Đừng hy vọng!
kill | ally: Một tên rơi! / Hạ gục, tiếp theo! / Mục tiêu đã xuống! | player: Hạ rồi! / Một mục tiêu nữa. / Gọn gàng. | enemy: Một con chuột ít hơn. / Hạ gục kẻ yếu! / Tiếp theo là ai?
crit | ally: Trúng điểm yếu! / Đòn hiểm! / Đúng chỗ rồi! | player: Trúng ngay tim! / Đúng điểm yếu! / Hoàn hảo! | enemy: Đau chưa? / Đúng chỗ hiểm! / Nếm thử đi!
evade | ally: Suýt thì trúng! / Trượt rồi! / Nhẹ như lông. | player: Né được! / Khá nhanh đấy. / Chưa đủ để chạm tôi. | enemy: Chậm quá! / Bắn trượt rồi! / Đừng nằm mơ!
lowHp | ally: Thân tàu sắp vỡ! / Cần hỗ trợ gấp! / Báo cáo, hư hại nặng! | player: Thân máy báo động đỏ! / Chưa xong đâu... / Tình hình xấu rồi. | enemy: Không thể thua ở đây! / Rút... không, chiến đấu tiếp! / Hư hại nặng!
shieldBreak | ally: Khiên vỡ rồi! / Mất khiên, cẩn thận! / Khiên tắt! | player: Khiên gục, che cho tôi! / Mất khiên rồi. / Khiên vỡ, giữ vững! | enemy: Khiên đã vỡ, nhưng chưa hết! / Ngươi phá khiên được rồi sao? / Khiên mất, bắn bù!
allyDown | ally: Mất một đồng đội! / Báo cáo, có người rơi! / Đừng để họ ngã vô ích! | player: Không... đồng đội! / Hãy báo thù cho họ. / Đội hình thiếu một người. | enemy: Mất một, vẫn đủ giết các ngươi. / Kẻ yếu thì phải rơi. / Mặc kệ nó, tiếp tục!
win | ally: Chiến thắng! / Xong việc, về căn cứ! / Làm tốt lắm, đội trưởng! | player: Hoàn thành nhiệm vụ. / Gọn gàng, mọi người. / Về căn cứ thôi. | enemy: Các ngươi yếu quá. / Đây là kết cục của kẻ cản đường. / Dọn sạch rồi.
lose | ally: Rút lui! Không giữ nổi! / Thất bại... ghi nhận. / Hẹn lần sau. | player: Rút... lần này thôi. / Sẽ trở lại mạnh hơn. / Chấp nhận. Lần sau sẽ khác. | enemy: Không thể nào... / Ta sẽ trở lại! / Đủ rồi, rút!
(win/lose are from the point of view of the speaker's side: "win" = the speaker's side won.)

HARD LIMITS: no save change; no change to damage/hit/crit/rng results of combat; no Admin UI; no new dependency; touch only files needed.
TESTS (max 4, small): pickVoiceLine returns null for missing trigger/side; a unit cannot speak twice within the cooldown; lowHp speaks once per unit per battle; same battle seed gives identical battle result with voice on and off.
CHECKS: run only related test files with --reporter=dot, plus tsc --noEmit. No full vitest, no build.
REPORT (<=10 lines): items done, files changed, tests, tsc, and end with "NOT checked in a real browser".
