# D1-2a Audit (After) — Unified Item Price Formula (`96` Cells + `200`-Roll Check)

> Generated from real engine functions (`computeItemPrice`, `generateItemInstance`, `getSellPrice`, `PRICE_FORMULA` in `src/data/itemPricing.ts` & `src/engine/itemPrice.ts`) using `rollQuality = 50`, `affixCount = 0` for deterministic baseline columns and 200 deterministic Mulberry32 rolls per cell for `[min..max]` ranges.

## 1. Full 96-Cell Price & Quick-Sell Table (`slot × tier × rarity`)

Columns:
- `Q50 Base Buy (CR)`: `computeItemPrice({ slot, tier, rarity, rollQuality: 50, affixCount: 0, traitCount: 0 })` (zero affixes, zero traits).
- `Q50 Tpl Buy (CR)`: `computeItemPrice` with `rollQuality = 50`, `affixCount = 0`, and each matching template’s real `countNonZeroTraits(specialTraits)` (median and `[min..max]` across templates in that `slot × tier`).
- `200-Roll Buy [min..max]`: real `generateItemInstance({ slot, tier, rarity }, rng)` outputs (includes rolled quality `1..100`, rarity affixes `+4%/affix`, and template special traits `+6%/trait`).

| Slot | Tier | Rarity | Exact Tpls | Q50 Base Buy | Q50 Tpl Buy (No Affix) | Q50 Tpl Sell | Old Q50 Buy | Δ Base | Δ Tpl | 200-Roll Buy [min..max] | 200-Roll Sell [min..max] |
|---|---|---|---:|---:|---|---:|---:|---:|---:|---|---|
| `main_weapon` | T1 | common | 1 | 184 | 195 | 78 | 184 | +0.0% | +6.0% | 168..222 | 67..88 |
| `main_weapon` | T1 | rare | 1 | 304 | 322 | 128 | 303 | +0.3% | +6.3% | 292..378 | 116..151 |
| `main_weapon` | T1 | epic | 1 | 506 | 536 | 214 | 505 | +0.2% | +6.1% | 507..650 | 202..260 |
| `main_weapon` | T1 | legendary | 1 | 846 | 897 | 358 | 845 | +0.1% | +6.2% | 892..1094 | 356..437 |
| `main_weapon` | T2 | common | 2 | 320 | 339 (339..359) | 135 | 337 | -5.0% | +0.6% | 302..400 | 120..160 |
| `main_weapon` | T2 | rare | 2 | 528 | 560 (560..592) | 224 | 556 | -5.0% | +0.7% | 505..673 | 202..269 |
| `main_weapon` | T2 | epic | 2 | 880 | 933 (933..986) | 373 | 926 | -5.0% | +0.8% | 914..1136 | 365..454 |
| `main_weapon` | T2 | legendary | 2 | 1473 | 1561 (1561..1649) | 624 | 1548 | -4.8% | +0.8% | 1597..1974 | 638..789 |
| `main_weapon` | T3 | common | 1 | 467 | 495 | 198 | 469 | -0.4% | +5.5% | 439..558 | 175..223 |
| `main_weapon` | T3 | rare | 1 | 771 | 817 | 326 | 774 | -0.4% | +5.6% | 749..946 | 299..378 |
| `main_weapon` | T3 | epic | 1 | 1285 | 1362 | 544 | 1290 | -0.4% | +5.6% | 1309..1609 | 523..643 |
| `main_weapon` | T3 | legendary | 1 | 2150 | 2279 | 911 | 2158 | -0.4% | +5.6% | 2295..2807 | 918..1122 |
| `main_weapon` | T4 | common | 1 | 699 | 825 | 330 | 694 | +0.7% | +18.9% | 721..938 | 288..375 |
| `main_weapon` | T4 | rare | 1 | 1154 | 1361 | 544 | 1144 | +0.9% | +19.0% | 1230..1553 | 492..621 |
| `main_weapon` | T4 | epic | 1 | 1923 | 2269 | 907 | 1907 | +0.8% | +19.0% | 2192..2708 | 876..1083 |
| `main_weapon` | T4 | legendary | 1 | 3216 | 3795 | 1518 | 3191 | +0.8% | +18.9% | 3725..4603 | 1490..1841 |
| `sub_weapon` | T1 | common | 1 | 173 | 194 | 77 | 173 | +0.0% | +12.1% | 168..220 | 67..88 |
| `sub_weapon` | T1 | rare | 1 | 285 | 320 | 128 | 286 | -0.3% | +11.9% | 294..375 | 117..150 |
| `sub_weapon` | T1 | epic | 1 | 476 | 533 | 213 | 477 | -0.2% | +11.7% | 509..632 | 203..252 |
| `sub_weapon` | T1 | legendary | 1 | 796 | 891 | 356 | 798 | -0.3% | +11.7% | 893..1070 | 357..428 |
| `sub_weapon` | T2 | common | 2 | 301 | 319 | 127 | 301 | +0.0% | +6.0% | 277..362 | 110..144 |
| `sub_weapon` | T2 | rare | 2 | 497 | 526 | 210 | 497 | +0.0% | +5.8% | 481..600 | 192..240 |
| `sub_weapon` | T2 | epic | 2 | 828 | 877 | 350 | 828 | +0.0% | +5.9% | 835..1057 | 334..422 |
| `sub_weapon` | T2 | legendary | 2 | 1385 | 1468 | 587 | 1385 | +0.0% | +6.0% | 1460..1785 | 584..714 |
| `sub_weapon` | T3 | common | 1 | 439 | 492 | 196 | 439 | +0.0% | +12.1% | 425..554 | 170..221 |
| `sub_weapon` | T3 | rare | 1 | 725 | 812 | 324 | 724 | +0.1% | +12.2% | 747..931 | 298..372 |
| `sub_weapon` | T3 | epic | 1 | 1208 | 1353 | 541 | 1206 | +0.2% | +12.2% | 1312..1592 | 524..636 |
| `sub_weapon` | T3 | legendary | 1 | 2021 | 2264 | 905 | 2018 | +0.1% | +12.2% | 2275..2717 | 910..1086 |
| `sub_weapon` | T4 | common | 1 | 657 | 776 | 310 | 622 | +5.6% | +24.8% | 674..882 | 269..352 |
| `sub_weapon` | T4 | rare | 1 | 1085 | 1280 | 512 | 1027 | +5.6% | +24.6% | 1168..1472 | 467..588 |
| `sub_weapon` | T4 | epic | 1 | 1808 | 2133 | 853 | 1711 | +5.7% | +24.7% | 2055..2520 | 822..1008 |
| `sub_weapon` | T4 | legendary | 1 | 3024 | 3568 | 1427 | 2862 | +5.7% | +24.7% | 3579..4228 | 1431..1691 |
| `armor` | T1 | common | 4 | 194 | 206 (194..206) | 82 | 194 | +0.0% | +6.2% | 170..232 | 68..92 |
| `armor` | T1 | rare | 4 | 320 | 339 (320..339) | 135 | 320 | +0.0% | +5.9% | 297..391 | 118..156 |
| `armor` | T1 | epic | 4 | 534 | 566 (534..566) | 226 | 533 | +0.2% | +6.2% | 523..683 | 209..273 |
| `armor` | T1 | legendary | 4 | 892 | 946 (892..946) | 378 | 891 | +0.1% | +6.2% | 913..1159 | 365..463 |
| `armor` | T2 | common | 0 | 338 | 358 (338..358) | 143 | 318 | +6.3% | +12.6% | 293..404 | 117..161 |
| `armor` | T2 | rare | 0 | 557 | 590 (557..590) | 236 | 525 | +6.1% | +12.4% | 529..685 | 211..274 |
| `armor` | T2 | epic | 0 | 928 | 984 (928..984) | 393 | 874 | +6.2% | +12.6% | 938..1162 | 375..464 |
| `armor` | T2 | legendary | 0 | 1553 | 1646 (1553..1646) | 658 | 1462 | +6.2% | +12.6% | 1666..1996 | 666..798 |
| `armor` | T3 | common | 4 | 493 | 522 | 208 | 459 | +7.4% | +13.7% | 457..587 | 182..234 |
| `armor` | T3 | rare | 4 | 813 | 862 | 344 | 757 | +7.4% | +13.9% | 787..962 | 314..384 |
| `armor` | T3 | epic | 4 | 1355 | 1436 | 574 | 1262 | +7.4% | +13.8% | 1385..1688 | 554..675 |
| `armor` | T3 | legendary | 4 | 2267 | 2403 | 961 | 2111 | +7.4% | +13.8% | 2405..2892 | 962..1156 |
| `armor` | T4 | common | 0 | 737 | 781 (737..781) | 312 | 928 | -20.6% | -15.8% | 642..880 | 256..352 |
| `armor` | T4 | rare | 0 | 1216 | 1289 (1216..1289) | 515 | 1531 | -20.6% | -15.8% | 1148..1462 | 459..584 |
| `armor` | T4 | epic | 0 | 2027 | 2149 (2027..2149) | 859 | 2552 | -20.6% | -15.8% | 2018..2557 | 807..1022 |
| `armor` | T4 | legendary | 0 | 3391 | 3595 (3391..3595) | 1438 | 4268 | -20.5% | -15.8% | 3532..4461 | 1412..1784 |
| `engine` | T1 | common | 4 | 189 | 189 (189..200) | 75 | 189 | +0.0% | +0.0% | 164..227 | 65..90 |
| `engine` | T1 | rare | 4 | 312 | 312 (312..331) | 124 | 311 | +0.3% | +0.3% | 293..386 | 117..154 |
| `engine` | T1 | epic | 4 | 520 | 520 (520..551) | 208 | 519 | +0.2% | +0.2% | 508..647 | 203..258 |
| `engine` | T1 | legendary | 4 | 869 | 869 (869..922) | 347 | 868 | +0.1% | +0.1% | 881..1098 | 352..439 |
| `engine` | T2 | common | 0 | 329 | 349 (329..349) | 139 | 316 | +4.1% | +10.4% | 287..394 | 114..157 |
| `engine` | T2 | rare | 0 | 543 | 575 (543..575) | 230 | 522 | +4.0% | +10.2% | 506..672 | 202..268 |
| `engine` | T2 | epic | 0 | 904 | 959 (904..959) | 383 | 869 | +4.0% | +10.4% | 876..1106 | 350..442 |
| `engine` | T2 | legendary | 0 | 1513 | 1604 (1513..1604) | 641 | 1454 | +4.1% | +10.3% | 1542..1945 | 616..778 |
| `engine` | T3 | common | 4 | 480 | 509 | 203 | 474 | +1.3% | +7.4% | 442..573 | 176..229 |
| `engine` | T3 | rare | 4 | 792 | 840 | 336 | 783 | +1.1% | +7.3% | 786..969 | 314..387 |
| `engine` | T3 | epic | 4 | 1320 | 1399 | 559 | 1304 | +1.2% | +7.3% | 1341..1648 | 536..659 |
| `engine` | T3 | legendary | 4 | 2208 | 2341 | 936 | 2182 | +1.2% | +7.3% | 2307..2854 | 922..1141 |
| `engine` | T4 | common | 0 | 718 | 761 (718..761) | 304 | 923 | -22.2% | -17.6% | 632..857 | 252..342 |
| `engine` | T4 | rare | 0 | 1185 | 1256 (1185..1256) | 502 | 1522 | -22.1% | -17.5% | 1084..1457 | 433..582 |
| `engine` | T4 | epic | 0 | 1975 | 2094 (1975..2094) | 837 | 2537 | -22.2% | -17.5% | 1918..2466 | 767..986 |
| `engine` | T4 | legendary | 0 | 3304 | 3502 (3304..3502) | 1400 | 4244 | -22.1% | -17.5% | 3431..4204 | 1372..1681 |
| `cpu` | T1 | common | 1 | 179 | 190 | 76 | 179 | +0.0% | +6.1% | 168..213 | 67..85 |
| `cpu` | T1 | rare | 1 | 295 | 313 | 125 | 295 | +0.0% | +6.1% | 289..363 | 115..145 |
| `cpu` | T1 | epic | 1 | 492 | 522 | 208 | 491 | +0.2% | +6.3% | 501..607 | 200..242 |
| `cpu` | T1 | legendary | 1 | 823 | 873 | 349 | 821 | +0.2% | +6.3% | 863..1059 | 345..423 |
| `cpu` | T2 | common | 2 | 311 | 311 (311..330) | 124 | 311 | +0.0% | +0.0% | 274..371 | 109..148 |
| `cpu` | T2 | rare | 2 | 514 | 514 (514..545) | 205 | 514 | +0.0% | +0.0% | 482..610 | 192..244 |
| `cpu` | T2 | epic | 2 | 857 | 857 (857..908) | 342 | 856 | +0.1% | +0.1% | 829..1069 | 331..427 |
| `cpu` | T2 | legendary | 2 | 1433 | 1433 (1433..1519) | 573 | 1431 | +0.1% | +0.1% | 1447..1809 | 578..723 |
| `cpu` | T3 | common | 1 | 455 | 509 | 203 | 459 | -0.9% | +10.9% | 446..575 | 178..230 |
| `cpu` | T3 | rare | 1 | 750 | 840 | 336 | 757 | -0.9% | +11.0% | 758..965 | 303..386 |
| `cpu` | T3 | epic | 1 | 1250 | 1400 | 560 | 1262 | -1.0% | +10.9% | 1328..1652 | 531..660 |
| `cpu` | T3 | legendary | 1 | 2091 | 2342 | 936 | 2111 | -0.9% | +10.9% | 2368..2848 | 947..1139 |
| `cpu` | T4 | common | 1 | 680 | 762 | 304 | 673 | +1.0% | +13.2% | 668..856 | 267..342 |
| `cpu` | T4 | rare | 1 | 1122 | 1257 | 502 | 1111 | +1.0% | +13.1% | 1167..1451 | 466..580 |
| `cpu` | T4 | epic | 1 | 1871 | 2095 | 838 | 1851 | +1.1% | +13.2% | 2044..2490 | 817..996 |
| `cpu` | T4 | legendary | 1 | 3129 | 3504 | 1401 | 3097 | +1.0% | +13.1% | 3467..4206 | 1386..1682 |
| `accessory` | T1 | common | 1 | 173 | 173 | 69 | 173 | +0.0% | +0.0% | 149..196 | 59..78 |
| `accessory` | T1 | rare | 1 | 285 | 285 | 114 | 286 | -0.3% | -0.3% | 264..329 | 105..131 |
| `accessory` | T1 | epic | 1 | 476 | 476 | 190 | 477 | -0.2% | -0.2% | 458..567 | 183..226 |
| `accessory` | T1 | legendary | 1 | 796 | 796 | 318 | 798 | -0.3% | -0.3% | 806..974 | 322..389 |
| `accessory` | T2 | common | 2 | 301 | 301 (301..319) | 120 | 311 | -3.2% | -3.2% | 260..359 | 104..143 |
| `accessory` | T2 | rare | 2 | 497 | 497 (497..526) | 198 | 514 | -3.3% | -3.3% | 460..609 | 184..243 |
| `accessory` | T2 | epic | 2 | 828 | 828 (828..877) | 331 | 856 | -3.3% | -3.3% | 829..1041 | 331..416 |
| `accessory` | T2 | legendary | 2 | 1385 | 1385 (1385..1468) | 554 | 1432 | -3.3% | -3.3% | 1434..1767 | 573..706 |
| `accessory` | T3 | common | 1 | 439 | 439 | 175 | 449 | -2.2% | -2.2% | 385..492 | 154..196 |
| `accessory` | T3 | rare | 1 | 725 | 725 | 290 | 741 | -2.2% | -2.2% | 672..826 | 268..330 |
| `accessory` | T3 | epic | 1 | 1208 | 1208 | 483 | 1234 | -2.1% | -2.1% | 1170..1444 | 468..577 |
| `accessory` | T3 | legendary | 1 | 2021 | 2021 | 808 | 2064 | -2.1% | -2.1% | 2074..2448 | 829..979 |
| `accessory` | T4 | common | 1 | 657 | 736 | 294 | 663 | -0.9% | +11.0% | 644..829 | 257..331 |
| `accessory` | T4 | rare | 1 | 1085 | 1215 | 486 | 1094 | -0.8% | +11.1% | 1110..1410 | 444..564 |
| `accessory` | T4 | epic | 1 | 1808 | 2025 | 810 | 1823 | -0.8% | +11.1% | 1969..2406 | 787..962 |
| `accessory` | T4 | legendary | 1 | 3024 | 3387 | 1354 | 3050 | -0.9% | +11.0% | 3330..4075 | 1332..1630 |

