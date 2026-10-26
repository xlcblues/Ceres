export interface FoodSeed {
  id: number;
  name: string;
  category: string;
  kcal_per_100g: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  unit_name: string;
  unit_grams: number;
}

export interface ExerciseSeed {
  id: number;
  name: string;
  category: string;
  met: number;
}

export const FOOD_SEEDS: FoodSeed[] = [
  { id: 1, name: "米饭", category: "主食", kcal_per_100g: 116, protein: 2.6, carbs: 25.9, fat: 0.3, unit_name: "克", unit_grams: 100 },
  { id: 2, name: "白粥", category: "主食", kcal_per_100g: 46, protein: 1.1, carbs: 9.9, fat: 0.3, unit_name: "克", unit_grams: 100 },
  { id: 3, name: "馒头", category: "主食", kcal_per_100g: 223, protein: 7, carbs: 47, fat: 1.1, unit_name: "克", unit_grams: 100 },
  { id: 4, name: "面条", category: "主食", kcal_per_100g: 110, protein: 3.9, carbs: 22.8, fat: 0.4, unit_name: "克", unit_grams: 100 },
  { id: 5, name: "全麦面包", category: "主食", kcal_per_100g: 246, protein: 9, carbs: 41, fat: 3.4, unit_name: "克", unit_grams: 100 },
  { id: 6, name: "燕麦片", category: "主食", kcal_per_100g: 367, protein: 15, carbs: 61, fat: 6, unit_name: "克", unit_grams: 100 },
  { id: 7, name: "玉米", category: "主食", kcal_per_100g: 112, protein: 4, carbs: 22.8, fat: 1.2, unit_name: "克", unit_grams: 100 },
  { id: 8, name: "红薯", category: "主食", kcal_per_100g: 86, protein: 1.6, carbs: 20.1, fat: 0.1, unit_name: "克", unit_grams: 100 },
  { id: 9, name: "土豆", category: "主食", kcal_per_100g: 77, protein: 2, carbs: 17, fat: 0.2, unit_name: "克", unit_grams: 100 },
  { id: 10, name: "意面", category: "主食", kcal_per_100g: 131, protein: 5, carbs: 25, fat: 1.1, unit_name: "克", unit_grams: 100 },
  { id: 11, name: "油条", category: "主食", kcal_per_100g: 388, protein: 6.9, carbs: 51, fat: 17.6, unit_name: "克", unit_grams: 100 },
  { id: 12, name: "包子", category: "主食", kcal_per_100g: 227, protein: 7.6, carbs: 38, fat: 5.6, unit_name: "克", unit_grams: 100 },
  { id: 13, name: "饺子", category: "主食", kcal_per_100g: 240, protein: 8.5, carbs: 29, fat: 10, unit_name: "克", unit_grams: 100 },
  { id: 14, name: "鸡蛋", category: "蛋白质", kcal_per_100g: 144, protein: 13.3, carbs: 2.8, fat: 8.8, unit_name: "克", unit_grams: 100 },
  { id: 15, name: "鸡胸肉", category: "蛋白质", kcal_per_100g: 133, protein: 24.6, carbs: 0, fat: 5, unit_name: "克", unit_grams: 100 },
  { id: 16, name: "鸡腿", category: "蛋白质", kcal_per_100g: 181, protein: 16, carbs: 0, fat: 13, unit_name: "克", unit_grams: 100 },
  { id: 17, name: "瘦牛肉", category: "蛋白质", kcal_per_100g: 125, protein: 20.2, carbs: 1.2, fat: 4.2, unit_name: "克", unit_grams: 100 },
  { id: 18, name: "瘦猪肉", category: "蛋白质", kcal_per_100g: 143, protein: 20.3, carbs: 1.5, fat: 6.2, unit_name: "克", unit_grams: 100 },
  { id: 19, name: "三文鱼", category: "蛋白质", kcal_per_100g: 208, protein: 20.4, carbs: 0, fat: 13.4, unit_name: "克", unit_grams: 100 },
  { id: 20, name: "虾", category: "蛋白质", kcal_per_100g: 93, protein: 18.6, carbs: 2.8, fat: 0.8, unit_name: "克", unit_grams: 100 },
  { id: 21, name: "豆腐", category: "蛋白质", kcal_per_100g: 82, protein: 8.1, carbs: 4.2, fat: 4.2, unit_name: "克", unit_grams: 100 },
  { id: 22, name: "牛奶", category: "饮品", kcal_per_100g: 54, protein: 3, carbs: 4.5, fat: 3.2, unit_name: "克", unit_grams: 100 },
  { id: 23, name: "无糖酸奶", category: "饮品", kcal_per_100g: 72, protein: 3.5, carbs: 5, fat: 4, unit_name: "克", unit_grams: 100 },
  { id: 24, name: "豆浆", category: "饮品", kcal_per_100g: 31, protein: 3, carbs: 1.2, fat: 1.6, unit_name: "克", unit_grams: 100 },
  { id: 25, name: "豆干", category: "蛋白质", kcal_per_100g: 142, protein: 16.2, carbs: 4, fat: 7, unit_name: "克", unit_grams: 100 },
  { id: 26, name: "西兰花", category: "蔬菜", kcal_per_100g: 34, protein: 2.8, carbs: 6.6, fat: 0.4, unit_name: "克", unit_grams: 100 },
  { id: 27, name: "番茄", category: "蔬菜", kcal_per_100g: 20, protein: 0.9, carbs: 3.9, fat: 0.2, unit_name: "克", unit_grams: 100 },
  { id: 28, name: "黄瓜", category: "蔬菜", kcal_per_100g: 16, protein: 0.8, carbs: 2.9, fat: 0.2, unit_name: "克", unit_grams: 100 },
  { id: 29, name: "生菜", category: "蔬菜", kcal_per_100g: 15, protein: 1.3, carbs: 2, fat: 0.3, unit_name: "克", unit_grams: 100 },
  { id: 30, name: "菠菜", category: "蔬菜", kcal_per_100g: 28, protein: 2.6, carbs: 4.5, fat: 0.3, unit_name: "克", unit_grams: 100 },
  { id: 31, name: "胡萝卜", category: "蔬菜", kcal_per_100g: 39, protein: 0.9, carbs: 8.8, fat: 0.2, unit_name: "克", unit_grams: 100 },
  { id: 32, name: "蘑菇", category: "蔬菜", kcal_per_100g: 24, protein: 2.7, carbs: 4.4, fat: 0.1, unit_name: "克", unit_grams: 100 },
  { id: 33, name: "苹果", category: "水果", kcal_per_100g: 53, protein: 0.4, carbs: 13.7, fat: 0.2, unit_name: "克", unit_grams: 100 },
  { id: 34, name: "香蕉", category: "水果", kcal_per_100g: 93, protein: 1.4, carbs: 22, fat: 0.2, unit_name: "克", unit_grams: 100 },
  { id: 35, name: "橙子", category: "水果", kcal_per_100g: 47, protein: 0.8, carbs: 11.1, fat: 0.1, unit_name: "克", unit_grams: 100 },
  { id: 36, name: "葡萄", category: "水果", kcal_per_100g: 45, protein: 0.4, carbs: 11.6, fat: 0.2, unit_name: "克", unit_grams: 100 },
  { id: 37, name: "西瓜", category: "水果", kcal_per_100g: 31, protein: 0.5, carbs: 6.8, fat: 0.3, unit_name: "克", unit_grams: 100 },
  { id: 38, name: "草莓", category: "水果", kcal_per_100g: 32, protein: 0.7, carbs: 7.1, fat: 0.3, unit_name: "克", unit_grams: 100 },
  { id: 39, name: "可乐", category: "饮品", kcal_per_100g: 43, protein: 0, carbs: 10.8, fat: 0, unit_name: "克", unit_grams: 100 },
  { id: 40, name: "奶茶", category: "饮品", kcal_per_100g: 65, protein: 0.7, carbs: 11.5, fat: 2, unit_name: "克", unit_grams: 100 },
  { id: 41, name: "黑咖啡", category: "饮品", kcal_per_100g: 2, protein: 0.1, carbs: 0.3, fat: 0.1, unit_name: "克", unit_grams: 100 },
  { id: 42, name: "鲜榨橙汁", category: "饮品", kcal_per_100g: 45, protein: 0.7, carbs: 10.4, fat: 0.2, unit_name: "克", unit_grams: 100 },
  { id: 43, name: "巧克力", category: "零食", kcal_per_100g: 589, protein: 7.6, carbs: 51.9, fat: 37.6, unit_name: "克", unit_grams: 100 },
  { id: 44, name: "薯片", category: "零食", kcal_per_100g: 536, protein: 7, carbs: 49, fat: 35, unit_name: "克", unit_grams: 100 },
  { id: 45, name: "花生", category: "零食", kcal_per_100g: 567, protein: 25.2, carbs: 20.6, fat: 44.3, unit_name: "克", unit_grams: 100 },
  { id: 46, name: "核桃", category: "零食", kcal_per_100g: 654, protein: 14.9, carbs: 13.7, fat: 58.8, unit_name: "克", unit_grams: 100 },
  { id: 47, name: "蛋糕", category: "零食", kcal_per_100g: 348, protein: 6, carbs: 56, fat: 12, unit_name: "克", unit_grams: 100 },
  { id: 48, name: "冰淇淋", category: "零食", kcal_per_100g: 207, protein: 3.5, carbs: 24, fat: 11, unit_name: "克", unit_grams: 100 },
];

