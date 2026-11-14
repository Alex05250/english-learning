# 用法与例句数据维护

## 更新站内真题索引与覆盖报告

```sh
python scripts/build_usage.py
python -m unittest discover -s tests -v
node --check assets/word-usage.js
```

脚本从 `exams/`、`kaoyan-exams/` 中读取带原文锚点的 `.sent` 双语段落，按完整单词匹配两份 `window.ALL_ITEMS` 词表。保留现有索引支持的匹配，不以自动词干算法扩大匹配（避免错误词义关联）。每词最多 6 句，优先本考试和不同试卷，英文去重。索引值升级为数组，前端也兼容旧的单个数字索引。

`assets/usage-coverage.json` 给出覆盖数、至少两句的词数、完全缺失词和少于两句的词。外部词典链接不算覆盖，多句也不等于多义项。报告按英文去重计算例句数。

## 重新导入双语词库

来源：<https://github.com/KyleBing/english-vocabulary>
固定版本：`731240a848dca14e2cf17510f384312b788863c1`
许可：BSD-3-Clause，完整内容随 `assets/english-vocabulary-LICENSE.txt` 分发。

从该固定版本下载以下文件到同一个临时目录（浏览器运行网站时不请求上游）：

- `full_line_jsonl/sentence/正序/六级.jsonl`
- `full_line_jsonl/sentence/正序/考研.jsonl`
- `full_line_jsonl/sentence/正序/四级.jsonl`
- `full_line_jsonl/sentence/正序/高中.jsonl`
- `LICENSE`

保留上述文件的基本名称，然后运行：

```sh
python scripts/import_usage.py /path/to/downloaded-files
python scripts/build_usage.py
```

导入只取站内词表精确匹配的词条，每词最多 6 个搭配、4 个双语例句，保留原文件编号及行号。自动排除部分残句、空译文、异常标记，未逐条人工审核。四本词库合并去重，不推断例句义项或给未配对的搭配自动编例句。

产物按首字母存储于 `assets/usage-extra/`。用户首次展开时才加载对应文件；同一个字母的并发请求共享 Promise。词库数据使用 textContent 渲染，不能注入 HTML。例句和搭配分别附上固定版本来源链接。更新版本时同时更新导入脚本与前端的来源 URL，并核对许可。
