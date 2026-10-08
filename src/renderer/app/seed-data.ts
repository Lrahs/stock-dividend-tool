import type { Position } from '../features/portfolio/calculations';
import { EMPTY_METRICS, type ExpandedMetrics } from '../../shared/models';
export interface WatchStock extends Position, ExpandedMetrics { code:string; roe:number|null; pe:number|null; pb:number|null; note:string; }
const groups: Record<string, string[]> = {
  '通信':['600941 中国移动','601728 中国电信','00788 中国铁塔','600050 中国联通','00552 中国通信服务'],
  '医药':['000538 云南白药','000423 东阿阿胶','000999 华润三九','600750 江中药业','600285 羚锐制药','000963 华东医药','600332 白云山','600329 达仁堂'],
  '资源材料':['601088 中国神华','601857 中国石油','600028 中国石化','600938 中国海油','601600 中国铝业','600219 南山铝业','000708 中信特钢','600019 宝钢股份','600282 南钢股份','600096 云天化','000408 藏格矿业'],
  '工业':['601766 中国中车','600066 宇通客车','600741 华域汽车','601668 中国建筑'],
  '金融':['601318 中国平安','601601 中国太保','601336 新华保险'],
  '公共事业':['601158 重庆水务','600323 洪城环境','000598 兴蓉环境','003816 中国广核','601985 中国核电','600900 长江电力','600025 华能水电','600886 国投电力','600674 川投能源','600236 桂冠电力','600011 华能国际','600023 浙能电力','600642 申能股份','02380 中国电力','00916 龙源电力','600905 三峡能源'],
  '交通运输':['600377 宁沪高速','001965 招商公路','000429 粤高速A','00548 深高速','600012 皖通高速','601107 四川成渝','600350 山东高速','601006 大秦铁路','601390 中国中铁','601186 中国铁建','601919 中远海控','601083 锦江航运','603565 中谷物流','600004 白云机场','001872 招商港口','600018 上港集团','601018 宁波港','601298 青岛港','601000 唐山港','601598 中国外运','603871 嘉友国际'],
  '消费类':['600519 贵州茅台','000858 五粮液','000333 美的集团','000651 格力电器','600887 伊利股份','603288 海天味业'],
};
export const initialStocks: WatchStock[] = Object.entries(groups).flatMap(([industry, entries]) => entries.map((entry) => { const [code, name] = entry.split(' '); return { code, name, industry }; })).map((item, index) => ({ stockId:index+1, ...item, shares:0, price:null, currency:item.code.length===5?'HKD':'CNY', dividendYield:null, roe:null, pe:null, pb:null, note:'', ...EMPTY_METRICS }));

export const ALL_INDUSTRIES: string[] = Object.keys(groups);