export const EXERCISE_SEEDS: ExerciseSeed[] = [
  { id: 1, name: "散步", category: "有氧", met: 2.8 },
  { id: 2, name: "快走", category: "有氧", met: 4.3 },
  { id: 3, name: "慢跑", category: "有氧", met: 7 },
  { id: 4, name: "快跑", category: "有氧", met: 10 },
  { id: 5, name: "骑行", category: "有氧", met: 6.8 },
  { id: 6, name: "游泳", category: "有氧", met: 8 },
  { id: 7, name: "跳绳", category: "有氧", met: 11 },
  { id: 8, name: "瑜伽", category: "身心", met: 2.5 },
  { id: 9, name: "普拉提", category: "身心", met: 3.8 },
  { id: 10, name: "力量训练", category: "力量", met: 5 },
  { id: 11, name: "高强度间歇", category: "力量", met: 8 },
  { id: 12, name: "羽毛球", category: "球类", met: 5.5 },
  { id: 13, name: "篮球", category: "球类", met: 6.5 },
  { id: 14, name: "足球", category: "球类", met: 7 },
  { id: 15, name: "网球", category: "球类", met: 7.3 },
  { id: 16, name: "乒乓球", category: "球类", met: 4 },
  { id: 17, name: "登山", category: "户外", met: 7.5 },
  { id: 18, name: "爬楼梯", category: "户外", met: 8 },
  { id: 19, name: "椭圆机", category: "器械", met: 5 },
  { id: 20, name: "划船机", category: "器械", met: 7 },
  { id: 21, name: "舞蹈", category: "有氧", met: 4.8 },
  { id: 22, name: "太极", category: "身心", met: 3.3 },
  { id: 23, name: "拉伸", category: "身心", met: 2.3 },
  { id: 24, name: "家务", category: "日常", met: 3 },
  { id: 25, name: "平板支撑", category: "力量", met: 4 },
];
