# Reference: Stat Formulas & Hot/Cold Thresholds

## Key Stats Formulas (Calculate on Query — Never Store)

### Hitters
- AVG = H / AB
- OBP = (H + BB + HBP) / (AB + BB + HBP + SF)
- SLG = (1B + 2×2B + 3×3B + 4×HR) / AB
- OPS = OBP + SLG

### Pitchers
- ERA = (ER / IP) × 9
- WHIP = (H + BB) / IP
- K/9 = (K / IP) × 9
- IP from outs: IP = outs / 3 (e.g., 16 outs = 5.1 IP)

---

## Hot/Cold Thresholds (Weekly Heatmap)

### Hitters (min 20 PA/week)
| Label | OPS |
|-------|-----|
| Hot | >= 0.900 |
| Warm | 0.700–0.899 |
| Neutral | 0.500–0.699 |
| Cold | < 0.500 |

### Starting Pitchers (min 1 GS/week)
| Label | ERA |
|-------|-----|
| Hot | <= 2.50 |
| Warm | 2.51–4.00 |
| Neutral | 4.01–5.00 |
| Cold | > 5.00 |

### Relief Pitchers (min 1 G, 0 GS/week)
| Label | ERA |
|-------|-----|
| Hot | <= 1.00 |
| Warm | 1.01–2.50 |
| Neutral | 2.51–4.00 |
| Cold | > 4.00 |
