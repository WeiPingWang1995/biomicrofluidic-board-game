// 題庫。a[0] 一律是正確答案，主持機顯示時會打亂順序。
// lec：對應哪一週的講義；page：講義頁碼；diff：1 基礎、2 理解、3 進階。
// en：英文示範題。img：答對時的圖；wrong：對應 a[1..3] 的錯誤說明；video：原理影片（檔案就位後才填）。
(function (root) {
  'use strict';

  const QUESTIONS = [
    // ===== 1103 Lecture 8：EWOD 與 OEW =====
    { id: 'L8-01', lec: '1103', page: 'p6', topic: 'EWOD 原理', diff: 1, en: true, img: 'images/questions/L8-01.svg', q: "When voltage increases, what happens to the contact angle of a conductive droplet on an EWOD surface?", a: ["It decreases and the droplet spreads", "It increases and the droplet beads up", "It stays exactly the same", "It rises first, then falls"], why: "In the Lippmann–Young equation, cos θ rises with V², so the contact angle falls and the droplet spreads.", wrong: ["Higher voltage lowers the effective solid–liquid interfacial tension, so the droplet wets more of the surface, not less.", "Voltage does change the angle: cos θ depends on V² in the Lippmann–Young equation.", "The angle never rises. It falls as voltage increases until it reaches contact angle saturation."] },
    { id: 'L8-02', lec: '1103', page: 'p6', topic: 'EWOD 原理', diff: 1, q: '為什麼 EWOD 加正電壓或負電壓，液滴的致動效果相同？', a: ['公式裡的電壓是平方項', '液滴本身不帶任何電', '絕緣層會自動整流', '疏水層抵銷了電壓'], why: '講義 p6 寫明 V² 代表電壓正負不影響致動。' },
    { id: 'L8-03', lec: '1103', page: 'p6', topic: 'EWOD 原理', diff: 1, q: 'EWOD 常用交流電取代直流電，主要好處是什麼？', a: ['減少電荷捕捉', '提高液滴黏度', '降低液滴表面張力', '讓液滴不必接地'], why: 'charge trapping 會抵銷電場，交流電可以減輕這個問題。' },
    { id: 'L8-04', lec: '1103', page: 'p6', topic: 'EWOD 計算', diff: 2, q: '其他條件不變，電壓加倍時，Lippmann–Young 中 cosθ 的增加量變幾倍？', a: ['4 倍', '2 倍', '√2 倍', '不變'], why: 'cosθ 的增加量正比於 V²，電壓加倍就變 4 倍。' },
    { id: 'L8-05', lec: '1103', page: 'p6', topic: 'EWOD 計算', diff: 3, q: '絕緣層厚度變 2 倍、介電常數不變。想得到同樣的接觸角變化，電壓要變幾倍？', a: ['√2 倍', '2 倍', '4 倍', '1/2 倍'], why: 'Δcosθ 正比於 εV²/d，d 變 2 倍時 V² 也要變 2 倍。' },
    { id: 'L8-06', lec: '1103', page: 'p7', topic: '絕緣層', diff: 1, q: '介電常數 k 的定義是什麼？', a: ['材料和真空介電係數的比值', '材料能承受的最高電壓值', '材料和真空導電度的比值', '材料單位厚度能撐的電壓'], why: 'k = ε/ε₀，是兩個同類量的比值，所以沒有單位。' },
    { id: 'L8-07', lec: '1103', page: 'p8', topic: '絕緣層', diff: 1, en: true, img: 'images/questions/L8-07.svg', q: "What does breakdown voltage describe?", a: ["The maximum voltage an insulator withstands before failing", "The minimum voltage that starts a droplet moving", "The voltage that electrolyzes water into bubbles", "The voltage at which the contact angle saturates"], why: "Above the breakdown voltage the insulator conducts, usually leaving permanent damage.", wrong: ["Starting a droplet is about overcoming contact angle hysteresis. Breakdown is about the insulator failing.", "Electrolysis happens in water at about 2 V. The insulator exists to prevent it, and breakdown is that insulator failing.", "Saturation is when the angle stops falling as voltage rises. The insulator can still be intact at that point."] },
    { id: 'L8-08', lec: '1103', page: 'p8', topic: 'EWOD 計算', diff: 2, q: '10 μm 厚的絕緣膜，介電強度 100 MV/m，崩潰電壓約多少？', a: ['1000 V', '100 V', '10 V', '10000 V'], why: '100×10⁶ V/m 乘 10×10⁻⁶ m 等於 1000 V。' },
    { id: 'L8-09', lec: '1103', page: 'p9', topic: '電壓極限', diff: 1, q: '電壓繼續加，接觸角卻停在某個值不再下降，這個現象叫什麼？', a: ['接觸角飽和', '接觸角遲滯', '介電崩潰', '毛細上升'], why: '講義 p9 的實驗點在高電壓處偏離理論線，原因仍未完全了解。' },
    { id: 'L8-10', lec: '1103', page: 'p10', topic: '電壓極限', diff: 2, q: '電壓太高時液滴邊緣發光，同時電潤濕被壓抑，原因是什麼？', a: ['空氣被游離而放電', '液滴開始沸騰', '疏水層在發螢光', '水被電解成氣泡'], why: 'luminescence induced by air ionization suppresses electrowetting。' },
    { id: 'L8-11', lec: '1103', page: 'p11', topic: '表面需求', diff: 1, q: 'EWOD 為什麼要用疏水表面當起點？', a: ['起始角大，可用角度範圍大', '疏水材料的導電性比較好', '疏水表面才能承受交流電', '疏水表面的電容比較大'], why: '飽和角大致固定，起始角越大，能拉開的角度差越大。' },
    { id: 'L8-12', lec: '1103', page: 'p11', topic: '表面需求', diff: 2, q: '講義說表面要 low hysteresis，意思是什麼？', a: ['前進角與後退角差距小', '接觸角接近 0°', '表面完全不導電', '液滴體積變異很小'], why: '遲滯小，液滴的阻力就小，比較容易推動。' },
    { id: 'L8-13', lec: '1103', page: 'p14', topic: '硬體架構', diff: 1, q: 'EWOD 的絕緣層除了儲存電能，還要防止什麼？', a: ['液體被電解', '液滴被染色', '液滴被加熱到沸騰', '光線穿透晶片'], why: '水約 2 V 就會電解，絕緣層讓電流進不來。' },
    { id: 'L8-14', lec: '1103', page: 'p13', topic: '硬體架構', diff: 1, q: '封閉式 EWOD 的上板通常是什麼？', a: ['整片接地電極，表面疏水', '一格格圖案化的控制電極', '不接電的純玻璃，表面親水', '和下板相同的電極陣列'], why: '下板是圖案化控制電極，上板是整片未圖案化的接地電極。' },
    { id: 'L8-15', lec: '1103', page: 'p15', topic: '液滴移動', diff: 1, en: true, img: 'images/questions/L8-15.svg', q: "A droplet sits across two electrodes and only the right one is energized. Which way does it go?", a: ["To the right", "To the left", "It splits in place", "It jumps upward"], why: "The contact angle falls on the right side, so the two ends have different capillary pressures and the droplet moves toward the energized electrode.", wrong: ["The left electrode is off, so nothing changes on that side. The droplet is pulled toward the side whose contact angle falls.", "Splitting needs electrodes on at both ends with the middle off. One energized electrode only moves the droplet.", "The driving force acts along the surface, so the droplet slides sideways and stays on the chip."] },
    { id: 'L8-16', lec: '1103', page: 'p16', topic: '液滴移動', diff: 2, q: '封閉式 EWOD 中，液滴左端電極通電。液滴內部的壓力怎麼分布？', a: ['左端較低，壓力由右往左遞減', '左端較高，壓力由左往右遞減', '左右完全相等', '只有上下有壓力差'], why: '左端變親水，彎曲半徑變大，毛細壓較低，液滴往左跑。' },
    { id: 'L8-17', lec: '1103', page: 'p17', topic: '液滴操作', diff: 1, en: true, img: 'images/questions/L8-17.svg', q: "To split one droplet into two, how should the electrodes be switched?", a: ["Left and right on, middle off", "Middle on, left and right off", "All electrodes on", "All electrodes off"], why: "The two sides pull the droplet outward, the middle narrows, and it pinches off into two droplets.", wrong: ["This gathers the droplet toward the middle, which is the opposite of pulling it apart.", "With every electrode on, no side pulls harder than another, so nothing stretches the droplet apart.", "With no voltage there is no electrowetting force, so the droplet just stays where it is."] },
    { id: 'L8-18', lec: '1103', page: 'p19', topic: '液滴操作', diff: 2, q: '封閉式晶片切不斷液滴時，兩板間距 h 應該怎麼調？', a: ['調小', '調大', '先調大再調小', 'h 和切割無關'], why: '分裂條件含 1/(h/2)，h 越小，同樣角度差換到的壓力越大。' },
    { id: 'L8-19', lec: '1103', page: 'p19', topic: '液滴操作', diff: 2, q: '講義例題算出 d 要小於約 126 μm。模擬中 d = 130 μm 的結果是？', a: ['液滴切不開', '液滴切成三顆', '液滴立刻蒸發', '液滴切開但體積不均'], why: '模擬圖中 120 μm 能切開，130、140 μm 切不開。' },
    { id: 'L8-20', lec: '1103', page: 'p20', topic: '液滴生成', diff: 1, q: '講義把哪一步稱為 EWOD 平台最關鍵的操作？', a: ['液滴分注（生成）', '液滴合併（merging）', '液滴分裂（splitting）', '液滴混合（mixing）'], why: '多出來的表面要花能量，分注時的能量曲線要先爬坡。' },
    { id: 'L8-21', lec: '1103', page: 'p22', topic: '液滴生成', diff: 2, q: '用管子穿過上板注入液體的做法，主要缺點是什麼？', a: ['玻璃上板鑽孔很貴', '液滴一定會被污染', '只能用在開放式架構', '不能用交流電驅動'], why: '導管注入效果好又穩，代價是玻璃加工費用。' },
    { id: 'L8-22', lec: '1103', page: 'p24', topic: '混合', diff: 1, q: '液滴來回搖動混合時，提高致動頻率的效果是？', a: ['混合變快，但效益逐漸遞減', '混合時間幾乎維持不變', '頻率越高，混合反而越慢', '混合時間隨頻率無限縮短'], why: '1 Hz 約 34 秒，8 Hz 約 12 秒，16 Hz 約 10 秒。' },
    { id: 'L8-23', lec: '1103', page: 'p25', topic: '混合', diff: 2, en: true, img: 'images/questions/L8-23.svg', q: "Why does folding a droplet along a looped path speed up mixing?", a: ["Thinner layers shorten the diffusion distance", "The loop keeps heating the droplet", "Centrifugal force flings molecules outward", "The voltage breaks molecules apart"], why: "Multi-lamination folds the liquid into thinner layers, so molecules have less distance to diffuse.", wrong: ["Heating is not the mechanism. The gain comes from the geometry of the layers.", "Droplets on a chip are too small and slow for centrifugal force to matter. Surface forces and diffusion dominate.", "Electrowetting moves the droplet, and it does not break molecules. Mixing still relies on diffusion across layers."] },
    { id: 'L8-24', lec: '1103', page: 'p26', topic: '檢測', diff: 1, q: '講義的葡萄糖晶片怎麼判斷濃度？', a: ['看吸光度隨時間上升的斜率', '看液滴接觸角隨時間的變化', '看液滴在電極間的移動速度', '看液滴合併後的體積大小'], why: '濃度越高，吸光度上升越快，斜率就越大。' },
    { id: 'L8-25', lec: '1103', page: 'p26', topic: '檢測', diff: 2, q: '光要穿過晶片，所以講義的檢測晶片用什麼當透明電極？', a: ['ITO（氧化銦錫）', 'Parylene', 'Teflon AF', '矽油'], why: 'Parylene 是絕緣層，Teflon AF 是疏水層，ITO 是透明電極。' },
    { id: 'L8-26', lec: '1103', page: 'p28', topic: '液滴操作', diff: 2, q: 'EWOD 怎麼把液滴裡的粒子濃縮？', a: ['先用電泳集中粒子，再切開液滴', '先蒸發一部分水，再加入試劑', '反覆撞擊晶片邊緣讓粒子聚集', '提高接觸角讓粒子沉到底部'], why: '切開後稀的送廢液槽，濃的拿去檢測。' },
    { id: 'L8-27', lec: '1103', page: 'p29', topic: '非生醫應用', diff: 1, q: '電潤濕可變焦透鏡為什麼不用移動鏡片就能對焦？', a: ['電壓改變兩種液體介面的曲率', '電壓改變液體的顏色', '液體會自己蒸發調整厚度', '電壓讓鏡頭外殼變形'], why: '導電液和絕緣液的介面就是透鏡，接觸角變了曲率也變。' },
    { id: 'L8-28', lec: '1103', page: 'p30', topic: '非生醫應用', diff: 2, q: '電潤濕顯示器加電壓後，像素裡的有色油會怎樣？', a: ['被水推到角落，露出底板', '被電解成氣泡後離開像素', '均勻攤開，蓋滿整個像素', '吸收水分後變成透明'], why: '水去搶疏水面，油被推開，圖中白區約 80%。' },
    { id: 'L8-29', lec: '1103', page: 'p32', topic: 'OEW', diff: 1, q: 'OEW 和一般 EWOD 最大的不同是什麼？', a: ['用光決定哪裡是電極', '完全不需要電壓', '只能移動油滴', '液滴不需要疏水表面'], why: '絕緣層底下多一層光導材料，光照到哪裡，哪裡就像電極。' },
    { id: 'L8-30', lec: '1103', page: 'p34', topic: 'OEW', diff: 2, q: 'a-Si:H 照光後電阻下降，對絕緣層有什麼影響？', a: ['絕緣層分到的電壓變大', '絕緣層的厚度變大', '絕緣層立刻崩潰', '絕緣層分到的電壓變成零'], why: '三段阻抗串聯，光導層電阻下降後，電壓就落到絕緣層上。' },
    { id: 'L8-31', lec: '1103', page: 'p35', topic: 'OEW', diff: 3, q: 'OEW 頻率落在約 0.1 到 100 Hz 時，液滴會怎樣？', a: ['只會振動，不是工作區', '移動速度最快', '絕緣層立刻崩潰', '粒子開始被 DEP 抓住'], why: '約 100 Hz 到數十 kHz 才是 OEW 工作區。' },
    { id: 'L8-32', lec: '1103', page: 'p37', topic: 'OEW', diff: 3, q: '同一片 OEW+OET 晶片，用窄光圖案加較高頻率時，什麼在動？', a: ['粒子動，液滴本身不動', '整顆液滴往光的方向走', '液滴和粒子一起往前走', '液滴和粒子都完全不動'], why: '窄光圖案造成不均勻電場，粒子受 DEP 力移動。' },
    { id: 'L8-33', lec: '1103', page: 'p38', topic: 'OEW', diff: 2, q: '同一片晶片靠什麼切換「搬液滴」和「搬粒子」？', a: ['頻率', '液滴的顏色', '晶片的擺放方向', '環境溫度'], why: '電潤濕的力峰值約 10⁴ Hz 量級，DEP 約 10⁵ Hz。' },
    { id: 'L8-34', lec: '1103', page: 'p41', topic: '總結', diff: 2, q: '講義說 EWOD 是 quasi digital（近似數位），指的是什麼？', a: ['電極上只有有液滴或沒液滴', '電壓只能是 0 V 或 1 V', '晶片一定要接電腦才能動', '液滴的體積只能有兩種'], why: '狀態明確，所以容易做品質管理。' },
    { id: 'L8-35', lec: '1103', page: 'p42', topic: '總結', diff: 1, q: '下列哪一項是講義列出的 EWOD 挑戰？', a: ['液滴體積精度差，CV 約 20%', '液滴移動太慢，每格要數分鐘', '晶片無法重新程式化流程', '液滴完全無法合併或分裂'], why: 'p42 列出遲滯、分注、電解、疏水面穩定性和體積精度。' },

    // ===== 1027 Lecture 7：潤濕與表面張力 =====
    { id: 'L7-01', lec: '1027', page: 'p21', topic: '潤濕', diff: 1, q: '水滴接觸角大於 90°，這個表面屬於？', a: ['疏水', '親水', '超親水', '導電'], why: 'θ 小於 90° 親水，大於 90° 疏水。' },
    { id: 'L7-02', lec: '1027', page: 'p5', topic: '潤濕', diff: 1, q: '水分子拉水分子、水黏在玻璃上，這兩種力分別叫什麼？', a: ['內聚力、附著力', '附著力、內聚力', '黏滯力、浮力', '升力、阻力'], why: '同類分子互相吸引是內聚力，不同物質黏附是附著力。' },
    { id: 'L7-03', lec: '1027', page: 'p7', topic: '潤濕', diff: 1, q: 'Young 定律描述的是什麼？', a: ['接觸線上三個界面張力的平衡', '液體內部壓力隨深度的增加', '流量和壓力差之間的正比關係', '液柱斷裂的最不穩定波長'], why: 'γ_SG = γ_SL + γ_LG cosθ，平衡時決定接觸角。' },
    { id: 'L7-04', lec: '1027', page: 'p6', topic: '表面張力', diff: 1, q: '講義表格列出的液體裡，哪一個對空氣的表面張力最大？', a: ['汞', '水', '乙醇', 'PDMS'], why: '汞 425.4 mN/m，水 72.8，乙醇 22.1，PDMS 19.0。' },
    { id: 'L7-05', lec: '1027', page: 'p11', topic: '表面張力', diff: 2, q: '局部加熱液面時，熱毛細流的表面流向哪裡？', a: ['從熱端流向冷端', '從冷端流向熱端', '垂直往下', '不會流動'], why: '冷的地方表面張力大，表面被拉向冷端。' },
    { id: 'L7-06', lec: '1027', page: 'p12', topic: '表面張力', diff: 1, q: '界面活性劑濃度超過 CMC 後，表面張力會怎樣？', a: ['趨於平坦，多的分子形成微胞', '繼續線性下降，最後到零', '突然上升，回到純水的數值', '開始週期性地高低振盪'], why: '界面站滿了，多出來的分子在水裡團成微胞。' },
    { id: 'L7-07', lec: '1027', page: 'p13', topic: '表面張力', diff: 2, q: '肥皂船的船尾放肥皂，船為什麼會往前跑？', a: ['船頭側表面張力大，把船拉走', '肥皂溶解時從船尾噴出氣體', '肥皂讓船尾的水變得比較重', '肥皂放熱讓船尾水溫升高'], why: '這是 Marangoni 效應，表面流由低張力流向高張力。' },
    { id: 'L7-08', lec: '1027', page: 'p15', topic: '液滴形成', diff: 2, q: '細長液柱為什麼會自己斷成一顆顆液滴？', a: ['斷成液滴後總表面能較低', '重力把液柱的頸部壓斷', '液柱內部的液體開始沸騰', '液體的密度沿液柱突然改變'], why: '這是 Rayleigh–Plateau 不穩定。' },
    { id: 'L7-09', lec: '1027', page: 'p17', topic: '液滴形成', diff: 1, q: 'Bond 數很小代表什麼？', a: ['表面張力主宰，液滴近似圓球', '重力主宰，液滴被壓扁', '慣性力主宰，流動變紊流', '擴散主宰，液滴很快消失'], why: 'Bo 是重力和表面張力的比值。' },
    { id: 'L7-10', lec: '1027', page: 'p23', topic: '遲滯', diff: 2, q: '前進角 θ_A、後退角 θ_R 和 Young 角的大小關係是？', a: ['θ_A ≥ θ_Young ≥ θ_R', 'θ_R ≥ θ_Young ≥ θ_A', 'θ_Young ≥ θ_A ≥ θ_R', '三個永遠相等'], why: '表面缺陷會卡住接觸線，造成遲滯。' },
    { id: 'L7-11', lec: '1027', page: 'p25', topic: '粗糙表面', diff: 2, q: '依 Wenzel 定律，把原本疏水的表面做粗糙，會變得？', a: ['更疏水', '變親水', '不受影響', '變成導電'], why: 'cosθ* = r cosθ 且 r ≥ 1，粗糙度會放大原本的潤濕特性。' },
    { id: 'L7-12', lec: '1027', page: 'p26', topic: '粗糙表面', diff: 2, q: 'Cassie 狀態的液滴和表面是什麼關係？', a: ['坐在柱頂，底下包著空氣', '灌滿所有溝槽，完全潤濕', '被電場懸浮在表面上方', '滲進材料內部，被完全吸收'], why: '空氣部分的接觸角視為 180°，所以液滴又圓又滾得走。' },
    { id: 'L7-13', lec: '1027', page: 'p32', topic: 'Laplace 壓力', diff: 2, q: '大小兩顆液滴被薄膜接通，液體會往哪流？', a: ['小液滴流向大液滴', '大液滴流向小液滴', '兩顆都不動', '液體平分給兩顆'], why: 'ΔP = 2γ/R，半徑小內壓大，小液滴會被吃掉。' },
    { id: 'L7-14', lec: '1027', page: 'p34', topic: 'Laplace 壓力', diff: 3, q: '親水錐形通道會把液體往哪裡吸？', a: ['往窄端', '往寬端', '左右來回振盪', '不會移動'], why: '窄端半徑小，凹液面壓力更低，液體往窄端走。' },
    { id: 'L7-15', lec: '1027', page: 'p35', topic: 'Laplace 壓力', diff: 2, q: '依 Laplace 壓力，相連的小肺泡應該塌陷，實際上靠什麼避免？', a: ['肺泡表面的界面活性劑', '肋骨和胸廓的機械支撐', '肺微血管的血液壓力', '呼吸道表面的黏液纖毛'], why: '界面活性劑降低了表面張力。' },
    { id: 'L7-16', lec: '1027', page: 'p38', topic: '液滴驅動', diff: 3, q: '液滴什麼時候才會真的動起來？', a: ['驅動力大於遲滯造成的阻力', '接觸角等於 90°', '液滴半徑大於 1 mm', '表面張力等於零'], why: '驅動力來自兩側曲率差，阻力來自接觸角遲滯。' },

    // ===== 1020 Lecture 6：微加工 =====
    { id: 'L6-01', lec: '1020', page: 'p11', topic: '光刻', diff: 1, q: '正型光阻的照光區域，顯影後會怎樣？', a: ['被洗掉', '留下來變硬', '變成金屬', '變成導電層'], why: '正型照光處變得更可溶，負型則相反。' },
    { id: 'L6-02', lec: '1020', page: 'p11', topic: '光刻', diff: 1, q: 'SU-8 屬於哪一種光阻？', a: ['負型，照光處交聯硬化', '正型，照光處更可溶', '不感光的矽膠', '金屬蝕刻液'], why: 'SU-8 是常見負型厚光阻，1103 p21 的儲液結構也用它。' },
    { id: 'L6-03', lec: '1020', page: 'p12', topic: '光刻', diff: 1, q: '旋轉塗佈時，轉速變快，光阻膜會？', a: ['變薄', '變厚', '厚度不變', '完全被甩乾淨'], why: '轉速越快，膜越薄。' },
    { id: 'L6-04', lec: '1020', page: 'p19', topic: '圖案轉印', diff: 2, q: 'Lift-off 和標準蝕刻的順序差在哪？', a: ['先做光阻圖案，再鍍金屬', '先鍍金屬，再做光阻圖案', '先蝕刻基板，再鍍光阻', '先鍍金屬，再用雷射切割'], why: '光阻連同上面的金屬一起洗掉，只留下洞裡的金屬。' },
    { id: 'L6-05', lec: '1020', page: 'p20', topic: '圖案轉印', diff: 2, q: '濕蝕刻做細圖案時最大的問題是什麼？', a: ['等向性蝕刻會往側邊咬', '蝕刻速度太慢', '一定要在真空中進行', '蝕刻液會發光'], why: '乾蝕刻可以做出非等向性的垂直牆。' },
    { id: 'L6-06', lec: '1020', page: 'p31', topic: 'PDMS', diff: 1, q: 'Sylgard 184 的硬化劑和主劑常用什麼比例？', a: ['1:10', '1:1', '1:100', '10:1'], why: '常用比例是硬化劑 1 份、主劑 10 份。' },
    { id: 'L6-07', lec: '1020', page: 'p34', topic: 'PDMS', diff: 2, q: 'PDMS 經過氧電漿處理後，表面會怎麼變？', a: ['由疏水變親水，可和玻璃接合', '由親水變疏水，更不沾水', '變成導電', '變成不透明'], why: '表面的 Si-CH₃ 被換成親水的 Si-OH。' },
    { id: 'L6-08', lec: '1020', page: 'p38', topic: 'PDMS', diff: 2, q: 'PDMS 結構的深寬比超出 0.2 到 2 時，容易發生什麼事？', a: ['結構倒塌或塌陷', '結構變成導電', 'PDMS 自動硬化', '光阻被洗掉'], why: 'PDMS 太軟，太細高的結構會倒，太扁平會塌。' },
    { id: 'L6-09', lec: '1020', page: 'p44', topic: '閥與幫浦', diff: 2, q: 'PDMS 氣動閥怎麼關閉流體通道？', a: ['加壓讓薄膜鼓起，壓扁通道', '加熱讓液體凝固', '加電壓讓液體改變方向', '用光把通道照黑'], why: '上層是控制氣道，下層是流體通道，中間是 PDMS 薄膜。' },
    { id: 'L6-10', lec: '1020', page: 'p45', topic: '閥與幫浦', diff: 2, q: '三閥蠕動幫浦的主要缺點是什麼？', a: ['流動是脈衝式的', '無法做成雙向', '不能整合在晶片上', '不能用程式控制'], why: '三個閥依序開關，液體一段一段往前推。' },

    // ===== 1013 Lecture 5：質量傳輸 =====
    { id: 'L5-01', lec: '1013', page: 'p3', topic: '質量傳輸', diff: 1, q: 'Péclet 數比較的是哪兩種傳輸？', a: ['對流與擴散', '重力與浮力', '電泳與電滲', '慣性與黏性'], why: 'Pe 很大時由水流主導，很小時由擴散主導。慣性與黏性是 Re。' },
    { id: 'L5-02', lec: '1013', page: 'p31', topic: '混合', diff: 2, q: '擴散距離縮短為 1/10，擴散時間大約變成多少？', a: ['1/100', '1/10', '1/1000', '不變'], why: 't ~ L²/D，時間和距離平方成正比。' },
    { id: 'L5-03', lec: '1013', page: 'p31', topic: '混合', diff: 1, q: '講義的表格中，染料在 100 μm 微系統裡的混合時間約多少？', a: ['10 秒', '10⁻³ 秒', '1 天', '1000 秒'], why: '10⁻³ 秒是 1 μm，1 天是 10 cm 水杯，1000 秒是 100 μm 的酵素和蛋白質。' },
    { id: 'L5-04', lec: '1013', page: 'p30', topic: '混合', diff: 2, q: '微流道 Re 很小，為什麼還能做混沌混合？', a: ['隨時間變化的層流也能有混沌軌跡', '微流道裡其實一直是紊流', '分子布朗運動會自動形成混沌', '流速夠快時黏性就完全消失'], why: '混沌和紊流不同，拉長和折疊讓擴散距離變短。' },
    { id: 'L5-05', lec: '1013', page: 'p26', topic: '分散', diff: 2, q: 'Taylor-Aris 分散對分離和混合的影響是？', a: ['不利分離，有利混合', '有利分離，不利混合', '兩者都有利', '兩者都不利'], why: '樣品帶被拉長，峰變寬，但沿流向的有效擴散變大。' },
    { id: 'L5-06', lec: '1013', page: 'p36', topic: '分離', diff: 2, q: '毛細管電泳中，哪一類分子最先到達陰極端的偵測器？', a: ['陽離子', '中性分子', '陰離子', '三者同時'], why: '陽離子的電滲流和電泳同方向，所以最快。' },
    { id: 'L5-07', lec: '1013', page: 'p44', topic: '分離', diff: 2, q: '凝膠滲透層析中，大分子和小分子誰先流出來？', a: ['大分子', '小分子', '同時流出', '都不會流出'], why: '大分子進不了小孔，直接從顆粒間隙通過。' },
    { id: 'L5-08', lec: '1013', page: 'p34', topic: '分離', diff: 3, q: '管狀收縮效應（Segré–Silberberg）中，粒子大約聚集在圓管哪裡？', a: ['r/R 約 0.6 處', 'r/R 約 0 處（中央）', 'r/R 約 1 處（管壁）', 'r/R 約 0.2 處'], why: '剪切梯度升力和壁面升力在此打平。' },
    { id: 'L5-09', lec: '1013', page: 'p53', topic: '分離', diff: 2, q: 'DLD 柱陣列中，半徑大於車道寬度的大粒子怎麼走？', a: ['每排被推一次，沿傾斜方向走', '在柱間走之字形，平均直走', '被第一排柱子永久卡住', '隨布朗運動在車道間亂走'], why: '小粒子走之字形，大粒子走 bump mode，分離結果由大小決定。' },

    // ===== 1006 Lecture 4：電動力學 =====
    { id: 'L4-01', lec: '1006', page: 'p16', topic: 'DEP', diff: 1, q: 'DEP 和電泳最大的差別是什麼？', a: ['DEP 粒子不需帶淨電荷', 'DEP 粒子一定要帶淨電荷', 'DEP 一定要用直流電場', 'DEP 只能用在均勻電場'], why: 'DEP 靠電場極化粒子，電泳靠粒子本身帶電。' },
    { id: 'L4-02', lec: '1006', page: 'p16', topic: 'DEP', diff: 1, q: '均勻電場裡，電中性粒子受到的 DEP 合力是？', a: ['零', '朝正極', '朝負極', '隨粒子大小而定'], why: '粒子兩側的誘發電荷受力相等、方向相反，要不均勻電場才有合力。' },
    { id: 'L4-03', lec: '1006', page: 'p23', topic: 'DEP', diff: 2, q: 'positive DEP 的粒子會被拉往哪裡？', a: ['電場較強處，通常是電極邊緣', '電場較弱處，通常是電極間中點', '液體表面', '晶片出口'], why: '粒子比介質更容易極化時是 pDEP，反之是 nDEP。' },
    { id: 'L4-04', lec: '1006', page: 'p5', topic: '電雙層', diff: 2, q: '溶液離子濃度升高，Debye length 會怎麼變？', a: ['變短，電雙層被壓薄', '變長，電雙層變厚', '不變', '先變長再變短'], why: 'λ_D 和濃度的平方根成反比。' },
    { id: 'L4-05', lec: '1006', page: 'p10', topic: '電滲流', diff: 2, q: '電滲流的速度分布大致是什麼形狀？', a: ['接近柱塞狀', '拋物線，中間最快', '管壁最快，中間靜止', '完全隨機'], why: '電場拖動靠牆的離子，黏性再把整個液體帶著走。' },
    { id: 'L4-06', lec: '1006', page: 'p15', topic: '電泳', diff: 1, q: '電泳達到等速時，哪兩個力互相平衡？', a: ['電場力與黏性阻力', '重力與浮力', '升力與阻力', '表面張力與毛細力'], why: 'q_s E = 6πη u r₀。' },
    { id: 'L4-07', lec: '1006', page: 'p27', topic: 'DEP', diff: 2, q: '球形粒子 Clausius-Mossotti 因子實部的理論範圍是？', a: ['-1/2 到 1', '0 到 1', '-1 到 1', '-1/2 到 1/2'], why: '這個範圍決定 DEP 力的上下限。' },
    { id: 'L4-08', lec: '1006', page: 'p47', topic: 'MHD', diff: 3, q: 'MHD 流和電滲流最主要的差別是什麼？', a: ['勞侖茲力作用在整個流體體積上', 'MHD 不需要導電液體', 'MHD 只作用在壁面薄層', 'MHD 不需要磁場'], why: '電滲流的力只作用在 EDL 薄層。' },
    { id: 'L4-09', lec: '1006', page: 'p50', topic: '縮放定律', diff: 1, q: '尺度縮小時，為什麼表面力比體積力更重要？', a: ['面積隨 L²、體積隨 L³ 變化', '面積隨 L³、體積隨 L² 變化', '面積和體積都隨 L² 變化', '面積和體積都隨 L³ 變化'], why: '尺度越小，表面積和體積的比值越大。' },

    // ===== 0922、0929：流體基礎 =====
    { id: 'L2-01', lec: '0922', page: '無因次數群段落', topic: '無因次數', diff: 1, q: '雷諾數 Re 比較的是哪兩種力？', a: ['慣性力與黏性力', '重力與表面張力', '電場力與黏性力', '升力與阻力'], why: '微流體常見 Re ≪ 1，黏性主導，流動是層流。' },
    { id: 'L2-02', lec: '0922', page: '無因次數群段落', topic: '無因次數', diff: 1, q: 'Knudsen 數 Kn 比較的是什麼？', a: ['平均自由徑與流動特徵長度', '流速與流體中的音速大小', '動量擴散與熱擴散的速度', '對流傳輸與擴散傳輸的強度'], why: 'Kn 越大，越要考慮連續介質假設是否還成立。' },
    { id: 'L3-01', lec: '0929', page: 'p27', topic: '低雷諾數流', diff: 2, q: '低雷諾數流有什麼特別性質？', a: ['線性，流動可逆（擴散除外）', '非線性，流動一定不可逆', '流速和壓力梯度完全無關', '一定會變成紊流'], why: 'Stokes 方程式是線性的，而且不含時間項。' },
    { id: 'L3-02', lec: '0929', page: 'p28', topic: '低雷諾數流', diff: 2, q: '水在 10 μm 通道以 1 mm/s 流動，Re 約多少？', a: ['10⁻²', '10²', '1', '10⁴'], why: '講義的算例：這是明顯的低雷諾數流。' },
    { id: 'L3-03', lec: '0929', page: 'p31', topic: '流體網路', diff: 1, q: '流體網路的電路類比中，電位差對應什麼？', a: ['壓力差', '流量', '流阻', '黏度'], why: 'Δp = Q·R_H，對應 ΔV = IR。' },
    { id: 'L3-04', lec: '0929', page: 'p31', topic: '流體網路', diff: 2, q: '圓管半徑減半，流阻變幾倍？', a: ['16 倍', '2 倍', '4 倍', '8 倍'], why: 'R_H = 8μL/(πa⁴)，流阻和半徑四次方成反比。' },
    { id: 'L3-05', lec: '0929', page: 'p33', topic: 'Darcy 定律', diff: 2, q: 'Darcy 定律中，流量和水頭差、長度的關係是？', a: ['和水頭差成正比，和長度成反比', '和水頭差成反比，和長度成正比', '都成正比', '都無關'], why: 'Q = KA Δh/L。' },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = QUESTIONS;
  root.QUESTIONS = QUESTIONS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
