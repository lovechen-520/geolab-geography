/* GeoLab 题库数据（window.GEO_QUIZ）
   格式遵循 SPEC §7：id / type / moduleId / pointId / question / options / answer / analysis / difficulty
   - single、judge：answer 为选项索引；multiple：answer 为升序索引数组；short：answer 为关键词数组
   - 共 60 题，5 个模块各 12 题；单选 30、多选 10、判断 10、简答 10
   - 教材口径：人教版高中地理；案例以中国为主；中国版图表述遵守国家规范 */

window.GEO_QUIZ = [
  /* ================= 必修一 · 自然地理 ================= */
  {
    id: "q001",
    type: "single",
    moduleId: "bixiu1",
    pointId: "bixiu1-1",
    question: "地球在太阳系八大行星中，轨道位置介于哪两颗行星之间？",
    options: ["水星与金星之间", "金星与火星之间", "火星与木星之间", "木星与土星之间"],
    answer: 1,
    analysis: "八大行星按距日由近及远依次为水星、金星、地球、火星、木星、土星、天王星、海王星，因此地球位于金星与火星之间。",
    difficulty: 1
  },
  {
    id: "q002",
    type: "single",
    moduleId: "bixiu1",
    pointId: "bixiu1-1",
    question: "下列属于地球存在生命的「自身条件」的是",
    options: ["太阳光照长期稳定", "日地距离适中，地表温度适宜", "大小行星各行其道、互不干扰", "太阳活动周期约为 11 年"],
    answer: 1,
    analysis: "自身条件包括适宜的温度（日地距离适中）、适合生物呼吸的大气（质量体积适中）和液态水；太阳光照稳定、行星际空间安全属于外部条件。",
    difficulty: 1
  },
  {
    id: "q003",
    type: "single",
    moduleId: "bixiu1",
    pointId: "bixiu1-2",
    question: "太阳活动强弱的主要标志及其平均周期分别是",
    options: ["黑子，约 11 年", "耀斑，约 1 年", "太阳风，约 76 年", "日珥，约 100 年"],
    answer: 0,
    analysis: "黑子的多少和大小是太阳活动强弱的主要标志，太阳活动平均周期约为 11 年；耀斑是太阳活动最激烈的显示。",
    difficulty: 1
  },
  {
    id: "q004",
    type: "single",
    moduleId: "bixiu1",
    pointId: "bixiu1-3",
    question: "多云的夜晚气温通常不会太低，主要原因是",
    options: ["云层反射了太阳短波辐射", "大气逆辐射较强，补偿了地面损失的热量", "地面长波辐射明显减弱", "云层对太阳辐射的削弱作用强"],
    answer: 1,
    analysis: "夜间没有太阳辐射，云层中的水汽能强烈吸收地面长波辐射并加强大气逆辐射，把热量还给地面，起到保温作用。",
    difficulty: 1
  },
  {
    id: "q005",
    type: "single",
    moduleId: "bixiu1",
    pointId: "bixiu1-4",
    question: "目前人类活动影响水循环最显著的环节是",
    options: ["蒸发", "水汽输送", "地表径流", "降水"],
    answer: 2,
    analysis: "修建水库、跨流域调水、城市化改变下渗与径流等人类活动，主要改变地表径流的数量与空间分布。",
    difficulty: 1
  },
  {
    id: "q006",
    type: "single",
    moduleId: "bixiu1",
    pointId: "bixiu1-5",
    question: "河流流出山口后，因坡度骤减、泥沙堆积，常形成的地貌是",
    options: ["三角洲", "冲积扇", "牛轭湖", "V 形谷"],
    answer: 1,
    analysis: "河流出山口处地势突然变缓，水流分散、搬运能力下降，泥沙呈扇状堆积形成冲积扇（洪积扇）；三角洲形成于入海（湖）口。",
    difficulty: 2
  },
  {
    id: "q007",
    type: "multiple",
    moduleId: "bixiu1",
    pointId: "bixiu1-2",
    question: "太阳活动增强时，可能对地球产生的影响有",
    options: ["扰动电离层，影响无线电短波通信", "使全球各地气温同步升高", "扰动地球磁场，产生磁暴", "高纬度地区出现极光"],
    answer: [0, 2, 3],
    analysis: "太阳活动会扰动电离层与磁场，高能带电粒子冲进高纬高空大气形成极光；但太阳活动对气候的影响复杂，不会使全球各地气温同步升高。",
    difficulty: 2
  },
  {
    id: "q008",
    type: "multiple",
    moduleId: "bixiu1",
    pointId: "bixiu1-4",
    question: "下列关于水循环的叙述，正确的有",
    options: ["海陆间循环使陆地水不断得到补充更新", "水循环促进物质迁移并在各圈层间传输热量", "城市地面硬化会增大下渗量", "植树造林有利于增加下渗"],
    answer: [0, 1, 3],
    analysis: "城市地面硬化使下渗减少、地表径流增大，易加剧内涝，因此第三项错误；其余三项均符合水循环原理。",
    difficulty: 3
  },
  {
    id: "q009",
    type: "judge",
    moduleId: "bixiu1",
    pointId: "bixiu1-3",
    question: "大气增温的直接热源主要是太阳短波辐射。",
    options: ["正确", "错误"],
    answer: 1,
    analysis: "大气对太阳短波辐射吸收很少，大气增温的直接热源是地面长波辐射，太阳辐射是地球能量的根本来源。",
    difficulty: 1
  },
  {
    id: "q010",
    type: "judge",
    moduleId: "bixiu1",
    pointId: "bixiu1-5",
    question: "河流下游只发生堆积作用，不会发生侵蚀。",
    options: ["正确", "错误"],
    answer: 1,
    analysis: "下游以堆积为主，但侧蚀仍然存在，凹岸不断被侵蚀、凸岸堆积，只是不同河段主导的侵蚀方式不同。",
    difficulty: 2
  },
  {
    id: "q011",
    type: "short",
    moduleId: "bixiu1",
    pointId: "bixiu1-1",
    question: "简述地球存在生命的自身条件。",
    answer: ["适宜的温度", "适合生物呼吸的大气", "液态水"],
    analysis: "日地距离适中使地表温度适宜；质量体积适中使引力能吸附大气；长期存在液态水，三者共同构成生命存在的自身条件。",
    difficulty: 2
  },
  {
    id: "q012",
    type: "short",
    moduleId: "bixiu1",
    pointId: "bixiu1-4",
    question: "从水循环角度说明城市地面硬化为什么会加剧内涝。",
    answer: ["下渗减少", "地表径流增大", "汇流速度加快"],
    analysis: "地面硬化替代了透水地面，降水下渗减少，更多雨水转化为地表径流；同时汇流速度加快，短时间内流量集中，超过排水能力即形成内涝。",
    difficulty: 3
  },

  /* ================= 必修二 · 人文地理 ================= */
  {
    id: "q013",
    type: "single",
    moduleId: "bixiu2",
    pointId: "bixiu2-1",
    question: "揭示我国人口东密西疏格局、长期保持稳定的重要界线是",
    options: ["黑河—腾冲线", "秦岭—淮河线", "大兴安岭—太行山线", "昆仑山—祁连山线"],
    answer: 0,
    analysis: "黑河—腾冲线又称胡焕庸线，线东南面积约占全国四成多，人口却占九成以上，直观反映我国人口分布东多西少。",
    difficulty: 1
  },
  {
    id: "q014",
    type: "single",
    moduleId: "bixiu2",
    pointId: "bixiu2-1",
    question: "影响环境人口容量的首要因素是",
    options: ["资源", "科技发展水平", "地区对外开放程度", "人均消费水平"],
    answer: 0,
    analysis: "资源是环境人口容量的首要因素；科技水平、开放程度与容量呈正相关，人均消费水平与容量呈负相关。",
    difficulty: 1
  },
  {
    id: "q015",
    type: "single",
    moduleId: "bixiu2",
    pointId: "bixiu2-2",
    question: "下列现象属于人口迁移的是",
    options: ["春节返乡过年", "周末到郊区旅游", "大学毕业后到上海工作并落户", "到外地出差一周"],
    answer: 2,
    analysis: "人口迁移需满足居住地长期或永久改变、跨越行政区域界线、持续一定时间；旅游、出差、短期返乡属于人口流动而非迁移。",
    difficulty: 1
  },
  {
    id: "q016",
    type: "single",
    moduleId: "bixiu2",
    pointId: "bixiu2-3",
    question: "衡量一个地区城镇化水平最主要的指标是",
    options: ["城镇人口数量", "城镇人口占总人口的比重", "城镇建设用地规模", "城市数量"],
    answer: 1,
    analysis: "城镇化的重要标志包括城镇人口增加、城镇用地扩大，其中城镇人口占总人口比重是衡量城镇化水平的最主要指标。",
    difficulty: 1
  },
  {
    id: "q017",
    type: "single",
    moduleId: "bixiu2",
    pointId: "bixiu2-5",
    question: "制糖厂多布局在甘蔗或甜菜产地附近，其主导区位因素是",
    options: ["原料", "市场", "动力", "技术"],
    answer: 0,
    analysis: "甘蔗、甜菜体积大、运输成本高且易损耗，制糖厂属于原料指向型工业，多靠近原料产地布局。",
    difficulty: 2
  },
  {
    id: "q018",
    type: "single",
    moduleId: "bixiu2",
    pointId: "bixiu2-3",
    question: "城市中的商业区通常布局在",
    options: ["城市外缘的工业区附近", "市中心和交通干线两侧", "盛行风的下风向", "河流上游水源地"],
    answer: 1,
    analysis: "商业活动付租能力最高，能够承担市中心高地租，同时需要接近最大消费人群，因此多分布在市中心和交通干线两侧。",
    difficulty: 2
  },
  {
    id: "q019",
    type: "multiple",
    moduleId: "bixiu2",
    pointId: "bixiu2-2",
    question: "人口迁移对迁出地可能产生的影响有",
    options: ["缓解当地人地矛盾", "为当地提供大量廉价劳动力", "加强与外界的联系", "可能造成劳动力和人才流失"],
    answer: [0, 2, 3],
    analysis: "提供大量廉价劳动力是人口迁移对迁入地的影响；其余三项均属于对迁出地的影响。",
    difficulty: 2
  },
  {
    id: "q020",
    type: "multiple",
    moduleId: "bixiu2",
    pointId: "bixiu2-4",
    question: "下列属于影响农业区位的人文因素有",
    options: ["市场需求", "交通运输", "政策支持", "地形坡度"],
    answer: [0, 1, 2],
    analysis: "市场、交通、政策、劳动力、技术属于人文因素；地形坡度属于自然因素中的地形条件。",
    difficulty: 2
  },
  {
    id: "q021",
    type: "judge",
    moduleId: "bixiu2",
    pointId: "bixiu2-3",
    question: "城镇化水平越高越好，不必考虑经济发展阶段。",
    options: ["正确", "错误"],
    answer: 1,
    analysis: "城镇化应与经济发展水平相适应，过快会带来住房、交通、环境等问题，滞后也会制约发展，并非越高越好。",
    difficulty: 1
  },
  {
    id: "q022",
    type: "judge",
    moduleId: "bixiu2",
    pointId: "bixiu2-5",
    question: "所有工业都应布局在原料产地附近。",
    options: ["正确", "错误"],
    answer: 1,
    analysis: "工业主导区位因素因类型而异，市场、动力、劳动力、技术都可能成为主导，不能一概靠近原料地。",
    difficulty: 2
  },
  {
    id: "q023",
    type: "short",
    moduleId: "bixiu2",
    pointId: "bixiu2-3",
    question: "简述城镇化过程中可能出现的主要问题。",
    answer: ["住房紧张", "交通拥堵", "环境污染", "城市内涝"],
    analysis: "城镇化速度快于基础设施与公共服务供给时，容易出现住房紧张、交通拥堵、环境污染、内涝等问题，需要通过规划与管理协同解决。",
    difficulty: 2
  },
  {
    id: "q024",
    type: "short",
    moduleId: "bixiu2",
    pointId: "bixiu2-4",
    question: "说明市场与交通条件如何影响农业布局。",
    answer: ["市场需求决定农业类型和规模", "交通扩大市场范围", "冷链保障鲜活农产品运输"],
    analysis: "靠近市场适宜发展蔬菜、花卉、乳畜等易腐农产品；交通与冷链改善后，农产品市场半径扩大，布局可以远离消费地。",
    difficulty: 3
  },

  /* ================= 选择性必修一 · 自然地理基础 ================= */
  {
    id: "q025",
    type: "single",
    moduleId: "xuanbi1",
    pointId: "xuanbi1-1",
    question: "关于北京时间，表述正确的是",
    options: ["北京所在经线的地方时", "东八区区时，即 120°E 的地方时", "东经 116°E 的地方时", "中时区的区时"],
    answer: 1,
    analysis: "北京时间是东八区区时，即 120°E 的地方时；北京位于 116°E 附近，其地方时与北京时间并不相同。",
    difficulty: 2
  },
  {
    id: "q026",
    type: "single",
    moduleId: "xuanbi1",
    pointId: "xuanbi1-1",
    question: "当伦敦（中时区）时间为 12:00 时，北京时间是",
    options: ["4:00", "16:00", "20:00", "次日 4:00"],
    answer: 2,
    analysis: "北京时间为东八区区时，比中时区早 8 小时，按「东加西减」得 12:00＋8 小时＝20:00。",
    difficulty: 1
  },
  {
    id: "q027",
    type: "single",
    moduleId: "xuanbi1",
    pointId: "xuanbi1-2",
    question: "夏至日，北半球的昼夜长短状况是",
    options: ["昼短夜长，纬度越高昼越短", "昼长夜短，纬度越高昼越长", "全球各地昼夜等长", "北极圈内出现极夜"],
    answer: 1,
    analysis: "夏至日太阳直射北回归线，北半球昼长夜短且纬度越高昼越长，北极圈及其以北出现极昼。",
    difficulty: 1
  },
  {
    id: "q028",
    type: "single",
    moduleId: "xuanbi1",
    pointId: "xuanbi1-3",
    question: "我国东部季风区冬季盛行的主导风向及性质是",
    options: ["东南风，高温多雨", "西北风，寒冷干燥", "西南风，温暖湿润", "东北风，温和多雨"],
    answer: 1,
    analysis: "冬季亚洲高压（蒙古—西伯利亚高压）强盛，我国东部盛行西北风，寒冷干燥；夏季盛行东南风，高温多雨。",
    difficulty: 2
  },
  {
    id: "q029",
    type: "single",
    moduleId: "xuanbi1",
    pointId: "xuanbi1-4",
    question: "冷锋过境后，当地天气的变化通常是",
    options: ["气温升高、气压降低、阴雨持续", "气温下降、气压升高、天气转晴", "气温下降、气压降低、大风暴雨", "气温升高、气压升高、天气转晴"],
    answer: 1,
    analysis: "冷锋过境后冷气团取代暖气团，气温下降、气压升高，天气转晴；过境时多出现大风、降温、雨雪。",
    difficulty: 2
  },
  {
    id: "q030",
    type: "single",
    moduleId: "xuanbi1",
    pointId: "xuanbi1-5",
    question: "夏季，北印度洋海区的洋流流向总体上呈",
    options: ["逆时针流动", "顺时针流动", "自东向西流动", "自北向南流动"],
    answer: 1,
    analysis: "北印度洋受季风影响，洋流「夏顺冬逆」：夏季盛行西南季风，海水呈顺时针方向流动。",
    difficulty: 2
  },
  {
    id: "q031",
    type: "multiple",
    moduleId: "xuanbi1",
    pointId: "xuanbi1-3",
    question: "下列关于气压带、风带的叙述，正确的有",
    options: ["信风带在任何情况下都干燥少雨", "赤道低压带气流上升，多阴雨天气", "副热带高压带气流下沉，多晴朗天气", "中纬西风带气流暖湿"],
    answer: [1, 2, 3],
    analysis: "信风一般较干燥，但来自海洋的信风遇山地抬升也能形成丰富降水，因此第一项表述绝对化，错误；其余三项均正确。",
    difficulty: 3
  },
  {
    id: "q032",
    type: "multiple",
    moduleId: "xuanbi1",
    pointId: "xuanbi1-5",
    question: "下列关于洋流及其影响的叙述，正确的有",
    options: ["秘鲁渔场由上升补偿流形成", "纽芬兰渔场位于寒暖流交汇处", "寒流对沿岸气候有降温减湿作用", "暖流对沿岸气候有降温减湿作用"],
    answer: [0, 1, 2],
    analysis: "暖流增温增湿、寒流降温减湿；秘鲁渔场由上升流把营养物质带到表层形成，纽芬兰渔场位于寒暖流交汇处。",
    difficulty: 3
  },
  {
    id: "q033",
    type: "judge",
    moduleId: "xuanbi1",
    pointId: "xuanbi1-1",
    question: "北京时间就是北京当地的地方时。",
    options: ["正确", "错误"],
    answer: 1,
    analysis: "北京时间是东八区区时（120°E 地方时），北京位于 116°E 附近，两者相差约 16 分钟，不能混为一谈。",
    difficulty: 1
  },
  {
    id: "q034",
    type: "judge",
    moduleId: "xuanbi1",
    pointId: "xuanbi1-4",
    question: "北半球气旋中心气流下沉，多晴朗天气。",
    options: ["正确", "错误"],
    answer: 1,
    analysis: "气旋是低压中心，气流辐合上升，多阴雨天气；高压中心（反气旋）气流下沉，天气晴朗。",
    difficulty: 2
  },
  {
    id: "q035",
    type: "short",
    moduleId: "xuanbi1",
    pointId: "xuanbi1-4",
    question: "比较冷锋与暖锋过境时的天气差异。",
    answer: ["冷锋大风降温", "雨雪", "暖锋连续性降水", "气温上升"],
    analysis: "冷锋过境时多出现大风、降温、雨雪，降水强度大、历时短；暖锋过境时多形成连续性降水，气温上升。",
    difficulty: 3
  },
  {
    id: "q036",
    type: "short",
    moduleId: "xuanbi1",
    pointId: "xuanbi1-5",
    question: "简述北印度洋洋流「夏顺冬逆」的成因。",
    answer: ["夏季西南季风", "冬季东北季风", "季风驱动海水流动"],
    analysis: "北印度洋海区受季风控制：夏季盛行西南季风，洋流顺时针流动；冬季盛行东北季风，洋流逆时针流动。",
    difficulty: 3
  },

  /* ================= 选择性必修二 · 区域发展 ================= */
  {
    id: "q037",
    type: "single",
    moduleId: "xuanbi2",
    pointId: "xuanbi2-1",
    question: "区域的「开放性」主要表现为",
    options: ["区域内部各要素相互联系", "区域之间进行物质、能量与信息交流", "区域之间的界线都明确", "各区域发展水平保持一致"],
    answer: 1,
    analysis: "整体性指内部要素相互联系，差异性指区域之间特征不同，开放性指区域之间不断进行物质、能量、信息交流。",
    difficulty: 1
  },
  {
    id: "q038",
    type: "single",
    moduleId: "xuanbi2",
    pointId: "xuanbi2-2",
    question: "黄土高原水土流失严重的自然原因之一是",
    options: ["黄土土质疏松、垂直节理发育", "终年高温多雨", "地形平坦开阔", "植被覆盖率高"],
    answer: 0,
    analysis: "黄土土质疏松、垂直节理发育，遇暴雨易被冲刷；再加地形起伏大、降水集中多暴雨、植被覆盖率低，共同导致水土流失。",
    difficulty: 2
  },
  {
    id: "q039",
    type: "single",
    moduleId: "xuanbi2",
    pointId: "xuanbi2-2",
    question: "下列属于黄土高原小流域综合治理中「工程措施」的是",
    options: ["植树种草", "打坝淤地、修水平梯田", "退耕还林还草", "合理控制放牧"],
    answer: 1,
    analysis: "打坝淤地、修水平梯田属于工程措施；植树种草、退耕还林还草属于生物措施；合理放牧属于农业技术与管理措施。",
    difficulty: 2
  },
  {
    id: "q040",
    type: "single",
    moduleId: "xuanbi2",
    pointId: "xuanbi2-3",
    question: "资源型城市实现可持续发展的合理路径是",
    options: ["完全放弃原有资源产业", "延长资源产业链并培育替代产业", "只靠扩大资源开采规模", "等待资源价格回升"],
    answer: 1,
    analysis: "资源型城市应延长产业链、提高资源利用率，同时培育旅游、装备制造、新材料等替代产业，并同步修复生态环境。",
    difficulty: 2
  },
  {
    id: "q041",
    type: "single",
    moduleId: "xuanbi2",
    pointId: "xuanbi2-4",
    question: "皖江城市带承接长三角产业转移的主要优势是",
    options: ["邻近长三角，位置优越且成本较低", "科技力量全国最强", "矿产资源全国最丰富", "常住人口全国最多"],
    answer: 0,
    analysis: "皖江城市带毗邻长三角，交通联系便利，劳动力和土地成本相对较低，便于承接家电、汽车零部件等产业。",
    difficulty: 2
  },
  {
    id: "q042",
    type: "single",
    moduleId: "xuanbi2",
    pointId: "xuanbi2-5",
    question: "南水北调中线工程的水源地是",
    options: ["丹江口水库", "太湖", "洪泽湖", "密云水库"],
    answer: 0,
    analysis: "南水北调中线从丹江口水库调水，向北输送至北京、天津等地；东线沿京杭大运河及沿线湖泊逐级提水北送。",
    difficulty: 1
  },
  {
    id: "q043",
    type: "multiple",
    moduleId: "xuanbi2",
    pointId: "xuanbi2-4",
    question: "产业转移对转出地可能产生的影响有",
    options: ["为高新技术产业与服务业腾出空间", "促进产业升级", "加快当地工业化进程", "短期内可能流失部分就业岗位"],
    answer: [0, 1, 3],
    analysis: "加快工业化与城镇化是产业转移对转入地的影响；其余三项是对转出地的影响。",
    difficulty: 2
  },
  {
    id: "q044",
    type: "multiple",
    moduleId: "xuanbi2",
    pointId: "xuanbi2-5",
    question: "关于资源跨区域调配，叙述正确的有",
    options: ["资源分布与消费分布不一致是重要原因", "有利于调出区把资源优势转化为经济优势", "有利于调入区缓解资源紧张", "不需要考虑调出区的生态影响"],
    answer: [0, 1, 2],
    analysis: "跨区域调配需统筹调出区生态用水与可持续发展，过度调取可能损害调出区环境，因此第四项错误。",
    difficulty: 2
  },
  {
    id: "q045",
    type: "judge",
    moduleId: "xuanbi2",
    pointId: "xuanbi2-1",
    question: "自然区域之间的界线都是明确的。",
    options: ["正确", "错误"],
    answer: 1,
    analysis: "行政区界线明确，自然区域（如气候区、植被区）之间常呈渐变过渡，界线具有过渡性。",
    difficulty: 1
  },
  {
    id: "q046",
    type: "judge",
    moduleId: "xuanbi2",
    pointId: "xuanbi2-4",
    question: "承接产业转移的数量越多越好。",
    options: ["正确", "错误"],
    answer: 1,
    analysis: "承接产业转移要结合本地资源环境承载力筛选产业，避免引入高耗能、高污染环节，并非越多越好。",
    difficulty: 2
  },
  {
    id: "q047",
    type: "short",
    moduleId: "xuanbi2",
    pointId: "xuanbi2-2",
    question: "说明黄土高原水土流失的主要危害。",
    answer: ["耕地减少", "土壤肥力下降", "泥沙淤积河道", "加剧洪涝"],
    analysis: "水土流失使耕地减少、土壤肥力下降、沟壑发育；大量泥沙进入黄河，在下游淤积抬高河床，加剧洪涝风险。",
    difficulty: 2
  },
  {
    id: "q048",
    type: "short",
    moduleId: "xuanbi2",
    pointId: "xuanbi2-5",
    question: "简述南水北调对调入区的有利影响。",
    answer: ["缓解水资源短缺", "改善生态环境", "支撑经济发展"],
    analysis: "调入区获得稳定水源，可缓解生产生活用水紧张，改善河湖生态与地下水状况，为经济社会发展提供支撑。",
    difficulty: 2
  },

  /* ================= 选择性必修三 · 资源、环境与国家安全 ================= */
  {
    id: "q049",
    type: "single",
    moduleId: "xuanbi3",
    pointId: "xuanbi3-1",
    question: "下列自然资源中，属于非可再生资源的是",
    options: ["土地资源", "水资源", "铁矿", "生物资源"],
    answer: 2,
    analysis: "矿产资源（如铁矿）形成周期极长，属非可再生资源；气候、水、土地、生物等属于可再生资源。",
    difficulty: 1
  },
  {
    id: "q050",
    type: "single",
    moduleId: "xuanbi3",
    pointId: "xuanbi3-2",
    question: "我国实行最严格的耕地保护制度，坚守的耕地红线是",
    options: ["15 亿亩", "18 亿亩", "20 亿亩", "25 亿亩"],
    answer: 1,
    analysis: "我国坚守 18 亿亩耕地红线，落实「藏粮于地、藏粮于技」，保障国家粮食安全。",
    difficulty: 2
  },
  {
    id: "q051",
    type: "single",
    moduleId: "xuanbi3",
    pointId: "xuanbi3-3",
    question: "我国能源资源禀赋的基本特点是",
    options: ["富煤、贫油、少气", "富油、富气、少煤", "煤、油、气均十分丰富", "煤、油、气均极度贫乏"],
    answer: 0,
    analysis: "我国能源资源「富煤、贫油、少气」，能源消费结构长期以煤炭为主，油气对外依存度较高。",
    difficulty: 1
  },
  {
    id: "q052",
    type: "single",
    moduleId: "xuanbi3",
    pointId: "xuanbi3-4",
    question: "水体富营养化的直接原因是",
    options: ["氮、磷等营养物质大量进入水体", "水温骤然下降", "水体含氧量升高", "水生植物大量减少"],
    answer: 0,
    analysis: "氮磷等营养物质增多导致藻类暴发，消耗水中氧气、恶化水质，是水体富营养化的直接原因。",
    difficulty: 2
  },
  {
    id: "q053",
    type: "single",
    moduleId: "xuanbi3",
    pointId: "xuanbi3-5",
    question: "「碳中和」的含义是",
    options: ["完全不排放二氧化碳", "二氧化碳排放量与吸收量达到平衡", "只减少工业部门的排放", "把二氧化碳全部封存到地下"],
    answer: 1,
    analysis: "碳中和指通过减排与增汇（森林碳汇、碳捕集等），使排放的二氧化碳与吸收的二氧化碳达到平衡，并非零排放。",
    difficulty: 2
  },
  {
    id: "q054",
    type: "single",
    moduleId: "xuanbi3",
    pointId: "xuanbi3-5",
    question: "全球变暖的主要人为原因是",
    options: ["火山喷发频繁", "化石燃料燃烧排放大量二氧化碳", "太阳活动增强", "地壳运动加剧"],
    answer: 1,
    analysis: "化石燃料燃烧排放大量二氧化碳，加之毁林削弱碳汇，使大气温室气体浓度升高，是全球变暖的主要人为原因。",
    difficulty: 2
  },
  {
    id: "q055",
    type: "multiple",
    moduleId: "xuanbi3",
    pointId: "xuanbi3-2",
    question: "下列有利于保障我国粮食安全的措施有",
    options: ["坚守 18 亿亩耕地红线", "大量占用优质耕地发展工业", "推进高标准农田建设", "推广良种与先进耕作技术"],
    answer: [0, 2, 3],
    analysis: "大量占用优质耕地会直接减少粮食播种面积，损害粮食安全；其余三项分别从耕地数量、耕地质量与单产水平保障粮食安全。",
    difficulty: 2
  },
  {
    id: "q056",
    type: "multiple",
    moduleId: "xuanbi3",
    pointId: "xuanbi3-5",
    question: "下列属于减缓全球变暖的措施有",
    options: ["调整能源结构，发展清洁能源", "植树造林，增加碳汇", "发展碳捕集与封存技术", "扩大化石燃料的使用规模"],
    answer: [0, 1, 2],
    analysis: "减缓以减排增汇为核心；扩大化石燃料使用会增加二氧化碳排放，与减缓目标相反。",
    difficulty: 2
  },
  {
    id: "q057",
    type: "judge",
    moduleId: "xuanbi3",
    pointId: "xuanbi3-1",
    question: "可再生资源取之不尽、用之不竭。",
    options: ["正确", "错误"],
    answer: 1,
    analysis: "可再生资源的更新需要条件与周期，过度索取（如超采地下水）会导致资源衰退甚至枯竭，必须合理利用。",
    difficulty: 1
  },
  {
    id: "q058",
    type: "judge",
    moduleId: "xuanbi3",
    pointId: "xuanbi3-1",
    question: "资源安全只取决于资源数量是否够用。",
    options: ["正确", "错误"],
    answer: 1,
    analysis: "资源安全还包括价格可承受、供应链稳定、运输通道安全等经济与安全维度，不只是数量问题。",
    difficulty: 1
  },
  {
    id: "q059",
    type: "short",
    moduleId: "xuanbi3",
    pointId: "xuanbi3-3",
    question: "说明我国能源安全面临的主要问题，并提出两条应对措施。",
    answer: ["油气对外依存度高", "能源结构以煤炭为主", "开源", "节流", "建立储备"],
    analysis: "我国油气对外依存度高、能源结构偏煤，进口通道存在风险。对策包括加大国内勘探开发、发展清洁能源（开源），提高能效（节流），以及完善能源储备与通道多元化。",
    difficulty: 3
  },
  {
    id: "q060",
    type: "short",
    moduleId: "xuanbi3",
    pointId: "xuanbi3-5",
    question: "简述全球变暖可能带来的主要影响。",
    answer: ["海平面上升", "极端天气增多", "农业生产波动", "水资源与生态系统不稳定"],
    analysis: "全球变暖使冰川融化和海水热膨胀，导致海平面上升；极端天气事件增多，农业生产波动，水资源与生态系统稳定性下降。",
    difficulty: 2
  }
];