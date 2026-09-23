-- 校验脚本：执行完「库表中文注释.sql」后跑这个，检查有没有漏掉的表/字段。
-- 期望：第 1 段 0 行；第 2 段 0 行。
-- 注意：视图（v_item_name）不在范围内 —— MySQL 视图不支持表/列注释，已用 JOIN 排除。

-- 1) 还没有中文表注释的表
SELECT t.table_name AS '缺表注释', t.table_type
FROM information_schema.tables t
WHERE t.table_schema = 'heavenms' AND t.table_type = 'BASE TABLE'
  AND (t.table_comment IS NULL OR t.table_comment = '');

-- 2) 还没有中文列注释的字段（只查基表，排除视图）
SELECT c.table_name AS '表', c.column_name AS '字段', c.column_type AS '类型'
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
WHERE c.table_schema = 'heavenms'
  AND t.table_type = 'BASE TABLE'
  AND (c.column_comment IS NULL OR c.column_comment = '')
ORDER BY c.table_name, c.ordinal_position;

-- 3) 总览（基表 + 视图都给出来，方便对账）
SELECT t.table_name AS '表名', t.table_type AS '类型', t.table_comment AS '中文名'
FROM information_schema.tables t
WHERE t.table_schema = 'heavenms' ORDER BY t.table_name;

-- 4) 计数总览：应有 76 张基表全部带注释、568 个字段全部带注释
SELECT
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='heavenms' AND table_type='BASE TABLE') AS '基表总数',
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='heavenms' AND table_type='BASE TABLE'
      AND table_comment IS NOT NULL AND table_comment <> '') AS '有中文表注释',
  (SELECT COUNT(*) FROM information_schema.columns c
     JOIN information_schema.tables t
       ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema='heavenms' AND t.table_type='BASE TABLE') AS '基表字段总数',
  (SELECT COUNT(*) FROM information_schema.columns c
     JOIN information_schema.tables t
       ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema='heavenms' AND t.table_type='BASE TABLE'
      AND c.column_comment IS NOT NULL AND c.column_comment <> '') AS '有中文列注释';
