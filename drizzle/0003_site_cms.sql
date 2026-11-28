CREATE TABLE IF NOT EXISTS `site_copy` (
	`key` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `featured_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`repo_id` integer,
	`repo_name` text NOT NULL,
	`name` text NOT NULL,
	`tech` text NOT NULL,
	`detail` text NOT NULL,
	`demo_url` text NOT NULL DEFAULT '',
	`demo_label` text NOT NULL DEFAULT '',
	`sort_order` integer NOT NULL DEFAULT 0,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `featured_projects` (`id`, `repo_id`, `repo_name`, `name`, `tech`, `detail`, `demo_url`, `demo_label`, `sort_order`, `updated_at`) VALUES
('c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f', 1346997599, 'product-normalizer', 'Product Normalizer', 'Python · Pandas', '把条码和商品资料按 SKU 对齐，保留前导零，导出标准 Excel 和校验报告。', '/projects/product-normalizer.html', '数据清洗示例', 10, 1760000000000),
('d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70', 1344840291, 'walmart-listing-agent', 'Walmart Listing 智能体', '桌面工具 · Coze', '从原始货盘整理英文文案和商品图，录入 ERP 前可以逐项审核。', '/projects/walmart-listing.html', '查看工作流程', 20, 1760000000000);
--> statement-breakpoint
INSERT OR IGNORE INTO `entries` (`id`, `station`, `author`, `revision`, `title`, `body`, `topic`, `edited`, `published_title`, `published_body`, `published_topic`, `published`, `has_draft`) VALUES
('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'blog', 'system', 1, '商品目录为什么要保留录入顺序？', '一个目录既要按 SKU 找商品，也要把商品按录入顺序列出来。这两个需求决定了集合的选择。

## 一次录入，两种读法

假设依次录入 A003、A001、A002，再按 SKU 查找 A001。查找只关心键能否命中；展示目录时，人却往往希望看到刚才的录入顺序。

项目里的 `ProductCatalog` 用 `LinkedHashMap` 保存 SKU 到商品的映射。通过键可以直接查询，遍历时又保留插入顺序。这里的显示顺序是 A003、A001、A002。

```java
var names = new LinkedHashMap<String, String>();
names.put("A003", "笔记本");
names.put("A001", "玻璃杯");
names.put("A002", "墨水");
System.out.println(names.keySet());
// [A003, A001, A002]
```

## 把目录的规则写进测试

目录在新增前检查重复 SKU，重复录入会抛出异常。列出商品时，目录返回一份新的列表。测试既检查三个 SKU 的顺序，也验证清空返回的列表后，原目录仍有三件商品。

这两条测试分别约束了用户会看到的顺序，以及调用方可以修改的范围。以后调整存储方式时，只要行为变了，测试就能把差异指出来。

参考源码：[目录实现](https://github.com/dyb061211/java-backend-learning/blob/main/week22-java-core/src/main/java/learning/catalog/ProductCatalog.java) · [对应测试](https://github.com/dyb061211/java-backend-learning/blob/main/week22-java-core/src/test/java/learning/catalog/ProductCatalogTest.java)', 'Java · 集合', 1760500000000, '商品目录为什么要保留录入顺序？', '一个目录既要按 SKU 找商品，也要把商品按录入顺序列出来。这两个需求决定了集合的选择。

## 一次录入，两种读法

假设依次录入 A003、A001、A002，再按 SKU 查找 A001。查找只关心键能否命中；展示目录时，人却往往希望看到刚才的录入顺序。

项目里的 `ProductCatalog` 用 `LinkedHashMap` 保存 SKU 到商品的映射。通过键可以直接查询，遍历时又保留插入顺序。这里的显示顺序是 A003、A001、A002。

```java
var names = new LinkedHashMap<String, String>();
names.put("A003", "笔记本");
names.put("A001", "玻璃杯");
names.put("A002", "墨水");
System.out.println(names.keySet());
// [A003, A001, A002]
```

## 把目录的规则写进测试

目录在新增前检查重复 SKU，重复录入会抛出异常。列出商品时，目录返回一份新的列表。测试既检查三个 SKU 的顺序，也验证清空返回的列表后，原目录仍有三件商品。

这两条测试分别约束了用户会看到的顺序，以及调用方可以修改的范围。以后调整存储方式时，只要行为变了，测试就能把差异指出来。

参考源码：[目录实现](https://github.com/dyb061211/java-backend-learning/blob/main/week22-java-core/src/main/java/learning/catalog/ProductCatalog.java) · [对应测试](https://github.com/dyb061211/java-backend-learning/blob/main/week22-java-core/src/test/java/learning/catalog/ProductCatalogTest.java)', 'Java · 集合', 1760500000000, 0),
('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', 'blog', 'system', 1, '为什么要把 UPC 存成文本？', '当单元格里的 00145 被读成数字 145，消失的两个零已经无法从这个值本身找回来。

## 先判断字段的用途

价格可以相加，条码用来识别商品。由数字组成的标识符依然可以需要前导零。Product Normalizer 读取 Excel 时指定文本类型，再按字段执行清洗。

> 示例：输入文本 `"00 145.0"` → 清洗后 `"00145"`

## 清洗只能处理还存在的信息

读到文本后，程序可以去除空格和末尾多余的全零小数部分。如果来源表格已经把条码存成数值，最初有几个前导零可能已经无从判断。这时应该回看原始资料。

在项目页的两表示例里，条码列始终以文本显示。你还可以改动一个 SKU，观察条码完整而商品字段仍然空缺的情况。

参考源码：[查看字段清洗规则](https://github.com/dyb061211/product-normalizer/blob/main/product_normalizer/cleaner.py) · [两表交互示例](https://ddddddyb.com/projects/product-normalizer.html#data-demo)', 'Python · 数据清洗', 1760000000000, '为什么要把 UPC 存成文本？', '当单元格里的 00145 被读成数字 145，消失的两个零已经无法从这个值本身找回来。

## 先判断字段的用途

价格可以相加，条码用来识别商品。由数字组成的标识符依然可以需要前导零。Product Normalizer 读取 Excel 时指定文本类型，再按字段执行清洗。

> 示例：输入文本 `"00 145.0"` → 清洗后 `"00145"`

## 清洗只能处理还存在的信息

读到文本后，程序可以去除空格和末尾多余的全零小数部分。如果来源表格已经把条码存成数值，最初有几个前导零可能已经无从判断。这时应该回看原始资料。

在项目页的两表示例里，条码列始终以文本显示。你还可以改动一个 SKU，观察条码完整而商品字段仍然空缺的情况。

参考源码：[查看字段清洗规则](https://github.com/dyb061211/product-normalizer/blob/main/product_normalizer/cleaner.py) · [两表交互示例](https://ddddddyb.com/projects/product-normalizer.html#data-demo)', 'Python · 数据清洗', 1760000000000, 0);