## 2. Verification Summary

- **Monotonic tier order (T1 < T2 < T3 < T4 per slot & rarity)**: Q50 Base = **PASS (24/24)**, Q50 Template Median = **PASS (24/24)**.
- **Monotonic rarity order (common < rare < epic < legendary per slot & tier)**: Q50 Base = **PASS (24/24)**, Q50 Template Median = **PASS (24/24)**.
- **200-roll non-overlap across 2 tiers (`max(T_N) < min(T_{N+2})`)**: **PASS (48/48)** (every T1 max < T3 min and every T2 max < T4 min across all 6 slots × 4 rarities).
- **Same-tier slot spread (`max / min <= 1.2x`)**:
  - Q50 Base max spread = **1.123x** (`T3 common (493 / 439)`, strictly `<= 1.200x`).
  - Q50 Template Median max spread = **1.191x** (`T1 common (206 / 173)`, strictly `<= 1.200x`).
- **Key before → after cells**:
  - `armor T2 common`: `318 (259..377)` → Base `338` / Tpl `358 (338..358)`, 200-roll `293..404`
  - `armor T4 common`: `928 (757..1102)` → Base `737` / Tpl `781 (737..781)`, 200-roll `642..880`
  - `engine T4 common`: `923 (792..1047)` → Base `718` / Tpl `761 (718..761)`, 200-roll `632..857`

## 3. Cells Changing `> 25%` vs Old Table (`docs/audit/D1-items-prices.md`)

- **At Q50 No-Affix cell-median level**: **0 / 96** cells differ by `> 25%` (both Base `pure` max delta `-22.2%` on `engine T4` and Template Median max delta `+24.7%` on `sub_weapon T4` stay within `±25%`).
- **At individual template-instance endpoint level (`12 / 96` cells, fallback-rescaled `armor` & `engine`)**:
  - `armor T2 common`: min `259 → 338` (+30.5%) (old T1/T3 fallback `tierPriceScale` distortion removed)
  - `armor T2 rare`: min `428 → 557` (+30.1%) (old T1/T3 fallback `tierPriceScale` distortion removed)
  - `armor T2 epic`: min `714 → 928` (+30.0%) (old T1/T3 fallback `tierPriceScale` distortion removed)
  - `armor T2 legendary`: min `1194 → 1553` (+30.1%) (old T1/T3 fallback `tierPriceScale` distortion removed)
  - `armor T4 common`: max `1102 → 781` (-29.1%) (old T1/T3 fallback `tierPriceScale` distortion removed)
  - `armor T4 rare`: max `1818 → 1289` (-29.1%) (old T1/T3 fallback `tierPriceScale` distortion removed)
  - `armor T4 epic`: max `3029 → 2149` (-29.1%) (old T1/T3 fallback `tierPriceScale` distortion removed)
  - `armor T4 legendary`: max `5067 → 3595` (-29.1%) (old T1/T3 fallback `tierPriceScale` distortion removed)
  - `engine T4 common`: max `1047 → 761` (-27.3%) (old T1/T3 fallback `tierPriceScale` distortion removed)
  - `engine T4 rare`: max `1727 → 1256` (-27.3%) (old T1/T3 fallback `tierPriceScale` distortion removed)
  - `engine T4 epic`: max `2878 → 2094` (-27.2%) (old T1/T3 fallback `tierPriceScale` distortion removed)
  - `engine T4 legendary`: max `4814 → 3502` (-27.3%) (old T1/T3 fallback `tierPriceScale` distortion removed)
- **At 200-roll median level (real items incl. affixes + traits) vs Old Q50 median (`7 / 96` cells)**:
  - `main_weapon T4 epic`: `1907 → 2430` (**+27.4%**; driven by explicit `+4%/affix` & `+6%/trait`)
  - `main_weapon T4 legendary`: `3191 → 4181` (**+31.0%**; driven by explicit `+4%/affix` & `+6%/trait`)
  - `sub_weapon T4 rare`: `1027 → 1327` (**+29.2%**; driven by explicit `+4%/affix` & `+6%/trait`)
  - `sub_weapon T4 epic`: `1711 → 2284` (**+33.5%**; driven by explicit `+4%/affix` & `+6%/trait`)
  - `sub_weapon T4 legendary`: `2862 → 3942` (**+37.7%**; driven by explicit `+4%/affix` & `+6%/trait`)
  - `armor T3 legendary`: `2111 → 2667` (**+26.3%**; driven by explicit `+4%/affix` & `+6%/trait`)
  - `cpu T4 legendary`: `3097 → 3880` (**+25.3%**; driven by explicit `+4%/affix` & `+6%/trait`)
